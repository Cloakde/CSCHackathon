import { randomBytes, createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../web/package.json", import.meta.url));
export const COST_ACK = "I_ACKNOWLEDGE_COST";

export function buildLaunchPlan(env, source) {
  // Check approval before reading any credential field.
  if (env.RUN_PAID_SCRIBE_SMOKE !== COST_ACK || env.CI)
    throw new Error("A paid smoke requires explicit authorization outside CI.");
  if (env.LIVELECTURE_SPIKE_HOSTNAME && env.LIVELECTURE_SPIKE_HOSTNAME !== "127.0.0.1")
    throw new Error("Only 127.0.0.1 is supported.");
  if (
    !source ||
    source.dirty ||
    !/^[a-f0-9]{40}$/.test(source.tree) ||
    env.LIVELECTURE_SPIKE_SOURCE_TREE !== source.tree
  )
    throw new Error("A clean, explicitly reviewed source tree is required.");
  const extensionId = env.LIVELECTURE_EXTENSION_ID;
  if (!extensionId || !/^[a-p]{32}$/.test(extensionId))
    throw new Error("A valid extension ID is required.");
  const port = Number(env.LIVELECTURE_SPIKE_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid local port.");
  if (!env.SCRIBE_SYNTHETIC_PCM || env.SCRIBE_SYNTHETIC_AUDIO_CONFIRMED !== "synthetic-speech-only")
    throw new Error("An explicitly confirmed synthetic PCM speech fixture is required.");
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("A server-side transcription key is required.");
  return {
    hostname: "127.0.0.1",
    port,
    extensionId,
    apiKey,
    capability: randomBytes(16).toString("hex"),
    fixture: path.resolve(env.SCRIBE_SYNTHETIC_PCM),
    tree: source.tree,
  };
}
export function childEnvironments(plan, env, artifact) {
  const common = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP"])
    if (env[key] !== undefined) common[key] = env[key];
  const capability = {
    LIVELECTURE_SPIKE_CAPABILITY: plan.capability,
    LIVELECTURE_EXTENSION_ID: plan.extensionId,
    RUN_PAID_SCRIBE_SMOKE: COST_ACK,
  };
  return {
    build: { ...common, LIVELECTURE_ASSISTANCE_PROVIDER: "prewritten" },
    server: {
      ...common,
      ...capability,
      ELEVENLABS_API_KEY: plan.apiKey,
      LIVE_SCRIBE_SPIKE_ENABLED: "true",
    },
    harness: {
      ...common,
      ...capability,
      LIVELECTURE_SPIKE_ORIGIN: "http://127.0.0.1:" + plan.port,
      SCRIBE_SYNTHETIC_PCM: plan.fixture,
      SCRIBE_SYNTHETIC_AUDIO_CONFIRMED: "synthetic-speech-only",
      SCRIBE_TRANSPORT_ARTIFACT: artifact.path,
      SCRIBE_TRANSPORT_HASH: artifact.hash,
    },
  };
}
function childExit(child) {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve(child.exitCode ?? 1);
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Smoke child could not start.")));
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
async function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode || !child.pid) return;
  const ended = childExit(child).catch(() => 1);
  child.kill();
  const force = setTimeout(() => child.kill("SIGKILL"), 1000);
  try {
    await ended;
  } finally {
    clearTimeout(force);
  }
}
export async function runBuild(start, signals = process) {
  let child, timer, interrupt;
  const cancelled = new Promise((_, reject) => {
    interrupt = () => reject(new Error("The isolated smoke build was cancelled."));
    signals.once("SIGINT", interrupt);
    signals.once("SIGTERM", interrupt);
    timer = setTimeout(interrupt, 60_000);
  });
  try {
    child = start();
    const code = await Promise.race([childExit(child), cancelled]);
    if (code !== 0) throw new Error("The isolated smoke build failed.");
  } finally {
    clearTimeout(timer);
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", interrupt);
    if (child) await terminateChild(child);
  }
}
export async function runChildren(plan, environments, dependencies) {
  const { start, ready, verifyListener } = dependencies;
  const children = [];
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  let timer;
  const expired = new Promise((_, reject) => {
    const fail = () => reject(new Error("Smoke interrupted or timed out."));
    controller.signal.addEventListener("abort", fail, { once: true });
    timer = setTimeout(interrupt, 150_000);
  });
  try {
    const work = async () => {
      const server = start(
        "server",
        ["start", "--hostname", "127.0.0.1", "--port", String(plan.port)],
        environments.server,
      );
      children.push(server);
      const serverExit = childExit(server).then(() => {
        throw new Error("Smoke server exited.");
      });
      return await Promise.race([
        serverExit,
        (async () => {
          await ready(plan, controller.signal);
          if (controller.signal.aborted) throw new Error("Smoke cancelled.");
          await verifyListener(plan.port, server.pid); // Prove the actual listener, not just a health response.
          if (controller.signal.aborted) throw new Error("Smoke cancelled.");
          const harness = start("harness", [], environments.harness);
          children.push(harness);
          return childExit(harness);
        })(),
      ]);
    };
    return await Promise.race([work(), expired]);
  } finally {
    controller.abort();
    clearTimeout(timer);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    await Promise.all(children.map(terminateChild));
  }
}
async function ready(plan, signal) {
  const until = Date.now() + 30000;
  while (!signal.aborted && Date.now() < until) {
    try {
      const response = await fetch(
        "http://127.0.0.1:" + plan.port + "/api/providers/elevenlabs/realtime-token",
        {
          method: "HEAD",
          headers: {
            Origin: "chrome-extension://" + plan.extensionId,
            "x-livelecture-spike-capability": plan.capability,
          },
          signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
          redirect: "error",
        },
      );
      if (response.status === 204) return;
    } catch {
      /* wait for this server */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The authorized local token route did not become ready.");
}
function verifyListener(port, pid) {
  if (process.platform !== "win32")
    throw new Error("This smoke's OS listener check currently requires Windows.");
  const script =
    "$r = @(Get-NetTCPConnection -State Listen -LocalPort " +
    port +
    " -ErrorAction Stop); if ($r.Count -eq 1 -and $r[0].LocalAddress -eq '127.0.0.1' -and $r[0].OwningProcess -eq " +
    Number(pid) +
    ") { 'verified' }";
  const result = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true, timeout: 5000 },
  );
  if (result.trim() !== "verified") throw new Error("The server listener could not be verified.");
  console.log("Verified this server's listener: 127.0.0.1:" + port);
}
async function removeTemporary(temporary) {
  const resolved = path.resolve(temporary);
  if (
    path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
    !path.basename(resolved).startsWith("livelecture-scribe-")
  )
    throw new Error("Unexpected smoke temporary directory.");
  await rm(resolved, { recursive: true, force: true });
}
export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length === 0) {
    console.log(
      "Offline plan only. No credentials read or provider called. Read docs/evaluations/TASK-101-102/README.md before requesting a paid smoke.",
    );
    return 0;
  }
  if (args.length !== 1 || args[0] !== "--execute") throw new Error("Unknown smoke option.");
  if (env.RUN_PAID_SCRIBE_SMOKE !== COST_ACK || env.CI)
    throw new Error("No paid smoke authorization.");
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  const plan = buildLaunchPlan(env, {
    tree: git("rev-parse", "HEAD^{tree}"),
    dirty: git("status", "--porcelain") !== "",
  });
  // Next loads .env independently of child environment allowlists.
  for (const directory of [root, path.join(root, "web")])
    if (
      (await readdir(directory)).some(
        (name) => /^\.env(?:\.|$)/i.test(name) && name !== ".env.example",
      )
    )
      throw new Error("Local environment files are not permitted in the isolated smoke.");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "livelecture-scribe-"));
  try {
    const { build } = await import("vite");
    await build({
      configFile: false,
      envFile: false,
      logLevel: "silent",
      build: {
        target: "node24",
        outDir: temporary,
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: path.join(root, "scripts/manual/scribe-smoke-entry.ts"),
          formats: ["es"],
          fileName: () => "transport.mjs",
        },
      },
    });
    const artifact = { path: path.join(temporary, "transport.mjs"), hash: "" };
    artifact.hash = createHash("sha256")
      .update(await readFile(artifact.path))
      .digest("hex");
    const environments = childEnvironments(plan, env, artifact);
    const next = require.resolve("next/dist/bin/next");
    // Build in a key-free process so stale route code cannot be tested by accident.
    await runBuild(() =>
      spawn(process.execPath, [next, "build"], {
        cwd: path.join(root, "web"),
        env: environments.build,
        stdio: "ignore",
        windowsHide: true,
      }),
    );
    return await runChildren(plan, environments, {
      start: (kind, args, childEnv) =>
        spawn(
          process.execPath,
          kind === "server"
            ? [next, ...args]
            : [path.join(root, "scripts/manual/scribe-realtime-smoke.mjs")],
          {
            cwd: kind === "server" ? path.join(root, "web") : root,
            env: childEnv,
            stdio: kind === "harness" ? "inherit" : "ignore",
            windowsHide: true,
          },
        ),
      ready,
      verifyListener,
    });
  } finally {
    // This exact directory was returned by mkdtemp under the system temp root.
    await removeTemporary(temporary);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error("Scribe smoke refused or failed. No provider detail was logged.");
      process.exitCode = 1;
    });
