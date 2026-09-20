import test from "node:test";
import assert from "node:assert/strict";
import { rehearsalPlan, assertUnchangedSource, runRehearsalServer } from "./live-rehearsal.mjs";
import { EventEmitter } from "node:events";
const tree = "a".repeat(40),
  id = "a".repeat(32);
const source = { sourceTree: tree, dirty: false };
const args = [
  "--execute",
  "--synthetic-only",
  "--approve-scribe-usd=1",
  "--approve-audio-seconds=90",
  `--source-tree=${tree}`,
  `--extension-id=${id}`,
];
test("activation rejects dirty or replaced source after builds", () => {
  const approved = { ...source, commit: "c".repeat(40) };
  assert.doesNotThrow(() => assertUnchangedSource(approved, { ...approved }));
  for (const change of [
    { dirty: true },
    { commit: "d".repeat(40) },
    { sourceTree: "e".repeat(40) },
  ])
    assert.throws(
      () => assertUnchangedSource(approved, { ...approved, ...change }),
      /Source changed/,
    );
});
function serverHarness() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 123;
  child.kill = () => {
    child.exitCode = 1;
    queueMicrotask(() => child.emit("exit", 1));
  };
  const signals = new EventEmitter();
  return { child, signals };
}
test("occupied-port exit is failure and never reports readiness", async () => {
  const { child, signals } = serverHarness();
  let announced = false;
  const running = runRehearsalServer(
    {},
    {
      start: () => child,
      ready: () => new Promise(() => {}),
      verifyListener: async () => {},
      onReady: () => {
        announced = true;
      },
    },
    signals,
  );
  child.exitCode = 1;
  child.emit("exit", 1);
  await assert.rejects(running, /unexpectedly/);
  assert.equal(announced, false);
  assert.equal(signals.listenerCount("SIGINT"), 0);
});
test("listener ownership failure stops the child without declaring readiness", async () => {
  const { child, signals } = serverHarness();
  await assert.rejects(
    runRehearsalServer(
      {},
      {
        start: () => child,
        ready: async () => {},
        verifyListener: async () => {
          throw new Error("wrong listener");
        },
        onReady: () => {
          throw new Error("must not announce");
        },
      },
      signals,
    ),
    /wrong listener/,
  );
  assert.equal(child.exitCode, 1);
});
test("readiness and owned listener precede the announcement; deliberate shutdown succeeds", async () => {
  const { child, signals } = serverHarness();
  const order = [];
  await runRehearsalServer(
    { port: 3000 },
    {
      start: () => child,
      ready: async () => {
        order.push("ready");
      },
      verifyListener: async (port, pid) => {
        assert.equal(port, 3000);
        assert.equal(pid, 123);
        order.push("owned");
      },
      onReady: () => {
        order.push("announce");
        signals.emit("SIGINT");
      },
    },
    signals,
  );
  assert.deepEqual(order, ["ready", "owned", "announce"]);
});
test("default plan never reads credentials", () => {
  const env = new Proxy(
    {},
    {
      get() {
        throw Error("Environment inspected");
      },
    },
  );
  assert.deepEqual(rehearsalPlan([], env), { execute: false });
});
test("rejects missing approval, dirty or foreign source, CI, unknown and duplicate options before reading keys", () => {
  const env = {
    get ELEVENLABS_API_KEY() {
      throw Error("Key read too early");
    },
  };
  for (const invalid of [
    args.filter((a) => a !== "--synthetic-only"),
    [...args, "--unsafe"],
    [...args, "--execute"],
  ])
    assert.throws(() => rehearsalPlan(invalid, env, source), /authorization|options/);
  assert.throws(() => rehearsalPlan(args, env, { ...source, dirty: true }), /clean/);
  assert.throws(() => rehearsalPlan(args, env, { ...source, sourceTree: "b".repeat(40) }), /clean/);
  assert.throws(
    () =>
      rehearsalPlan(
        args,
        {
          CI: "true",
          get ELEVENLABS_API_KEY() {
            throw Error("Key read too early");
          },
        },
        source,
      ),
    /authorization/,
  );
});
test("Gemini has separate authorization; a synthetic capped transcription run remains prewritten by default", () => {
  const env = { ELEVENLABS_API_KEY: "synthetic-server-key" };
  assert.equal(rehearsalPlan(args, env, source).gemini, false);
  assert.throws(() => rehearsalPlan([...args, "--gemini"], env, source), /separate/);
  assert.equal(rehearsalPlan([...args, "--gemini", "--approve-usd=1"], env, source).gemini, true);
});
