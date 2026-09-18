import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inspectTrialHistory, openTrialLedger } from "../ai-evaluation/trial/budget";
import { TRIAL_POLICY_HASH, TRIAL_RESERVE_MICRO_USD } from "../ai-evaluation/trial/policy";
import type { TrialLedger } from "../ai-evaluation/trial/types";
import { applicationAuthorization, createApplicationMeter } from "./app-authorization";
import {
  APPLICATION_RUN_EXPIRES_AT,
  applicationRunPaths,
  applicationRunPlanHash,
  initializeApplicationRun,
  inspectApplicationRun,
  openApplicationRun,
} from "./application-run";
import {
  seedClosedApplicationHistory,
  syntheticRunInput as input,
  syntheticRunUsage as usage,
  syntheticRunHash as sha,
} from "./application-run.test-fixture";

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
      /* poisoned test journals */
    }
  }
  vi.useRealTimers();
  for (const path of directories.splice(0)) {
    if (dirname(resolve(path)) !== resolve(tmpdir()) || !path.includes("livelecture-app-run-"))
      throw new Error("Unsafe temporary test cleanup.");
    fs.rmSync(path, { recursive: true, force: true });
  }
});
function fixture(initialize = true) {
  const commonDir = fs.mkdtempSync(join(tmpdir(), "livelecture-app-run-"));
  directories.push(commonDir);
  const seeded = seedClosedApplicationHistory(commonDir);
  const planHash = applicationRunPlanHash(seeded.plan);
  if (initialize) initializeApplicationRun(commonDir, seeded.plan);
  const options = { commonDir, planHash, sourceTree: seeded.plan.sourceTree };
  const environment = {
    LIVELECTURE_APP_EXECUTE: "approved-application-run-v1",
    LIVELECTURE_APP_TREE: options.sourceTree,
    LIVELECTURE_APP_POLICY: TRIAL_POLICY_HASH,
    LIVELECTURE_APP_RUN_HASH: planHash,
  };
  const repository = { commonDir, sourceTree: options.sourceTree, dirty: false };
  const inspect = () => inspectApplicationRun(commonDir, planHash, options.sourceTree);
  return { ...seeded, commonDir, options, environment, repository, inspect };
}
function open(f: ReturnType<typeof fixture>) {
  const ledger = openApplicationRun(f.options);
  opened.push(ledger);
  return ledger;
}

it("preserves complete closed history and uncertain charges in cumulative accounting", () => {
  const f = fixture(),
    ledger = open(f);
  expect(ledger.snapshot()).toMatchObject({
    maxAttempts: 39,
    capMicroUsd: 1480630,
    totalMicroUsd: 480630,
    finished: false,
  });
  expect(ledger.snapshot().attempts).toHaveLength(31);
  const id = ledger.reserve(input);
  expect(id).toBe(32);
  ledger.settle(id, usage);
  ledger.finish();
  ledger.close();
  expect(f.inspect().state).toMatchObject({ totalMicroUsd: 480631, finished: true });
  expect(fs.readFileSync(f.paths.predecessor, "utf8")).toBe(f.contents);
  expect(
    inspectTrialHistory(f.contents, {
      sourceTree: f.plan.predecessor.sourceTree,
      policyHash: TRIAL_POLICY_HASH,
    }).finished,
  ).toBe(true);
  expect(() =>
    openTrialLedger({
      directory: dirname(f.paths.predecessor),
      sourceTree: f.plan.predecessor.sourceTree,
      policyHash: TRIAL_POLICY_HASH,
    }),
  ).toThrow("FINISHED");
});

it("requires exclusive explicit initialization and never reinitializes a finished run", () => {
  const f = fixture(false);
  expect(() => open(f)).toThrow();
  expect(fs.existsSync(f.paths.directory)).toBe(false);
  initializeApplicationRun(f.commonDir, f.plan);
  expect(() => initializeApplicationRun(f.commonDir, f.plan)).toThrow();
  const ledger = open(f);
  ledger.finish();
  ledger.close();
  const finished = fs.readFileSync(f.paths.journal, "utf8");
  expect(() => open(f)).toThrow("finished");
  expect(() => initializeApplicationRun(f.commonDir, f.plan)).toThrow();
  expect(fs.readFileSync(f.paths.journal, "utf8")).toBe(finished);
});

it.each([
  { id: "different-run" },
  { authorization: "different-session" },
  { additionalAttempts: 9 },
  { additionalMicroUsd: 1000001 },
  { cumulativeMaxAttempts: 40 },
  { cumulativeCapMicroUsd: 1480631 },
  { expiresAt: APPLICATION_RUN_EXPIRES_AT + 1 },
  { policyHash: "0".repeat(64) },
  { unknown: true },
  { sourceTree: "bad" },
])("rejects changed fixed run terms before claiming: %j", (patch) => {
  const f = fixture(false);
  expect(() =>
    initializeApplicationRun(f.commonDir, { ...f.plan, ...patch } as typeof f.plan),
  ).toThrow();
  expect(fs.existsSync(f.paths.journal)).toBe(false);
});

it("rejects missing, altered, locked or incomplete predecessor history", () => {
  const f = fixture(false);
  fs.writeFileSync(f.paths.predecessorLock, "owned elsewhere");
  expect(() => initializeApplicationRun(f.commonDir, f.plan)).toThrow("locked");
  fs.unlinkSync(f.paths.predecessorLock);
  fs.appendFileSync(f.paths.predecessor, "\n");
  expect(() => initializeApplicationRun(f.commonDir, f.plan)).toThrow("changed");
  fs.writeFileSync(f.paths.predecessor, f.contents.replace(/\{"event":"finish"\}\n$/, ""));
  const changed = fs.readFileSync(f.paths.predecessor, "utf8");
  expect(() =>
    initializeApplicationRun(f.commonDir, {
      ...f.plan,
      predecessor: { ...f.plan.predecessor, sha256: sha(changed) },
    }),
  ).toThrow("complete closed");
  fs.unlinkSync(f.paths.predecessor);
  expect(() => initializeApplicationRun(f.commonDir, f.plan)).toThrow();
  expect(fs.existsSync(f.paths.journal)).toBe(false);
});

it("binds the complete reviewed plan, source, and unchanged history on every open", () => {
  const f = fixture();
  for (const patch of [{ sourceTree: "f".repeat(40) }, { planHash: "f".repeat(64) }])
    expect(() => openApplicationRun({ ...f.options, ...patch })).toThrow("mismatch");
  fs.appendFileSync(f.paths.predecessor, "\n");
  expect(() => open(f)).toThrow("changed");
  expect(fs.existsSync(f.paths.lock)).toBe(false);
});

it("refuses concurrent processes and retains an interrupted reservation at full cost", () => {
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
  expect(f.inspect().state.totalMicroUsd).toBe(480630 + TRIAL_RESERVE_MICRO_USD);
});

it.each([
  { ...usage, reportedModel: "wrong-model" },
  { ...usage, outputTokens: 65537 },
  { ...usage, inputTokens: -1 },
])("retains full debit for untrustworthy usage: %j", (invalid) => {
  const f = fixture(),
    ledger = open(f),
    id = ledger.reserve(input);
  expect(() => ledger.settle(id, invalid)).toThrow("full reservation");
  ledger.close();
  expect(f.inspect().state.totalMicroUsd).toBe(480630 + TRIAL_RESERVE_MICRO_USD);
});

it("enforces the eight-call cumulative boundary and reserves a verifier slot", () => {
  const f = fixture(),
    ledger = open(f);
  for (let i = 0; i < 7; i++) {
    const id = ledger.reserve({ ...input, kind: "help_verify" });
    ledger.settle(id, usage);
  }
  expect(() => ledger.reserve(input)).toThrow("Too few attempts");
  const final = ledger.reserve({ ...input, kind: "practice_verify" });
  expect(final).toBe(39);
  ledger.settle(final, usage);
  expect(() => ledger.reserve({ ...input, kind: "help_verify" })).toThrow("Too few attempts");
  expect(ledger.snapshot().attempts).toHaveLength(39);
});

it("enforces the dollar ceiling and a conservative generation-plus-verification budget", () => {
  const f = fixture(),
    ledger = open(f);
  ledger.settle(ledger.reserve(input));
  expect(() => ledger.reserve(input)).toThrow("Too little budget");
  ledger.settle(ledger.reserve({ ...input, kind: "help_verify" }));
  expect(() => ledger.reserve({ ...input, kind: "help_verify" })).toThrow("Too little budget");
  expect(ledger.snapshot().totalMicroUsd).toBe(480630 + 2 * TRIAL_RESERVE_MICRO_USD);
});

it("blocks expiration while allowing settlement and terminal cleanup after the deadline", () => {
  const f = fixture(),
    ledger = open(f),
    id = ledger.reserve(input);
  vi.setSystemTime(APPLICATION_RUN_EXPIRES_AT);
  ledger.settle(id, usage);
  expect(() => ledger.reserve(input)).toThrow("expired");
  ledger.finish();
  ledger.close();
  expect(f.inspect().state.finished).toBe(true);
  const neverStarted = fixture(false);
  expect(() => initializeApplicationRun(neverStarted.commonDir, neverStarted.plan)).toThrow(
    "expired",
  );
});

it("retains the lock after a changed predecessor or same-size journal mutation", () => {
  const f = fixture(),
    ledger = open(f);
  const text = fs.readFileSync(f.paths.journal, "utf8");
  fs.writeFileSync(f.paths.journal, text.replace(f.plan.helpersSha256, "e".repeat(64)));
  expect(() => ledger.reserve(input)).toThrow("changed unexpectedly");
  expect(() => ledger.close()).toThrow("unavailable");
  expect(fs.existsSync(f.paths.lock)).toBe(true);
  expect(() => open(f)).toThrow();
});

it("fails closed on fsync uncertainty instead of releasing a possibly spent claim", () => {
  const f = fixture(),
    ledger = open(f);
  vi.mocked(fs.fsyncSync).mockImplementationOnce(() => {
    throw Error("injected disk failure");
  });
  expect(() => ledger.reserve(input)).toThrow("injected disk failure");
  expect(() => ledger.close()).toThrow("unavailable");
  expect(fs.existsSync(f.paths.lock)).toBe(true);
});

it.each(["torn", "unknown", "unresolved", "after-finish"])(
  "rejects %s journal without automatic repair",
  (kind) => {
    const f = fixture();
    const original = fs.readFileSync(f.paths.journal, "utf8");
    const suffix =
      kind === "torn"
        ? "{"
        : kind === "unknown"
          ? '{"event":"renew"}\n'
          : kind === "unresolved"
            ? JSON.stringify({ event: "reserve", attemptId: 32, input }) + "\n"
            : '{"event":"finish"}\n{"event":"finish"}\n';
    fs.appendFileSync(f.paths.journal, suffix);
    expect(() => open(f)).toThrow();
    expect(fs.readFileSync(f.paths.journal, "utf8")).toBe(original + suffix);
  },
);

it("uses explicit source-bound application activation and closes its own in-flight reservation", () => {
  const f = fixture();
  const meter = createApplicationMeter(
    () => f.environment,
    () => f.repository,
  );
  expect(meter.reserve(input)).toBe(32);
  meter.close();
  expect(f.inspect().state.attempts.at(-1)?.status).toBe("uncertain");
  expect(() => meter.reserve(input)).toThrow("unavailable");
  for (const patch of [
    { CI: "true" },
    { LIVELECTURE_APP_RUN_HASH: "" },
    { LIVELECTURE_APP_EXECUTE: "approved-one-dollar-v1" },
    { LIVELECTURE_APP_CONTINUATION_ID: "old" },
    { LIVELECTURE_APP_POLICY: "bad" },
  ])
    expect(() => applicationAuthorization({ ...f.environment, ...patch }, f.repository)).toThrow();
  expect(() => applicationAuthorization(f.environment, { ...f.repository, dirty: true })).toThrow();
  expect(() =>
    applicationAuthorization(f.environment, { ...f.repository, sourceTree: "b".repeat(40) }),
  ).toThrow();
  expect(() => applicationRunPaths("relative")).toThrow();
});
