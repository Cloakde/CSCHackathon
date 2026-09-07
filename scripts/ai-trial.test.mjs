import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prepareTrialExecution, trialPlan } from "./ai-trial.mjs";

const tree = "a".repeat(40);
const repository = {
  sourceTree: tree,
  commit: "b".repeat(40),
  dirty: false,
  commonDir: process.cwd(),
};
const args = ["--execute", "--approve-usd=1", `--source-tree=${tree}`];
const env = { GEMINI_API_KEY: "offline-placeholder-for-guard-tests" };

test("default trial plan is offline and records the fixed bounded proposal", () => {
  assert.equal(trialPlan().mode, "offline_plan");
  assert.equal(trialPlan().capUsd, 1);
  assert.equal(trialPlan().maximumAttempts, 32);
});

test("execution requires an exact cap and clean reviewed tree", () => {
  for (const invalid of [[], ["--execute"], [...args, "--retry"], args.slice(1)])
    assert.throws(() => prepareTrialExecution(invalid, env, repository));
  assert.throws(() => prepareTrialExecution(args, { ...env, CI: "true" }, repository), /CI/);
  assert.throws(() => prepareTrialExecution(args, env, { ...repository, dirty: true }), /clean/);
  assert.throws(
    () => prepareTrialExecution(args, env, { ...repository, sourceTree: "c".repeat(40) }),
    /approved/,
  );
});

test("missing credentials never appear in a preflight error", () => {
  assert.throws(() => prepareTrialExecution(args, {}, repository), /GEMINI_API_KEY/);
  const value = "private-invalid\ncredential";
  assert.throws(
    () => prepareTrialExecution(args, { GEMINI_API_KEY: value }, repository),
    (error) => !String(error).includes(value),
  );
});

test("all worktrees sharing a git directory select the same fixed allowance", () => {
  const first = prepareTrialExecution(args, env, repository);
  const second = prepareTrialExecution(args, env, { ...repository });
  assert.equal(first.LIVELECTURE_AI_TRIAL_DIRECTORY, second.LIVELECTURE_AI_TRIAL_DIRECTORY);
  assert.match(first.LIVELECTURE_AI_TRIAL_EXECUTE, /approved-one-dollar-v1/);
  assert.equal(first.LIVELECTURE_AI_TRIAL_TREE, tree);
});

test("normal tests and application launches do not select the paid trial", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(packageJson.scripts["ai:trial"], "node scripts/ai-trial.mjs");
  for (const [name, script] of Object.entries(packageJson.scripts)) {
    if (name === "ai:trial") continue;
    assert.ok(!script.includes("--execute"));
    assert.ok(!script.includes("ai-trial-vitest.config"));
  }
  const config = readFileSync(new URL("./ai-trial-vitest.config.ts", import.meta.url), "utf8");
  assert.ok(config.includes("actual.run.tsx"));
  assert.ok(!"actual.run.tsx".match(/\.(test|spec)\./));
});
