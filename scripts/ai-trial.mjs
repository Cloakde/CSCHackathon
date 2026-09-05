import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  TRIAL_PLAN_ID,
  TRIAL_MODEL,
  TRIAL_CAP_MICRO_USD,
  TRIAL_MAX_ATTEMPTS,
  TRIAL_RESERVE_MICRO_USD,
  TRIAL_POLICY_HASH,
} from "../web/src/server/ai-evaluation/trial/policy.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

export function trialPlan() {
  return {
    mode: "offline_plan",
    planId: TRIAL_PLAN_ID,
    model: TRIAL_MODEL,
    capUsd: TRIAL_CAP_MICRO_USD / 1_000_000,
    maximumAttempts: TRIAL_MAX_ATTEMPTS,
    conservativeReservationPerAttemptUsd: TRIAL_RESERVE_MICRO_USD / 1_000_000,
    data: "Canonical synthetic lecture text only; no audio or student data",
    execution: "Separate paid-run authorization and server-process OPENAI_API_KEY required",
    command: "npm run ai:trial -- --execute --approve-usd=1 --source-tree=EXACT_REVIEWED_TREE",
    duration: "The real-clock 1x component probes take about nine minutes plus API time",
    retention: "store:false is not zero retention; provider abuse logs may retain content",
  };
}

/** Pure preflight: never creates a ledger or contacts a provider. */
export function prepareTrialExecution(args, env, repository) {
  const sourceArgument = args.find((arg) => /^--source-tree=[a-f0-9]{40}$/.test(arg));
  if (
    args.length !== 3 ||
    !args.includes("--execute") ||
    !args.includes("--approve-usd=1") ||
    !sourceArgument
  )
    throw new Error("Execution needs --execute --approve-usd=1 --source-tree=EXACT_REVIEWED_TREE.");
  if (env.CI) throw new Error("Paid trial execution is disabled in CI.");
  if (repository.dirty) throw new Error("Use the clean, independently reviewed source tree.");
  const sourceTree = sourceArgument.slice("--source-tree=".length);
  if (sourceTree !== repository.sourceTree)
    throw new Error("The checkout does not match the approved source tree.");
  if (!/^[a-f0-9]{40}$/.test(repository.commit) || !path.isAbsolute(repository.commonDir))
    throw new Error("Cannot verify this repository's execution identity.");
  // Never print or persist the value. No environment files are loaded.
  if (typeof env.OPENAI_API_KEY !== "string" || !/^[\x21-\x7e]{20,512}$/.test(env.OPENAI_API_KEY))
    throw new Error("Set OPENAI_API_KEY in the server process before the authorized trial.");
  const directory = path.join(repository.commonDir, "livelecture-ai-trial", TRIAL_PLAN_ID);
  return {
    ...env,
    LIVELECTURE_AI_TRIAL_EXECUTE: "approved-one-dollar-v1",
    LIVELECTURE_AI_TRIAL_DIRECTORY: directory,
    LIVELECTURE_AI_TRIAL_TREE: sourceTree,
    LIVELECTURE_AI_TRIAL_COMMIT: repository.commit,
    LIVELECTURE_AI_TRIAL_POLICY: TRIAL_POLICY_HASH,
  };
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("Cannot verify the trial repository.");
  return result.stdout.trim();
}

export function main(args = process.argv.slice(2)) {
  if (args.length === 0 || (args.length === 1 && ["--plan", "--help"].includes(args[0]))) {
    console.log(JSON.stringify(trialPlan(), null, 2));
    return 0;
  }
  try {
    if (Number(process.versions.node.split(".")[0]) !== 24)
      throw new Error("Use the project's Node.js 24 runtime.");
    const env = prepareTrialExecution(args, process.env, {
      sourceTree: git("rev-parse", "HEAD^{tree}"),
      commit: git("rev-parse", "HEAD"),
      dirty: git("status", "--porcelain") !== "",
      commonDir: git("rev-parse", "--path-format=absolute", "--git-common-dir"),
    });
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        "scripts/ai-trial-vitest.config.ts",
      ],
      { cwd: root, env, stdio: "inherit", windowsHide: true },
    );
    if (result.error) throw new Error("Could not start the isolated trial runner.");
    return result.status ?? 1;
  } catch (error) {
    // Only locally authored preflight messages reach this boundary.
    console.error(error instanceof Error ? error.message : "Trial preflight failed.");
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main();
