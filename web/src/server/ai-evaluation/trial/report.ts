import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { TrialLedger, TrialLedgerSnapshot } from "./types";
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
    invocation: {
      id: string;
      previousAttemptCount: number;
      scenarioPolicy: "repeat_all_cases_with_remaining_allowance";
    };
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

/** Every checkpoint is immutable; the convenience latest file is replaceable. */
export function createTrialReportWriter(directory: string) {
  const invocationId = randomUUID();
  let sequence = 0;
  function writeDurable(file: string, contents: string) {
    const fd = fs.openSync(file, "wx", 0o600);
    try {
      fs.writeFileSync(fd, contents);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
  return {
    invocationId,
    save(report: unknown) {
      sequence += 1;
      const basename = `report-${invocationId}-${String(sequence).padStart(4, "0")}`;
      try {
        const contents = `${JSON.stringify(report, null, 2)}\n`;
        writeDurable(path.join(directory, `${basename}.json`), contents);
        const latestTemporary = path.join(directory, `${basename}.latest.tmp`);
        writeDurable(latestTemporary, contents);
        fs.renameSync(latestTemporary, path.join(directory, "report.json"));
      } catch {
        throw new Error("Trial report could not be saved; preserve the ledger and checkpoints.");
      }
    },
  };
}

/** Keep a pre-seal checkpoint and always snapshot conservative final accounting. */
export function finalizeTrialRecording(
  ledger: Pick<TrialLedger, "finish" | "close">,
  save: () => void,
  complete: boolean,
) {
  let failed = false;
  try {
    save();
    if (complete) ledger.finish();
  } catch {
    failed = true;
  } finally {
    try {
      ledger.close();
    } catch {
      failed = true;
    }
    try {
      save();
    } catch {
      failed = true;
    }
  }
  if (failed)
    throw new Error("Trial finalization needs review; preserve all accounting and report files.");
}
