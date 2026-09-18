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
import { validateFixture, runSmoke, ScribeSmokeFailure } from "./scribe-realtime-smoke.mjs";
import { buildSmokeFixture, validateVadFixture } from "./scribe-fixture.mjs";
const pausedFixture = () => buildSmokeFixture(new Uint8Array(8.5 * 32000).fill(1));
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
test("the paused fixture sends two separated speech sections and final silence within 30 seconds", () => {
  const source = new Uint8Array(10 * 32000).fill(9);
  const bytes = buildSmokeFixture(source);
  assert.equal(bytes.length, 30 * 32000);
  assert.equal(validateVadFixture(bytes).pauseBoundaries, 2);
  assert.equal(validateVadFixture(bytes).trailingSilenceSeconds, 6.5);
  assert.deepEqual(bytes.subarray(0, 8.5 * 32000), source.subarray(0, 8.5 * 32000));
  assert.deepEqual(bytes.subarray(15 * 32000, 23.5 * 32000), bytes.subarray(0, 8.5 * 32000));
  assert.equal(bytes.subarray(8.5 * 32000, 15 * 32000).some(Boolean), false);
  assert.equal(bytes.subarray(23.5 * 32000).some(Boolean), false);
  assert.equal(
    source.every((value) => value === 9),
    true,
  );
  assert.throws(() => buildSmokeFixture(source.subarray(0, 32000)), /too short/);
  assert.throws(() => buildSmokeFixture(new Uint8Array(source.length)), /non-silent/);
});
test("missing internal or final silence is rejected before transport creation or token use", async () => {
  const noFinalPause = pausedFixture();
  noFinalPause.fill(1, 23.5 * 32000);
  const onlyFinalPause = new Uint8Array(30 * 32000).fill(1);
  onlyFinalPause.fill(0, 25 * 32000);
  for (const bytes of [new Uint8Array(30 * 32000).fill(1), noFinalPause, onlyFinalPause]) {
    let created = false;
    await assert.rejects(
      runSmoke({
        bytes,
        createTransport: () => {
          created = true;
        },
      }),
      /two speech sections/,
    );
    assert.equal(created, false);
  }
});
test("a failed or silent transcription cannot produce a successful smoke report", async () => {
  let stopped = false,
    clock = 0;
  const logged = [];
  await assert.rejects(
    runSmoke({
      bytes: pausedFixture(),
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
      log: (line) => logged.push(JSON.parse(line)),
    }),
    (error) => {
      assert.ok(error instanceof ScribeSmokeFailure);
      assert.equal(error.summary.failureCode, "missing_transcription_or_reconnect_evidence");
      assert.equal(error.summary.status, "fail");
      assert.equal(error.summary.audioSecondsOffered, 30);
      assert.equal(error.summary.audioSecondsSent, 0);
      assert.equal(error.summary.tokenAttempts, 0);
      assert.equal(error.summary.commits, 0);
      return true;
    },
  );
  assert.equal(stopped, true);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].status, "fail");
});
test("failed token issuance reports attempted and successful calls separately without provider details", async () => {
  let stopped = false,
    clock = 0;
  const logged = [];
  await assert.rejects(
    runSmoke({
      bytes: pausedFixture(),
      createTransport: (options) => {
        options.onWarning("PRIVATE WARNING");
        void options.mintToken().catch(() =>
          options.onEvent({
            type: "source.error",
            sequence: 1,
            error: { retryable: false, message: "PRIVATE ERROR" },
          }),
        );
        return {
          isReady: () => false,
          stop: () => {
            stopped = true;
          },
        };
      },
      mintToken: async () => {
        throw new Error("PRIVATE KEY");
      },
      validateEvent: () => true,
      wait: async (ms) => {
        clock += ms;
      },
      now: () => clock,
      log: (line) => logged.push(line),
    }),
    (error) => {
      assert.equal(error.summary.failureCode, "source_error");
      assert.equal(error.summary.tokenAttempts, 1);
      assert.equal(error.summary.tokenIssuances, 0);
      assert.equal(error.summary.connectionAttempts, 0);
      assert.equal(error.summary.audioSecondsSent, 0);
      assert.equal(error.summary.retention, "RETENTION_ACTIVE");
      return true;
    },
  );
  assert.equal(stopped, true);
  assert.equal(logged.join("").includes("PRIVATE"), false);
  assert.equal(logged.filter((line) => line.includes('"type":"scribe_smoke_result"')).length, 1);
});
test("a synchronous connection failure still produces a safe bounded summary", async () => {
  const logged = [];
  await assert.rejects(
    runSmoke({
      bytes: pausedFixture(),
      createTransport: (options) => options.connect("PRIVATE TOKEN URL"),
      connect: () => {
        throw new Error("PRIVATE CONNECTION ERROR");
      },
      log: (line) => logged.push(line),
    }),
    (error) => {
      assert.equal(error.summary.failureCode, "transport_failure");
      assert.equal(error.summary.connectionAttempts, 1);
      assert.equal(error.summary.connections, 0);
      return true;
    },
  );
  assert.equal(logged.join("").includes("PRIVATE"), false);
});
test("an invalid canonical event stops the run and is never logged", async () => {
  let clock = 0,
    stopped = false;
  const logged = [];
  await assert.rejects(
    runSmoke({
      bytes: pausedFixture(),
      createTransport: (options) => ({
        isReady: () => true,
        chunk: () => {
          options.onEvent({ type: "PRIVATE EVENT" });
          return true;
        },
        stop: () => {
          stopped = true;
        },
      }),
      validateEvent: () => false,
      now: () => clock,
      wait: async (ms) => {
        clock += ms;
      },
      log: (line) => logged.push(line),
    }),
    (error) => {
      assert.equal(error.summary.failureCode, "invalid_canonical_event");
      assert.equal(error.summary.canonicalValidation, false);
      assert.equal(error.summary.audioSecondsSent, 0.1);
      return true;
    },
  );
  assert.equal(stopped, true);
  assert.equal(logged.join("").includes("PRIVATE"), false);
});
test("a final commit from the closing socket cannot stand in for a post-reconnect commit", async () => {
  let clock = 0,
    options,
    chunks = 0;
  const committed = (startMs, endMs) =>
    options.onEvent({
      type: "transcript.committed",
      sequence: chunks,
      chunk: { startMs, endMs },
    });
  await assert.rejects(
    runSmoke({
      bytes: pausedFixture(),
      createTransport: (value) => {
        options = value;
        void options.mintToken();
        options.connect("synthetic");
        return {
          isReady: () => true,
          chunk: () => {
            chunks++;
            if (chunks === 1) committed(0, 100);
            if (chunks === 2) options.onEvent({ type: "transcript.partial", sequence: 2 });
            return true;
          },
          stop() {},
        };
      },
      mintToken: async () => ({ token: "synthetic" }),
      connect: () => ({
        close: () => {
          committed(100, 200); // A queued first-socket commit arrives while closing.
          options.onDiscardedGap({ startSample: 3200, endSample: 4800 });
          void options.mintToken();
          options.connect("synthetic-reconnect");
        },
      }),
      validateEvent: () => true,
      now: () => clock,
      wait: async (ms) => {
        clock += ms;
      },
      log() {},
    }),
    (error) => {
      assert.equal(error.summary.failureCode, "missing_transcription_or_reconnect_evidence");
      assert.equal(error.summary.connections, 2);
      assert.equal(error.summary.tokenIssuances, 2);
      assert.equal(error.summary.commits, 2);
      assert.equal(error.summary.committedBeforeReconnect, 1);
      assert.equal(error.summary.committedAfterReconnect, 0);
      return true;
    },
  );
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
      bytes: pausedFixture(),
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
    assert.equal(result.tokenAttempts, 2);
    assert.equal(result.tokenIssuances, 2);
    assert.equal(result.commits, 2);
    assert.equal(result.committedBeforeReconnect, 1);
    assert.equal(result.committedAfterReconnect, 1);
    assert.equal(result.status, "pass");
    assert.equal(result.audioSecondsOffered, 30);
    assert.ok(result.audioSecondsSent < 30);
    assert.ok(result.audioSecondsSent > 29);
    assert.equal(result.canonicalValidation, true);
    assert.equal(socket.onmessage, null);
    assert.equal(timers.size, 0);
  } finally {
    assert.equal(path.dirname(path.resolve(temporary)), base);
    assert.ok(path.basename(temporary).startsWith("livelecture-scribe-test-"));
    await rm(temporary, { recursive: true, force: true });
  }
});
