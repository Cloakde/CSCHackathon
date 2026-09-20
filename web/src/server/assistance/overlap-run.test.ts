import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TRIAL_POLICY_HASH, TRIAL_RESERVE_MICRO_USD } from "../ai-evaluation/trial/policy";
import type { TrialLedger, TrialAttemptInput } from "../ai-evaluation/trial/types";
import {
  applicationAuthorization,
  applicationExecutionSelected,
  createApplicationMeter,
} from "./app-authorization";
import { applicationRunPaths, openApplicationRun } from "./application-run";
import {
  syntheticRunInput as input,
  syntheticRunUsage as usage,
  syntheticRunHash as sha,
} from "./application-run.test-fixture";
import { seedClosedOverlapHistory } from "./overlap-run.test-fixture";
import {
  OVERLAP_RUN_EXPIRES_AT,
  initializeOverlapRun,
  inspectOverlapRun,
  openOverlapRun,
  overlapRunPaths,
  overlapRunPlanHash,
} from "./overlap-run";

vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return { ...actual, fsyncSync: vi.fn(actual.fsyncSync) };
});
const directories: string[] = [],
  opened: TrialLedger[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-09-18T10:00:00Z");
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const ledger of opened.splice(0)) {
    try {
      ledger.close();
    } catch {
      /* deliberately poisoned temporary accounting */
    }
  }
  vi.useRealTimers();
  for (const path of directories.splice(0)) {
    if (dirname(resolve(path)) !== resolve(tmpdir()) || !path.includes("livelecture-overlap-"))
      throw Error("Unsafe temporary cleanup.");
    fs.rmSync(path, { recursive: true, force: true });
  }
});
function fixture(initialize = true) {
  const commonDir = fs.mkdtempSync(join(tmpdir(), "livelecture-overlap-"));
  directories.push(commonDir);
  const seeded = seedClosedOverlapHistory(commonDir);
  const planHash = overlapRunPlanHash(seeded.plan);
  if (initialize) initializeOverlapRun(commonDir, seeded.plan);
  const options = { commonDir, planHash, sourceTree: seeded.plan.sourceTree };
  const environment = {
    LIVELECTURE_APP_EXECUTE: "approved-overlap-run-v1",
    LIVELECTURE_APP_TREE: options.sourceTree,
    LIVELECTURE_APP_POLICY: TRIAL_POLICY_HASH,
    LIVELECTURE_APP_RUN_HASH: planHash,
  };
  const repository = { commonDir, sourceTree: options.sourceTree, dirty: false };
  return {
    ...seeded,
    commonDir,
    options,
    environment,
    repository,
    inspect: () => inspectOverlapRun(commonDir, planHash, options.sourceTree),
  };
}
function open(f: ReturnType<typeof fixture>) {
  const ledger = openOverlapRun(f.options);
  opened.push(ledger);
  return ledger;
}
const sequences: TrialAttemptInput["kind"][][] = [
  ["help_generate", "help_generate", "help_verify"],
  ["help_generate", "help_verify", "help_generate", "help_verify"],
];

it.each(sequences.map((sequence) => [sequence]))(
  "allows the valid bounded overlap sequence %j while preserving terminal predecessors",
  (sequence) => {
    const f = fixture(),
      ledger = open(f);
    expect(ledger.snapshot()).toMatchObject({
      maxAttempts: 43,
      capMicroUsd: 1480630,
      totalMicroUsd: 484900,
      finished: false,
    });
    expect(ledger.snapshot().attempts).toHaveLength(39);
    expect(
      ledger
        .snapshot()
        .attempts.filter((entry) => entry.status === "uncertain")
        .map((entry) => entry.chargedMicroUsd),
    ).toEqual([105677, 360448]);
    for (const kind of sequence) ledger.settle(ledger.reserve({ ...input, kind }), usage);
    expect(() => ledger.reserve(input)).toThrow();
    ledger.finish();
    ledger.close();
    expect(f.inspect().state).toMatchObject({
      finished: true,
      totalMicroUsd: 484900 + sequence.length,
    });
    expect(fs.readFileSync(f.paths.predecessor, "utf8")).toBe(f.contents);
    expect(fs.readFileSync(f.previous.paths.predecessor, "utf8")).toBe(f.previous.contents);
    expect(() =>
      openApplicationRun({
        commonDir: f.commonDir,
        planHash: f.plan.predecessor.planHash,
        sourceTree: f.plan.predecessor.sourceTree,
      }),
    ).toThrow("finished");
    expect(() => open(f)).toThrow("finished");
    expect(() => initializeOverlapRun(f.commonDir, f.plan)).toThrow();
  },
);

it("does not create an allowance during ordinary opening and claims initialization exclusively", () => {
  const f = fixture(false);
  expect(() => open(f)).toThrow();
  expect(fs.existsSync(f.paths.directory)).toBe(false);
  initializeOverlapRun(f.commonDir, f.plan);
  const original = fs.readFileSync(f.paths.journal, "utf8");
  expect(() => initializeOverlapRun(f.commonDir, f.plan)).toThrow();
  expect(fs.readFileSync(f.paths.journal, "utf8")).toBe(original);
});

it.each([
  { id: "another-overlap" },
  { purpose: "practice" },
  { authorization: "new-session" },
  { additionalAttempts: 5 },
  { additionalMicroUsd: 995731 },
  { cumulativeMaxAttempts: 44 },
  { cumulativeCapMicroUsd: 1480631 },
  { expiresAt: OVERLAP_RUN_EXPIRES_AT + 1 },
  { policyHash: "0".repeat(64) },
  { unknown: true },
  { sourceTree: "bad" },
])("refuses changed fixed terms %j before initialization", (patch) => {
  const f = fixture(false);
  expect(() =>
    initializeOverlapRun(f.commonDir, { ...f.plan, ...patch } as typeof f.plan),
  ).toThrow();
  expect(fs.existsSync(f.paths.journal)).toBe(false);
});

it.each(["application", "trial"])(
  "rejects tampering or locks in the complete %s history",
  (which) => {
    const f = fixture(false);
    const paths = which === "application" ? f.paths : applicationRunPaths(f.commonDir);
    fs.writeFileSync(paths.predecessorLock, "another owner");
    expect(() => initializeOverlapRun(f.commonDir, f.plan)).toThrow("locked");
    fs.unlinkSync(paths.predecessorLock);
    fs.appendFileSync(paths.predecessor, "\n");
    expect(() => initializeOverlapRun(f.commonDir, f.plan)).toThrow("changed");
    expect(fs.existsSync(f.paths.journal)).toBe(false);
  },
);

it("requires a finished predecessor with the exact known cumulative total and reviewed plan", () => {
  const f = fixture(false);
  const unfinished = f.contents.replace(/\{"event":"finish"\}\n$/, "");
  fs.writeFileSync(f.paths.predecessor, unfinished);
  expect(() =>
    initializeOverlapRun(f.commonDir, {
      ...f.plan,
      predecessor: { ...f.plan.predecessor, sha256: sha(unfinished) },
    }),
  ).toThrow("complete closed");
  fs.writeFileSync(f.paths.predecessor, f.contents);
  for (const patch of [
    { planHash: "0".repeat(64) },
    { sourceTree: "0".repeat(40) },
    { attempts: 38 },
    { debitMicroUsd: 0 },
  ]) {
    expect(() =>
      initializeOverlapRun(f.commonDir, {
        ...f.plan,
        predecessor: { ...f.plan.predecessor, ...patch },
      } as typeof f.plan),
    ).toThrow();
  }
  const cheaper = f.contents.replace('"inputTokens":17052', '"inputTokens":4');
  fs.writeFileSync(f.paths.predecessor, cheaper);
  expect(() =>
    initializeOverlapRun(f.commonDir, {
      ...f.plan,
      predecessor: { ...f.plan.predecessor, sha256: sha(cheaper) },
    }),
  ).toThrow("complete closed");
});

it.each(["practice_generate", "practice_verify", "help_verify"] as const)(
  "cannot begin with %s",
  (kind) => {
    const f = fixture(),
      ledger = open(f);
    expect(() => ledger.reserve({ ...input, kind })).toThrow("fixed Help");
    expect(ledger.snapshot().attempts).toHaveLength(39);
  },
);

it("bounds generation pairs, rejects a third generation and a fifth call", () => {
  const f = fixture(),
    ledger = open(f);
  for (const kind of sequences[1]!) ledger.settle(ledger.reserve({ ...input, kind }), usage);
  for (const kind of ["help_generate", "help_verify"] as const)
    expect(() => ledger.reserve({ ...input, kind })).toThrow();
  expect(ledger.snapshot().attempts).toHaveLength(43);
});

it("reserves conservative verifier budget and retains unknown spending without a refund", () => {
  const f = fixture(),
    ledger = open(f);
  const id = ledger.reserve(input);
  expect(() => open(f)).toThrow();
  ledger.close();
  expect(f.inspect().state.attempts.at(-1)).toMatchObject({
    attemptId: id,
    status: "uncertain",
    chargedMicroUsd: TRIAL_RESERVE_MICRO_USD,
  });
  const next = open(f);
  expect(() => next.reserve(input)).toThrow("Too little budget");
  next.settle(next.reserve({ ...input, kind: "help_verify" }));
  expect(() => next.reserve(input)).toThrow("Too little budget");
  expect(next.snapshot().totalMicroUsd).toBe(484900 + 2 * TRIAL_RESERVE_MICRO_USD);
});

it("keeps the full reserve for invalid usage", () => {
  const f = fixture(),
    ledger = open(f);
  expect(() => ledger.settle(ledger.reserve(input), { ...usage, reportedModel: "wrong" })).toThrow(
    "full reservation",
  );
  expect(ledger.snapshot().totalMicroUsd).toBe(484900 + TRIAL_RESERVE_MICRO_USD);
});

it("settles and closes after expiry but cannot start another request or initialize late", () => {
  const f = fixture(),
    never = fixture(false),
    ledger = open(f),
    id = ledger.reserve(input);
  vi.setSystemTime(OVERLAP_RUN_EXPIRES_AT);
  ledger.settle(id, usage);
  expect(() => ledger.reserve(input)).toThrow("expired");
  ledger.finish();
  ledger.close();
  expect(f.inspect().state.finished).toBe(true);
  expect(() => initializeOverlapRun(never.commonDir, never.plan)).toThrow("expired");
});

it.each(["predecessor", "journal", "lock", "fsync"])(
  "fails closed without reclaiming after %s uncertainty",
  (failure) => {
    const f = fixture(),
      ledger = open(f);
    if (failure === "predecessor") fs.appendFileSync(f.paths.predecessor, "\n");
    if (failure === "journal")
      fs.writeFileSync(
        f.paths.journal,
        fs.readFileSync(f.paths.journal, "utf8").replace(f.plan.helpersSha256, "e".repeat(64)),
      );
    if (failure === "lock") fs.writeFileSync(f.paths.lock, "changed owner");
    if (failure === "fsync")
      vi.mocked(fs.fsyncSync).mockImplementationOnce(() => {
        throw Error("injected disk failure");
      });
    expect(() => ledger.reserve(input)).toThrow();
    expect(() => ledger.close()).toThrow("unavailable");
    expect(fs.existsSync(f.paths.lock)).toBe(true);
    expect(() => open(f)).toThrow();
  },
);

it.each(["torn", "unknown", "unresolved", "after-finish"])(
  "rejects %s journal without repair",
  (kind) => {
    const f = fixture();
    const suffix =
      kind === "torn"
        ? "{"
        : kind === "unknown"
          ? '{"event":"renew"}\n'
          : kind === "unresolved"
            ? JSON.stringify({ event: "reserve", attemptId: 40, input }) + "\n"
            : '{"event":"finish"}\n{"event":"finish"}\n';
    fs.appendFileSync(f.paths.journal, suffix);
    const before = fs.readFileSync(f.paths.journal, "utf8");
    expect(() => open(f)).toThrow();
    expect(fs.readFileSync(f.paths.journal, "utf8")).toBe(before);
  },
);

it("requires explicit exact-source activation and closes its owned reservation", () => {
  const f = fixture();
  expect(applicationExecutionSelected(f.environment)).toBe(true);
  expect(applicationExecutionSelected({})).toBe(false);
  const meter = createApplicationMeter(
    () => f.environment,
    () => f.repository,
  );
  expect(meter.reserve(input)).toBe(40);
  meter.close();
  expect(f.inspect().state.attempts.at(-1)?.status).toBe("uncertain");
  for (const patch of [
    { CI: "true" },
    { LIVELECTURE_APP_RUN_HASH: "" },
    { LIVELECTURE_APP_EXECUTE: "" },
    { LIVELECTURE_APP_EXECUTE: "unknown" },
    { LIVELECTURE_APP_CONTINUATION_ID: "old" },
    { LIVELECTURE_APP_POLICY: "bad" },
  ])
    expect(() => applicationAuthorization({ ...f.environment, ...patch }, f.repository)).toThrow();
  for (const patch of [{ dirty: true }, { sourceTree: "b".repeat(40) }, { commonDir: "relative" }])
    expect(() => applicationAuthorization(f.environment, { ...f.repository, ...patch })).toThrow();
  for (const patch of [{ planHash: "0".repeat(64) }, { sourceTree: "0".repeat(40) }])
    expect(() => openOverlapRun({ ...f.options, ...patch })).toThrow("mismatch");
  expect(() => overlapRunPaths("relative")).toThrow();
});
