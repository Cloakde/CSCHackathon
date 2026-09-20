import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LEGACY_POLICY_HASH } from "../ai-evaluation/trial/budget";
import { TRIAL_MODEL, TRIAL_PLAN_ID, TRIAL_POLICY_HASH } from "../ai-evaluation/trial/policy";
import {
  APPLICATION_RUN_ID,
  APPLICATION_RUN_EXPIRES_AT,
  applicationRunPaths,
  type ApplicationRunPlan,
} from "./application-run";

export const syntheticRunInput = {
  kind: "help_generate" as const,
  scenarioId: "offline",
  requestBytes: 100,
  requestSha256: "a".repeat(64),
};
export const syntheticRunUsage = { inputTokens: 4, outputTokens: 0, reportedModel: TRIAL_MODEL };
export const syntheticRunHash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Temporary synthetic accounting; never copies the real trial or provider metadata. */
export function seedClosedApplicationHistory(commonDir: string, sourceTree = "a".repeat(40)) {
  const oldTree = "1".repeat(40);
  let contents = "";
  const append = (event: unknown) => {
    contents += JSON.stringify(event) + "\n";
  };
  append({
    event: "open",
    version: 1,
    planId: TRIAL_PLAN_ID,
    sourceTree: oldTree,
    policyHash: LEGACY_POLICY_HASH,
  });
  append({ event: "reserve", attemptId: 1, input: syntheticRunInput });
  append({ event: "settle", attemptId: 1 });
  append({
    event: "rebind",
    previousLedgerSha256: syntheticRunHash(contents),
    sourceTree: oldTree,
    policyHash: TRIAL_POLICY_HASH,
  });
  append({ event: "reserve", attemptId: 2, input: syntheticRunInput });
  append({ event: "settle", attemptId: 2 });
  for (let attemptId = 3; attemptId <= 31; attemptId++) {
    append({ event: "reserve", attemptId, input: syntheticRunInput });
    append({
      event: "settle",
      attemptId,
      usage: { ...syntheticRunUsage, inputTokens: attemptId === 3 ? 57908 : 4 },
    });
  }
  const continuation = {
    event: "application_continuation",
    id: "gemini-browser-20260918-v1",
    purpose: "normal-playback-browser-acceptance",
    previousLedgerSha256: syntheticRunHash(contents),
    previousSourceTree: oldTree,
    sourceTree: oldTree,
    policyHash: TRIAL_POLICY_HASH,
    baselineAttempts: 31,
    baselineMicroUsd: 480630,
    additionalAttempts: 8,
    additionalMicroUsd: 1000000,
    expiresAt: APPLICATION_RUN_EXPIRES_AT,
  };
  append(continuation);
  append({ event: "finish" });
  append({
    event: "application_zero_use_recovery",
    id: "gemini-browser-20260918-recovery-v1",
    previousLedgerSha256: syntheticRunHash(contents),
    previousSourceTree: oldTree,
    previousContinuationId: continuation.id,
    previousGrantSha256: syntheticRunHash(JSON.stringify(continuation)),
    sourceTree: oldTree,
    policyHash: TRIAL_POLICY_HASH,
    expiresAt: APPLICATION_RUN_EXPIRES_AT,
  });
  append({ event: "finish" });
  const paths = applicationRunPaths(commonDir);
  mkdirSync(dirname(paths.predecessor), { recursive: true });
  writeFileSync(paths.predecessor, contents);
  const plan: ApplicationRunPlan = {
    version: 1,
    id: APPLICATION_RUN_ID,
    purpose: "actual-gemini-browser-acceptance",
    authorization: "overnight-session-20260918",
    sourceCommit: "b".repeat(40),
    sourceTree,
    copyCommit: "c".repeat(40),
    copyTree: "d".repeat(40),
    packageManifestSha256: "e".repeat(64),
    helpersSha256: "f".repeat(64),
    ciRunId: 123,
    policyHash: TRIAL_POLICY_HASH,
    predecessor: {
      sha256: syntheticRunHash(contents),
      sourceTree: oldTree,
      attempts: 31,
      debitMicroUsd: 480630,
    },
    additionalAttempts: 8,
    additionalMicroUsd: 1000000,
    cumulativeMaxAttempts: 39,
    cumulativeCapMicroUsd: 1480630,
    expiresAt: APPLICATION_RUN_EXPIRES_AT,
  };
  return { plan, paths, contents };
}
