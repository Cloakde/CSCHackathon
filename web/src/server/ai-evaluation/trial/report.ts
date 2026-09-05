import type { TrialLedgerSnapshot } from "./types";
import type { TrialScenarioResult } from "./scenarios";

export function buildTrialReport(
  input: {
    sourceTree: string;
    sourceCommit: string;
    fixtureSha256: string;
    promptHashes: Record<string, string>;
    promptVersion: string;
    model: string;
    startedAt: string;
    endedAt: string;
    results: TrialScenarioResult[];
    attemptTimings: {
      attemptId: number;
      kind: string;
      scenarioId: string;
      startedAt: string;
      durationMs?: number;
    }[];
    ledger: TrialLedgerSnapshot;
  },
  secrets: readonly string[],
) {
  const report = {
    mode: "actual_provider_trial",
    ...input,
    executionStatus:
      input.results.length === 6 &&
      input.results.every((result) => result.status === "observed_for_review")
        ? "OBSERVED_FOR_REVIEW"
        : "CHANGES_REQUIRED",
    modelQuality: "HUMAN_REVIEW_PENDING",
    latencyReliability: "NOT_ESTABLISHED_BY_SMALL_TRIAL",
    browserAcceptance: "PENDING",
    learnerAndJudgeAcceptance: "PENDING",
    dataScope: "canonical_synthetic_text_only",
  };
  function redact(value: unknown): unknown {
    if (typeof value === "string")
      return secrets
        .filter(Boolean)
        .reduce((safe, secret) => safe.replaceAll(secret, "[redacted]"), value);
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
    return value;
  }
  return redact(report);
}
