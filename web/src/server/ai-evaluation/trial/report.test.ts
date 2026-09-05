import { expect, it } from "vitest";
import { buildTrialReport } from "./report";
import type { TrialLedgerSnapshot } from "./types";

it("keeps human quality pending, missing cases visible and key values out of saved reports", () => {
  const report = buildTrialReport(
    {
      sourceTree: "a".repeat(40),
      sourceCommit: "b".repeat(40),
      fixtureSha256: "c".repeat(64),
      promptHashes: { help_generate: "d".repeat(64) },
      promptVersion: "test",
      model: "test-model",
      startedAt: "2026-09-05T00:00:00.000Z",
      endedAt: "2026-09-05T00:00:01.000Z",
      results: [],
      attemptTimings: [],
      ledger: { diagnostic: "test-secret-value" } as unknown as TrialLedgerSnapshot,
    },
    ["test-secret-value"],
  );
  expect(report).toMatchObject({
    executionStatus: "CHANGES_REQUIRED",
    modelQuality: "HUMAN_REVIEW_PENDING",
  });
  expect(JSON.stringify(report)).not.toContain("test-secret-value");
  expect(JSON.stringify(report)).toContain("[redacted]");
});
