import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoConfiguration } from "../demo-server.mjs";
import { runBuild, ready, verifyListener } from "./run-local-scribe-spike.mjs";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../web/package.json", import.meta.url));

export function rehearsalPlan(args, environment, source) {
  if (!args.length) return { execute: false };
  const required = [
    "--execute",
    "--synthetic-only",
    "--approve-scribe-usd=1",
    "--approve-audio-seconds=90",
  ];
  if (environment.CI || required.some((flag) => !args.includes(flag)))
    throw new Error("The live test needs explicit synthetic-data and bounded-spend authorization.");
  if (
    new Set(args).size !== args.length ||
    args.some(
      (flag) =>
        !required.includes(flag) &&
        !/^--(?:extension-id=[a-p]{32}|source-tree=[a-f0-9]{40}|gemini|approve-usd=1)$/.test(flag),
    )
  )
    throw new Error("Invalid live test options.");
  const tree = args.find((flag) => flag.startsWith("--source-tree="))?.slice(14);
  const extensionId = args.find((flag) => flag.startsWith("--extension-id="))?.slice(15);
  if (!tree || tree !== source?.sourceTree || source.dirty || !extensionId)
    throw new Error("A clean reviewed source tree and exact test extension ID are required.");
  const gemini = args.includes("--gemini");
  if (gemini !== args.includes("--approve-usd=1"))
    throw new Error("Gemini requires its separate shared $1 allowance.");
  // Read credentials only after every explicit authorization check.
  if (!environment.ELEVENLABS_API_KEY) throw new Error("A server-side ElevenLabs key is required.");
  return { execute: true, tree, extensionId, gemini };
}

function safeEnvironment(environment) {
  const result = { NEXT_TELEMETRY_DISABLED: "1" };
  for (const name of [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "ComSpec",
    "PATHEXT",
    "LOCALAPPDATA",
    "APPDATA",
    "USERPROFILE",
  ])
    if (environment[name] !== undefined) result[name] = environment[name];
  return result;
}
const run = (command, args, cwd, env) =>
  runBuild(() => spawn(command, args, { cwd, env, windowsHide: true, stdio: "ignore" }));

export function assertUnchangedSource(approved, current) {
  if (
    current.dirty ||
    approved.commit !== current.commit ||
    approved.sourceTree !== current.sourceTree
  )
    throw new Error("Source changed after authorization; rebuild and review before activation.");
}
async function assertNoEnvFiles() {
  for (const directory of [root, join(root, "web"), join(root, "extension")])
    if (
      (await readdir(directory)).some(
        (name) => /^\.env(?:\.|$)/i.test(name) && name !== ".env.example",
      )
    )
      throw new Error(
        "Remove local environment files from the rehearsal checkouts; do not print their contents.",
      );
}
async function assertPortAvailable() {
  await new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(new Error("Port 3000 is occupied; leave the existing service untouched.")),
    );
    probe.listen(3000, "127.0.0.1", () => probe.close((error) => (error ? reject(error) : done())));
  });
}

export async function runRehearsalServer(plan, dependencies, signals = process) {
  const controller = new AbortController();
  let intentional = false,
    child;
  const stop = () => {
    intentional = true;
    controller.abort();
    child?.kill();
  };
  const timer = setTimeout(stop, 300_000);
  signals.once("SIGINT", stop);
  signals.once("SIGTERM", stop);
  try {
    child = dependencies.start();
    const ended = new Promise((done, reject) => {
      child.once("error", () => reject(new Error("Live test server could not start.")));
      child.once("exit", (code) => {
        if (intentional) done();
        else reject(new Error(`Live test server exited unexpectedly (${code ?? "signal"}).`));
      });
    });
    await Promise.race([
      ended,
      (async () => {
        await dependencies.ready(plan, controller.signal);
        if (controller.signal.aborted) return;
        await dependencies.verifyListener(plan.port, child.pid);
        if (!controller.signal.aborted) dependencies.onReady();
      })(),
    ]);
    await ended;
  } finally {
    controller.abort();
    clearTimeout(timer);
    signals.removeListener("SIGINT", stop);
    signals.removeListener("SIGTERM", stop);
    if (child?.exitCode === null) child.kill();
  }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  if (!args.length) {
    console.log(
      "Offline plan: read docs/evaluations/TASK-308/LIVE_TEST.md. No key is read and no provider is called. The test needs separate approval and Chrome component checks first.",
    );
    return;
  }
  // No source inspection or credential access for an unapproved attempt.
  if (!args.includes("--execute") || !args.includes("--approve-scribe-usd=1") || environment.CI)
    throw new Error("Live test not authorized.");
  const git = (...values) =>
    execFileSync("git", values, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  const inspectSource = () => ({
    sourceTree: git("rev-parse", "HEAD^{tree}"),
    commit: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain") !== "",
    commonDir: git("rev-parse", "--path-format=absolute", "--git-common-dir"),
  });
  const source = inspectSource();
  const plan = rehearsalPlan(args, environment, source);
  await assertNoEnvFiles();
  await assertPortAvailable();
  const safe = safeEnvironment(environment);
  const geminiArgs = plan.gemini
    ? ["--gemini", "--approve-usd=1", `--source-tree=${plan.tree}`]
    : [];
  const configuration = demoConfiguration(
    ["--production", `--extension-id=${plan.extensionId}`, ...geminiArgs],
    { ...safe, ...(plan.gemini ? { GEMINI_API_KEY: environment.GEMINI_API_KEY } : {}) },
    source,
  );
  const next = require.resolve("next/dist/bin/next");
  await run(process.execPath, [next, "build"], join(root, "web"), {
    ...safe,
    LIVELECTURE_ASSISTANCE_PROVIDER: "prewritten",
  });
  await run(
    process.execPath,
    [join(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "live-test"],
    join(root, "extension"),
    safe,
  );
  const manifest = JSON.parse(
    await readFile(join(root, "extension/dist-live-test/manifest.json"), "utf8"),
  );
  if (
    !manifest.name.endsWith("LIVE TEST") ||
    !manifest.content_security_policy.extension_pages.endsWith(" wss://api.elevenlabs.io")
  )
    throw new Error("Unexpected live extension package.");
  assertUnchangedSource(source, inspectSource());
  await assertNoEnvFiles();
  await assertPortAvailable();
  // Durable single-run reservation: a restart cannot silently grant another Scribe allowance.
  await writeFile(
    join(source.commonDir, "livelecture-live-test-allowance-v1.json"),
    JSON.stringify({
      sourceTree: plan.tree,
      reservedUsd: 1,
      maxTokenIssuances: 2,
      maxAudioSecondsPerSource: 90,
      createdAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  const capability = randomBytes(16).toString("hex");
  const codeFile = join(source.commonDir, `livelecture-test-code-${process.pid}.txt`);
  await writeFile(codeFile, capability, { flag: "wx", mode: 0o600 });
  try {
    await assertNoEnvFiles();
    assertUnchangedSource(source, inspectSource());
    await runRehearsalServer(
      { port: 3000, extensionId: plan.extensionId, capability },
      {
        ready,
        verifyListener,
        start: () =>
          spawn(process.execPath, [next, ...configuration.args], {
            cwd: join(root, "web"),
            windowsHide: true,
            stdio: "ignore",
            env: {
              ...configuration.env,
              LIVELECTURE_LIVE_TEST: "synthetic-90-seconds",
              LIVE_SCRIBE_SPIKE_ENABLED: "true",
              RUN_PAID_SCRIBE_SMOKE: "I_ACKNOWLEDGE_COST",
              LIVELECTURE_SPIKE_CAPABILITY: capability,
              ELEVENLABS_API_KEY: environment.ELEVENLABS_API_KEY,
            },
          }),
        onReady: () => {
          console.log(
            "Verified test server ready on 127.0.0.1:3000. No browser is opened. Stop with Ctrl+C; automatic shutdown after five minutes.",
          );
          console.log(
            `Read the temporary test code locally from ${codeFile}. Paste it only in the LIVE TEST extension; never in chat. The file is removed on shutdown.`,
          );
        },
      },
    );
  } finally {
    await unlink(codeFile);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      "Live rehearsal refused or stopped. No provider detail or credential was printed. Keep the allowance record for review before any retry.",
    );
    process.exitCode = 1;
  });
