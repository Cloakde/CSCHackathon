import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { demoConfiguration } from "./demo-server.mjs";

// Real HTTP verification of the production route bundles. No browser or provider is used.
const origin = "http://127.0.0.1:3000";
const fixture = JSON.parse(
  await readFile(new URL("../shared/fixtures/calculus-lecture.json", import.meta.url), "utf8"),
);
const require = createRequire(new URL("../web/package.json", import.meta.url));
const configuration = demoConfiguration(["--production"], {
  ...process.env,
  LIVELECTURE_EXTENSION_ID: "",
});

// Refuse to interfere with an existing service, even if it is another demo instance.
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", () =>
    reject(
      new Error("Port 3000 is already in use. Stop your demo server before running verify:demo."),
    ),
  );
  probe.listen(3000, "127.0.0.1", () => probe.close(resolve));
});

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), ...configuration.args],
  {
    cwd: fileURLToPath(new URL("../web", import.meta.url)),
    env: configuration.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
const exited = once(child, "exit");
let output = "";
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Demo server did not become ready.")), 30_000);
  const read = (data) => {
    output = `${output}${data}`.slice(-5000);
    if (output.includes("Ready in")) {
      clearTimeout(timer);
      resolve();
    }
  };
  child.stdout.on("data", read);
  child.stderr.on("data", read);
  child.once("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.once("exit", () => {
    clearTimeout(timer);
    reject(new Error("Demo server exited before verification."));
  });
});

async function call(path, method = "GET", body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "X-LiveLecture-Demo": "scripted-v1",
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  const result = await response.json();
  assert.equal(result.ok, true);
  return result.data;
}

try {
  await ready;
  for (const path of ["/", "/demo"]) {
    const page = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /SIMULATION/i);
  }
  const blocked = await fetch(`${origin}/api/sessions/session_missing`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  const foreign = await fetch(`${origin}/api/sessions/session_missing`, {
    headers: { Origin: "https://example.invalid", "X-LiveLecture-Demo": "scripted-v1" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  const { session } = await call("/api/sessions", "POST", { sourceMode: "simulation" });
  const path = `/api/sessions/${session.sessionId}`;
  const chunks = fixture.events
    .filter((event) => event.type === "transcript.committed")
    .map((event) => ({ ...event.chunk, sessionId: session.sessionId }));
  assert.equal(chunks.length, 10);
  await call(`${path}/chunks`, "POST", { chunks: chunks.slice(0, 3) });
  const first = await call(`${path}/im-lost`, "POST", { lookbackMs: 900_000 });
  assert.equal(first.confusionEvent.conceptId, "concept_inner_outer");
  await call(`${path}/chunks`, "POST", { chunks });
  const second = await call(`${path}/im-lost`, "POST", { lookbackMs: 900_000 });
  assert.equal(second.confusionEvent.conceptId, "concept_inner_derivative");
  const endedAt = new Date(Date.parse(session.startedAt) + chunks.at(-1).endMs).toISOString();
  const ended = await call(`${path}/end`, "POST", { endedAt });
  assert.equal(ended.handoff.companionRoute, `/sessions/${session.sessionId}`);
  const view = await call(path);
  assert.equal(view.session.status, "completed");
  assert.equal(view.confusionEvents.length, 2);
  const questions = [];
  for (const help of [first, second]) {
    const drill = await call(`${path}/weak-area-drills`, "POST", {
      confusionEventIds: [help.confusionEvent.confusionId],
    });
    assert.equal(drill.conceptId, help.confusionEvent.conceptId);
    assert.deepEqual(drill.sourceConfusionEventIds, [help.confusionEvent.confusionId]);
    questions.push(drill.practiceItems[0].prompt);
  }
  assert.notEqual(questions[0], questions[1]);
  const companion = await fetch(`${origin}${ended.handoff.companionRoute}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(companion.status, 200);
  assert.match(await companion.text(), /Practice where you got stuck/);
  assert.deepEqual(await call(path, "DELETE"), { deleted: true });
  assert.deepEqual(await call(path, "DELETE"), { deleted: false });
  console.log(
    "Production HTTP demo passed: both concepts, separate route modules, practice, deletion, and access guards. No browser/provider used.",
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await exited;
}
