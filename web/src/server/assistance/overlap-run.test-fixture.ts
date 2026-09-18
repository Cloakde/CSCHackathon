import { readFileSync } from "node:fs";
import {
  applicationRunPlanHash,
  initializeApplicationRun,
  openApplicationRun,
} from "./application-run";
import {
  seedClosedApplicationHistory,
  syntheticRunInput,
  syntheticRunUsage,
  syntheticRunHash,
} from "./application-run.test-fixture";
import {
  OVERLAP_RUN_ID,
  OVERLAP_RUN_EXPIRES_AT,
  overlapRunPaths,
  type OverlapRunPlan,
} from "./overlap-run";

/** Build both complete terminal predecessors in a temporary directory, with no real data. */
export function seedClosedOverlapHistory(commonDir: string, sourceTree = "a".repeat(40)) {
  const previous = seedClosedApplicationHistory(commonDir, "2".repeat(40));
  const previousHash = applicationRunPlanHash(previous.plan);
  initializeApplicationRun(commonDir, previous.plan);
  const ledger = openApplicationRun({
    commonDir,
    sourceTree: previous.plan.sourceTree,
    planHash: previousHash,
  });
  try {
    for (let i = 0; i < 8; i++) {
      const id = ledger.reserve({
        ...syntheticRunInput,
        kind: i % 2 === 0 ? "help_generate" : "help_verify",
      });
      ledger.settle(id, { ...syntheticRunUsage, inputTokens: i === 0 ? 17052 : 4 });
    }
    ledger.finish();
  } finally {
    ledger.close();
  }
  const contents = readFileSync(previous.paths.journal, "utf8");
  const plan: OverlapRunPlan = {
    version: 1,
    id: OVERLAP_RUN_ID,
    purpose: "actual-gemini-transcript-overlap",
    authorization: "overnight-session-20260918",
    sourceCommit: "b".repeat(40),
    sourceTree,
    packageManifestSha256: "e".repeat(64),
    helpersSha256: "f".repeat(64),
    ciRunId: 123,
    policyHash: previous.plan.policyHash,
    predecessor: {
      sha256: syntheticRunHash(contents),
      planHash: previousHash,
      sourceTree: previous.plan.sourceTree,
      attempts: 39,
      debitMicroUsd: 484900,
    },
    additionalAttempts: 4,
    additionalMicroUsd: 995730,
    cumulativeMaxAttempts: 43,
    cumulativeCapMicroUsd: 1480630,
    expiresAt: OVERLAP_RUN_EXPIRES_AT,
  };
  return { plan, paths: overlapRunPaths(commonDir), contents, previous };
}
