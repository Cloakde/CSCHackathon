import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDemoDispatcher } from "../../demo-api";
import {
  createProviderTrialHooks,
  TRIAL_PROMPT_HASHES,
  TRIAL_PROMPT_VERSION,
} from "../../assistance/provider-trial";
import { AI_EVALUATION_CASES } from "../cases";
import { openTrialLedger } from "./budget";
import { TRIAL_MODEL, TRIAL_POLICY_HASH } from "./policy";
import type { TrialMeter, TrialCallKind } from "./types";
import { buildTrialReport } from "./report";
import { runStaticScenario, type TrialScenarioResult } from "./scenarios";
import { runComponentProbe } from "./component-probe";

// Deliberately outside default *.test / *.spec discovery. The separate config
// and this guard both require the explicit, approved CLI launch.
if (process.env.CI || process.env.LIVELECTURE_AI_TRIAL_EXECUTE !== "approved-one-dollar-v1")
  throw new Error("This file requires the explicitly authorized trial launcher.");

it("records the authorized synthetic trial without declaring human or browser acceptance", async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const directory = process.env.LIVELECTURE_AI_TRIAL_DIRECTORY;
  const sourceTree = process.env.LIVELECTURE_AI_TRIAL_TREE;
  const sourceCommit = process.env.LIVELECTURE_AI_TRIAL_COMMIT;
  if (
    !apiKey ||
    !directory ||
    !sourceTree ||
    !sourceCommit ||
    process.env.LIVELECTURE_AI_TRIAL_POLICY !== TRIAL_POLICY_HASH
  )
    throw new Error("Missing verified trial execution identity.");
  const ledger = openTrialLedger({ directory, sourceTree, policyHash: TRIAL_POLICY_HASH });
  const startedAt = new Date().toISOString();
  const results: TrialScenarioResult[] = [];
  const active = new Set<number>();
  const attemptTimings: {
    attemptId: number;
    kind: TrialCallKind;
    scenarioId: string;
    startedAt: string;
    durationMs?: number;
  }[] = [];
  const clocks = new Map<number, number>();
  const meter: TrialMeter = {
    reserve(input) {
      const id = ledger.reserve(input);
      active.add(id);
      clocks.set(id, performance.now());
      attemptTimings.push({
        attemptId: id,
        kind: input.kind,
        scenarioId: input.scenarioId,
        startedAt: new Date().toISOString(),
      });
      return id;
    },
    settle(id, usage) {
      try {
        ledger.settle(id, usage);
      } finally {
        active.delete(id);
        const timing = attemptTimings.find((item) => item.attemptId === id);
        if (timing && timing.durationMs === undefined)
          timing.durationMs = performance.now() - clocks.get(id)!;
      }
    },
  };
  const fixtureSha256 = createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), "shared/fixtures/calculus-lecture.json")))
    .digest("hex");
  function save() {
    const report = buildTrialReport(
      {
        sourceTree: sourceTree!,
        sourceCommit: sourceCommit!,
        fixtureSha256,
        promptHashes: TRIAL_PROMPT_HASHES,
        promptVersion: TRIAL_PROMPT_VERSION,
        model: TRIAL_MODEL,
        startedAt,
        endedAt: new Date().toISOString(),
        results,
        attemptTimings,
        ledger: ledger.snapshot(),
      },
      [apiKey!],
    );
    writeFileSync(path.join(directory!, "report.json"), `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  try {
    for (const fixture of AI_EVALUATION_CASES) {
      const dispatcher = createDemoDispatcher({
        enabled: true,
        ...createProviderTrialHooks({ apiKey, meter, scenarioId: fixture.id }),
      });
      try {
        results.push(await runStaticScenario(dispatcher, fixture));
      } finally {
        dispatcher.dispose();
        save();
      }
    }

    for (const probe of [
      { fixture: AI_EVALUATION_CASES[0], nextAt: 200_000, chunkId: "chunk_calc_004" },
      { fixture: AI_EVALUATION_CASES[1], nextAt: 340_000, chunkId: "chunk_calc_007" },
    ]) {
      const dispatcher = createDemoDispatcher({
        enabled: true,
        ...createProviderTrialHooks({
          apiKey,
          meter,
          scenarioId: probe.fixture.id + "_real_clock_overlap",
        }),
      });
      try {
        results.push(await runComponentProbe(probe, dispatcher, () => active.size > 0));
      } finally {
        dispatcher.dispose();
        save();
      }
    }
    ledger.finish();
    save();
    if (results.some((result) => result.status !== "observed_for_review"))
      throw new Error(
        "Trial completed with findings; inspect the local report before further work.",
      );
  } finally {
    cleanup();
    ledger.close();
  }
});
