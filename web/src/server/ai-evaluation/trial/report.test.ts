import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { buildTrialReport, createTrialReportWriter, finalizeTrialRecording } from "./report";
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
      invocation: {
        id: "offline-test",
        previousAttemptCount: 0,
        scenarioPolicy: "repeat_all_cases_with_remaining_allowance",
      },
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

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    if (!path.basename(directory).startsWith("livelecture-report-test-")) throw new Error();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "livelecture-report-test-"));
  directories.push(directory);
  return directory;
}

it("preserves earlier invocation evidence when the same allowance is reopened", () => {
  const directory = temporaryDirectory();
  const first = createTrialReportWriter(directory);
  const before = { invocation: first.invocationId, timings: [123], output: "prior explanation" };
  first.save(before);
  const priorFile = fs.readdirSync(directory).find((name) => name.includes(first.invocationId))!;
  const priorBytes = fs.readFileSync(path.join(directory, priorFile), "utf8");
  const second = createTrialReportWriter(directory);
  second.save({ invocation: second.invocationId, previousAttemptCount: 1 });
  expect(second.invocationId).not.toBe(first.invocationId);
  expect(fs.readFileSync(path.join(directory, priorFile), "utf8")).toBe(priorBytes);
  expect(JSON.parse(priorBytes)).toEqual(before);
  expect(JSON.parse(fs.readFileSync(path.join(directory, "report.json"), "utf8"))).toEqual({
    invocation: second.invocationId,
    previousAttemptCount: 1,
  });
});

it("retains a durable checkpoint when publishing the latest report fails", () => {
  const directory = temporaryDirectory();
  const writer = createTrialReportWriter(directory);
  const sync = vi.spyOn(fs, "fsyncSync");
  vi.spyOn(fs, "renameSync").mockImplementation(() => {
    throw new Error("injected filesystem failure");
  });
  expect(() => writer.save({ output: "recoverable" })).toThrow("Trial report could not be saved");
  expect(sync).toHaveBeenCalledTimes(2);
  const checkpoint = fs.readdirSync(directory).find((name) => name.endsWith(".json"))!;
  expect(JSON.parse(fs.readFileSync(path.join(directory, checkpoint), "utf8"))).toEqual({
    output: "recoverable",
  });
});

it("records interrupted reservations after close and does not finish an interrupted trial", () => {
  let status = "reserved";
  const seen: string[] = [];
  const ledger = {
    finish: vi.fn(),
    close: vi.fn(() => {
      status = "uncertain";
    }),
  };
  finalizeTrialRecording(
    ledger,
    () => {
      seen.push(status);
    },
    false,
  );
  expect(ledger.finish).not.toHaveBeenCalled();
  expect(seen).toEqual(["reserved", "uncertain"]);
});

it("does not seal after a failed checkpoint and still closes and saves final accounting", () => {
  const order: string[] = [];
  let count = 0;
  const ledger = {
    finish: vi.fn(() => {
      order.push("finish");
    }),
    close: vi.fn(() => {
      order.push("close");
    }),
  };
  expect(() =>
    finalizeTrialRecording(
      ledger,
      () => {
        count += 1;
        order.push(`save${count}`);
        if (count === 1) throw new Error("injected write failure");
      },
      true,
    ),
  ).toThrow("Trial finalization needs review");
  expect(order).toEqual(["save1", "close", "save2"]);
  expect(ledger.finish).not.toHaveBeenCalled();
});

it("preserves a pre-seal snapshot if the final report write fails", () => {
  const order: string[] = [];
  let count = 0;
  const ledger = {
    finish: vi.fn(() => {
      order.push("finish");
    }),
    close: vi.fn(() => {
      order.push("close");
    }),
  };
  expect(() =>
    finalizeTrialRecording(
      ledger,
      () => {
        count += 1;
        order.push(`save${count}`);
        if (count === 2) throw new Error("injected final write failure");
      },
      true,
    ),
  ).toThrow("Trial finalization needs review");
  expect(order).toEqual(["save1", "finish", "close", "save2"]);
});
