import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * TASK-102 — orchestrates the local, capped ElevenLabs Scribe realtime spike.
 *
 * This launcher is documentation of the intended safe procedure; it has never
 * been run against a real ElevenLabs account. Nothing in this preparation
 * phase is authorized to execute it. See docs/adr/0005 and PREP_HANDOFF.md.
 *
 * Safety properties this script must hold, per TASK-102:
 *  - Generate at least 128 bits of cryptographic randomness for a one-run
 *    capability, and never print or persist it.
 *  - Pass that capability, and nothing else secret, to the smoke harness via
 *    child-process environment only — never in arguments, never in a file.
 *  - Only the Next.js server child receives ELEVENLABS_API_KEY. The harness
 *    child never does.
 *  - Bind the server explicitly to a loopback hostname; refuse anything else.
 *  - Wait for verified readiness before starting the smoke harness.
 *  - Tear down both children on success, failure, timeout, or Ctrl+C.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 250;

function requireLoopbackHostname(hostname) {
  if (hostname !== "127.0.0.1" && hostname !== "::1")
    throw new Error(`Refusing non-loopback hostname for the local spike server: ${hostname}`);
  return hostname;
}

/** Never spread `process.env` into a child. Every value a child receives is
 * named here explicitly, so a future edit cannot accidentally widen it. */
function serverChildEnv({ apiKey, capability, extensionId, hostname, port }) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "production",
    HOSTNAME: hostname,
    PORT: String(port),
    ELEVENLABS_API_KEY: apiKey,
    LIVE_SCRIBE_SPIKE_ENABLED: "true",
    LIVELECTURE_EXTENSION_ID: extensionId,
    LIVELECTURE_SPIKE_CAPABILITY: capability,
  };
}

function harnessChildEnv({ capability, hostname, port }) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "production",
    LIVELECTURE_SPIKE_CAPABILITY: capability,
    LIVELECTURE_SPIKE_ORIGIN: `http://${hostname}:${port}`,
    // Deliberately absent: ELEVENLABS_API_KEY. The harness never needs it —
    // it exercises the token route, never the provider credential directly.
  };
}

async function waitForReadiness(origin, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`, { method: "GET" });
      if (response.ok) return;
    } catch {
      // Not listening yet; keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error("The local spike server did not become ready in time.");
}

export function buildLaunchPlan(env = process.env) {
  const hostname = requireLoopbackHostname(env.LIVELECTURE_SPIKE_HOSTNAME ?? "127.0.0.1");
  const extensionId = env.LIVELECTURE_EXTENSION_ID;
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!extensionId)
    throw new Error("Set LIVELECTURE_EXTENSION_ID to this build's exact extension ID.");
  if (!apiKey) throw new Error("Set ELEVENLABS_API_KEY in this process's own environment.");
  const capability = randomBytes(16).toString("hex"); // 128 bits.
  const port = Number(env.LIVELECTURE_SPIKE_PORT ?? 3100);
  return { hostname, port, extensionId, apiKey, capability };
}

export async function main() {
  const plan = buildLaunchPlan();
  const origin = `http://${plan.hostname}:${plan.port}`;
  let server;
  let harness;
  let exitCode;

  function teardown() {
    server?.kill();
    harness?.kill();
  }
  process.once("SIGINT", () => {
    teardown();
    process.exit(130);
  });

  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/.bin/next"),
        "start",
        "--hostname",
        plan.hostname,
        "--port",
        String(plan.port),
      ],
      {
        cwd: path.join(root, "web"),
        env: serverChildEnv(plan),
        stdio: "inherit",
        windowsHide: true,
      },
    );
    await waitForReadiness(origin, Date.now() + READY_TIMEOUT_MS);

    harness = spawn(
      process.execPath,
      [path.join(root, "scripts/manual/scribe-realtime-smoke.mjs")],
      {
        cwd: root,
        env: harnessChildEnv(plan),
        stdio: "inherit",
        windowsHide: true,
      },
    );
    exitCode = await new Promise((resolve) => harness.once("exit", (code) => resolve(code ?? 1)));
  } finally {
    teardown();
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main()
    .then((code) => (process.exitCode = code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Spike launcher failed.");
      process.exitCode = 1;
    });
