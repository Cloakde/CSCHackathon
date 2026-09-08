import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  buildLaunchPlan,
  childEnvironments,
  runChildren,
  runBuild,
  main,
  COST_ACK,
} from "./run-local-scribe-spike.mjs";
import { validateFixture, runSmoke } from "./scribe-realtime-smoke.mjs";
const tree = "a".repeat(40);
const env = {
  RUN_PAID_SCRIBE_SMOKE: COST_ACK,
  LIVELECTURE_SPIKE_SOURCE_TREE: tree,
  LIVELECTURE_EXTENSION_ID: "a".repeat(32),
  ELEVENLABS_API_KEY: "synthetic-key",
  SCRIBE_SYNTHETIC_PCM: "synthetic.pcm",
  SCRIBE_SYNTHETIC_AUDIO_CONFIRMED: "synthetic-speech-only",
};
test("offline plan and rejected execution do not read credentials", async () => {
  const secret = {
    get ELEVENLABS_API_KEY() {
      throw new Error("Key read");
    },
  };
  assert.equal(await main([], secret), 0);
  assert.throws(() => buildLaunchPlan(secret, { tree, dirty: false }), /authorization/);
  for (const override of [
    { CI: "true" },
    { LIVELECTURE_SPIKE_SOURCE_TREE: "b".repeat(40) },
    { LIVELECTURE_SPIKE_HOSTNAME: "0.0.0.0" },
    { LIVELECTURE_SPIKE_PORT: "NaN" },
  ])
    assert.throws(() => buildLaunchPlan({ ...env, ...override }, { tree, dirty: false }));
  assert.throws(() => buildLaunchPlan(env, { tree, dirty: true }));
});
test("child configuration separates the key and forwards the exact origin and capability", () => {
  const plan = buildLaunchPlan(env, { tree, dirty: false });
  assert.match(plan.capability, /^[a-f0-9]{32}$/);
  const children = childEnvironments(
    plan,
    { ...env, GEMINI_API_KEY: "never-forward", UNRELATED: "no" },
    { path: "artifact.mjs", hash: "hash" },
  );
  assert.equal(children.server.ELEVENLABS_API_KEY, env.ELEVENLABS_API_KEY);
  assert.equal(children.harness.ELEVENLABS_API_KEY, undefined);
  assert.equal(children.build.ELEVENLABS_API_KEY, undefined);
  assert.equal(children.harness.LIVELECTURE_EXTENSION_ID, plan.extensionId);
  assert.equal(children.harness.LIVELECTURE_SPIKE_CAPABILITY, plan.capability);
  for (const child of Object.values(children)) {
    assert.equal(child.GEMINI_API_KEY, undefined);
    assert.equal(child.UNRELATED, undefined);
  }
});
function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 123;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 1;
    queueMicrotask(() => child.emit("exit", 1));
    return true;
  };
  return child;
}
test("cancelling the key-free build terminates it and removes signal listeners", async () => {
  const signals = new EventEmitter();
  const child = fakeChild();
  const result = runBuild(() => child, signals);
  signals.emit("SIGINT");
  await assert.rejects(result, /cancelled/);
  assert.equal(child.killed, true);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});
test("launcher binds loopback, verifies listener before harness and cleans both children", async () => {
  const plan = buildLaunchPlan(env, { tree, dirty: false });
  const server = fakeChild(),
    harness = fakeChild(),
    calls = [];
  const result = await runChildren(plan, childEnvironments(plan, {}, { path: "x", hash: "x" }), {
    start(kind, args, childEnv) {
      calls.push(kind);
      assert.equal(args.includes(plan.capability), false);
      assert.equal(args.includes(plan.apiKey), false);
      if (kind === "server") {
        assert.deepEqual(args, ["start", "--hostname", "127.0.0.1", "--port", "3100"]);
        return server;
      }
      assert.equal(childEnv.ELEVENLABS_API_KEY, undefined);
      queueMicrotask(() => {
        harness.exitCode = 0;
        harness.emit("exit", 0);
      });
      return harness;
    },
    ready: async () => {
      calls.push("ready");
    },
    verifyListener: async () => {
      calls.push("listener");
    },
  });
  assert.equal(result, 0);
  assert.equal(server.killed, true);
  assert.deepEqual(calls, ["server", "ready", "listener", "harness"]);
});
test("failed readiness terminates the server without starting a harness", async () => {
  const server = fakeChild();
  let starts = 0;
  await assert.rejects(
    runChildren(
      {},
      { server: {} },
      {
        start: () => {
          starts++;
          return server;
        },
        ready: async () => {
          throw new Error("not ready");
        },
        verifyListener: async () => {
          throw new Error("must not run");
        },
      },
    ),
  );
  assert.equal(starts, 1);
  assert.equal(server.killed, true);
});
test("fixture gate rejects silence, alignment errors and over-budget audio", () => {
  assert.throws(() => validateFixture(new Uint8Array(3200)));
  assert.throws(() => validateFixture(new Uint8Array(960001).fill(1)));
  assert.throws(() => validateFixture(new Uint8Array(3201).fill(1)));
  validateFixture(new Uint8Array(3200).fill(1));
});
test("a failed or silent transcription cannot produce a successful smoke report", async () => {
  let stopped = false,
    clock = 0;
  await assert.rejects(
    runSmoke({
      bytes: new Uint8Array(3200).fill(1),
      createTransport: () => ({
        chunk() {},
        isReady: () => true,
        stop: () => {
          stopped = true;
        },
      }),
      validateEvent: () => true,
      wait: async (ms) => {
        clock += ms;
      },
      now: () => clock,
      log() {},
    }),
    /evidence is missing/,
  );
  assert.equal(stopped, true);
});
test("the exact bundled transport produces validated commits through the smoke runner offline", async () => {
  const { build } = await import("vite");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const base = path.resolve(tmpdir());
  const temporary = await mkdtemp(path.join(base, "livelecture-scribe-test-"));
  try {
    await build({
      configFile: false,
      envFile: false,
      logLevel: "silent",
      build: {
        target: "node24",
        outDir: temporary,
        emptyOutDir: false,
        lib: {
          entry: fileURLToPath(new URL("./scribe-smoke-entry.ts", import.meta.url)),
          formats: ["es"],
          fileName: () => "test.mjs",
        },
      },
    });
    const { createScribeRealtimeTransport, validateEvent } = await import(
      pathToFileURL(path.join(temporary, "test.mjs")).href
    );
    let clock = 0,
      socket,
      timerId = 0;
    const timers = new Map();
    const transportFactory = (options) =>
      createScribeRealtimeTransport({
        ...options,
        now: () => clock,
        setTimer: (fn, delay) => {
          const id = ++timerId;
          timers.set(id, { fn, at: clock + delay });
          return id;
        },
        clearTimer: (id) => timers.delete(id),
        random: () => 0,
      });
    const result = await runSmoke({
      createTransport: transportFactory,
      validateEvent,
      bytes: new Uint8Array(32000).fill(1),
      now: () => clock,
      log() {},
      mintToken: async () => ({ token: "synthetic-token", expiresInSeconds: 900 }),
      connect: () => {
        let sends = 0;
        const next = {
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          close() {
            const callback = this.onclose;
            queueMicrotask(() => callback?.({ code: 1000, reason: "" }));
          },
          send() {
            sends++;
            const frame = (message_type, text, extra = {}) =>
              this.onmessage?.({ data: JSON.stringify({ message_type, text, ...extra }) });
            frame("partial_transcript", "Synthetic test sentence");
            if (sends === 1) {
              frame("committed_transcript", "Synthetic test sentence");
              frame("committed_transcript_with_timestamps", "Synthetic test sentence", {
                words: [{ text: "Synthetic test sentence", start: 0, end: 0.1 }],
              });
            }
          },
        };
        socket = next;
        queueMicrotask(() => {
          next.onopen?.();
          next.onmessage?.({
            data: JSON.stringify({
              message_type: "session_started",
              session_id: "synthetic-session",
            }),
          });
        });
        return next;
      },
      wait: async (ms) => {
        clock += ms;
        for (const [id, item] of [...timers])
          if (item.at <= clock) {
            timers.delete(id);
            item.fn();
          }
        for (let i = 0; i < 10; i++) await Promise.resolve();
      },
    });
    assert.equal(result.connections, 2);
    assert.equal(result.commits, 2);
    assert.equal(result.canonicalValidation, true);
    assert.equal(socket.onmessage, null);
    assert.equal(timers.size, 0);
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), base);
    assert.ok(path.basename(temporary).startsWith("livelecture-scribe-test-"));
    await rm(temporary, { recursive: true, force: true });
  }
});
