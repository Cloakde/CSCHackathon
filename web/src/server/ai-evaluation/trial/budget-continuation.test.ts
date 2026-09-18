import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { LEGACY_POLICY_HASH, openTrialLedger } from "./budget";
import { TRIAL_PLAN_ID, TRIAL_POLICY_HASH, TRIAL_MODEL, TRIAL_RESERVE_MICRO_USD } from "./policy";
import {
  applicationAuthorization,
  createApplicationMeter,
} from "../../assistance/app-authorization";
import type { TrialLedger } from "./types";

const base = resolve(process.cwd(), "work", "trial-continuation-tests");
const oldTree = "1".repeat(40),
  newTree = "2".repeat(40);
const directories: string[] = [],
  opened: TrialLedger[] = [];
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const usage = { inputTokens: 1, outputTokens: 0, reportedModel: TRIAL_MODEL };
const input = {
  kind: "help_generate" as const,
  scenarioId: "synthetic",
  requestSha256: "a".repeat(64),
  requestBytes: 100,
};

function fixture() {
  mkdirSync(base, { recursive: true });
  const commonDir = mkdtempSync(join(base, "ledger-"));
  directories.push(commonDir);
  const directory = join(commonDir, "livelecture-ai-trial", TRIAL_PLAN_ID);
  mkdirSync(directory, { recursive: true });
  let original =
    JSON.stringify({
      event: "open",
      version: 1,
      planId: TRIAL_PLAN_ID,
      sourceTree: oldTree,
      policyHash: LEGACY_POLICY_HASH,
    }) + "\n";
  const append = (record: unknown) => {
    original += JSON.stringify(record) + "\n";
  };
  append({ event: "reserve", attemptId: 1, input });
  append({ event: "settle", attemptId: 1 }); // Preserve the old 105677 uncertain debit.
  append({
    event: "rebind",
    previousLedgerSha256: sha(original),
    sourceTree: oldTree,
    policyHash: TRIAL_POLICY_HASH,
  });
  append({ event: "reserve", attemptId: 2, input });
  append({ event: "settle", attemptId: 2 }); // Preserve the newer 360448 uncertain debit.
  for (let attemptId = 3; attemptId <= 31; attemptId++) {
    append({ event: "reserve", attemptId, input });
    append({
      event: "settle",
      attemptId,
      usage: { ...usage, inputTokens: attemptId === 3 ? 57908 : 4 },
    });
  }
  // 105677 + 360448 + 14477 + 28 = 480630, matching the real debit without copying its records.
  const file = join(directory, "ledger.jsonl");
  writeFileSync(file, original);
  const options = { directory, sourceTree: newTree, policyHash: TRIAL_POLICY_HASH };
  const continuation = {
    id: "offline-browser-acceptance",
    previousSourceTree: oldTree,
    previousLedgerSha256: sha(original),
    baselineAttempts: 31,
    baselineMicroUsd: 480630,
    expiresAt: Date.now() + 3_600_000,
  };
  const activation = {
    id: continuation.id,
    grantSha256: "",
  };
  const environment = {
    LIVELECTURE_APP_EXECUTE: "approved-browser-continuation-v1",
    LIVELECTURE_APP_TREE: newTree,
    LIVELECTURE_APP_POLICY: TRIAL_POLICY_HASH,
    LIVELECTURE_APP_CONTINUATION_ID: activation.id,
    LIVELECTURE_APP_CONTINUATION_HASH: activation.grantSha256,
  };
  const repository = { sourceTree: newTree, commonDir, dirty: false };
  return { commonDir, file, original, options, continuation, activation, environment, repository };
}
function open(options: Parameters<typeof openTrialLedger>[0]) {
  const ledger = openTrialLedger(options);
  opened.push(ledger);
  return ledger;
}
function grant(f: ReturnType<typeof fixture>) {
  const ledger = open({ ...f.options, continuation: f.continuation });
  f.activation.grantSha256 = ledger.snapshot().applicationContinuation!.grantSha256;
  f.environment.LIVELECTURE_APP_CONTINUATION_HASH = f.activation.grantSha256;
  expect(() => ledger.reserve(input)).toThrow("CONTINUATION_REQUIRED");
  ledger.close();
  return { ...f.options, applicationContinuation: f.activation };
}
afterEach(() => {
  for (const ledger of opened.splice(0)) {
    try {
      ledger.close();
    } catch {
      /* intentionally invalid fixtures */
    }
  }
  vi.useRealTimers();
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== base) throw Error("Unexpected test directory");
    rmSync(directory, { recursive: true, force: true });
  }
});

it("appends only once, preserves old bytes and uncertain charges, and caps exactly eight new attempts", () => {
  const f = fixture(),
    approved = grant(f);
  expect(readFileSync(f.file, "utf8").startsWith(f.original)).toBe(true);
  let ledger = open(approved);
  expect(ledger.snapshot()).toMatchObject({
    maxAttempts: 39,
    capMicroUsd: 1480630,
    totalMicroUsd: 480630,
    applicationContinuation: { id: f.activation.id },
  });
  expect(
    ledger
      .snapshot()
      .attempts.slice(0, 2)
      .map((a) => a.chargedMicroUsd),
  ).toEqual([105677, 360448]);
  for (let id = 32; id <= 39; id++) {
    expect(ledger.reserve(input)).toBe(id);
    ledger.settle(id, usage);
    ledger.close();
    ledger = open(approved);
  }
  expect(() => ledger.reserve(input)).toThrow("ATTEMPTS_EXHAUSTED");
  expect(ledger.snapshot().totalMicroUsd).toBe(480638);
});

it("keeps unknown charges and stops before the additional dollar can be exceeded", () => {
  const f = fixture(),
    ledger = open(grant(f));
  for (const id of [32, 33]) {
    expect(ledger.reserve(input)).toBe(id);
    ledger.settle(id);
  }
  expect(ledger.snapshot().totalMicroUsd).toBe(480630 + 2 * TRIAL_RESERVE_MICRO_USD);
  expect(() => ledger.reserve(input)).toThrow("BUDGET_EXHAUSTED");
});

it.each(["hash", "source", "attempts", "debit", "expired", "too_late", "extra_field"])(
  "rejects a changed %s proposal before modifying existing bytes",
  (kind) => {
    const f = fixture(),
      continuation = { ...f.continuation };
    if (kind === "hash") continuation.previousLedgerSha256 = "0".repeat(64);
    if (kind === "source") continuation.previousSourceTree = "3".repeat(40);
    if (kind === "attempts") continuation.baselineAttempts = 30;
    if (kind === "debit") continuation.baselineMicroUsd = 0;
    if (kind === "expired") continuation.expiresAt = Date.now() - 1;
    if (kind === "too_late") continuation.expiresAt = Date.now() + 90_000_000;
    if (kind === "extra_field") Object.assign(continuation, { surprise: true });
    expect(() => open({ ...f.options, continuation })).toThrow();
    expect(readFileSync(f.file, "utf8")).toBe(f.original);
  },
);

it.each(["pending", "finished", "locked", "torn", "missing"])(
  "refuses a %s ledger without renewal",
  (kind) => {
    const f = fixture();
    const content =
      kind === "pending"
        ? f.original + JSON.stringify({ event: "reserve", attemptId: 32, input }) + "\n"
        : kind === "finished"
          ? f.original + '{"event":"finish"}\n'
          : kind === "torn"
            ? f.original.slice(0, -1)
            : f.original;
    writeFileSync(f.file, content);
    if (kind === "locked")
      writeFileSync(join(f.options.directory, "ledger.lock"), "existing owner");
    if (kind === "missing") rmSync(f.file);
    expect(() =>
      open({
        ...f.options,
        continuation: { ...f.continuation, previousLedgerSha256: sha(content) },
      }),
    ).toThrow();
    if (kind !== "missing") expect(readFileSync(f.file, "utf8")).toBe(content);
  },
);

it("rejects duplicate grants, changed policy, frozen-trial opens and mismatched application activation", () => {
  const f = fixture(),
    approved = grant(f),
    before = readFileSync(f.file, "utf8");
  expect(() => open({ ...f.options, continuation: f.continuation })).toThrow();
  expect(() => open({ ...f.options, policyHash: LEGACY_POLICY_HASH })).toThrow("POLICY_MISMATCH");
  expect(() => open(f.options)).toThrow("CONTINUATION_REQUIRED");
  expect(() =>
    open({ ...approved, applicationContinuation: { ...f.activation, id: "wrong" } }),
  ).toThrow("CONTINUATION_REQUIRED");
  expect(() => open({ ...approved, sourceTree: oldTree })).toThrow("SOURCE_MISMATCH");
  expect(readFileSync(f.file, "utf8")).toBe(before);
});

it("expires reservations while letting already-started usage settle and closing all unused allowance", () => {
  vi.useFakeTimers();
  const f = fixture(),
    approved = grant(f),
    ledger = open(approved);
  const id = ledger.reserve(input);
  vi.setSystemTime(f.continuation.expiresAt + 1);
  ledger.settle(id, usage);
  expect(() => ledger.reserve(input)).toThrow("CONTINUATION_EXPIRED");
  ledger.finish();
  ledger.close();
  expect(() => open(approved)).toThrow("FINISHED");
});

it("rejects alteration of only the appended expiration against the sealed activation hash", () => {
  const f = fixture(),
    approved = grant(f);
  const entries = readFileSync(f.file, "utf8").trimEnd().split("\n");
  const event = JSON.parse(entries.at(-1)!);
  event.expiresAt += 86_400_000;
  entries[entries.length - 1] = JSON.stringify(event);
  const changed = entries.join("\n") + "\n";
  writeFileSync(f.file, changed);
  expect(() => open(approved)).toThrow("CONTINUATION_REQUIRED");
  expect(readFileSync(f.file, "utf8")).toBe(changed);
});

it("requires separate app activation and preserves the generation-verification slot guard", () => {
  const f = fixture(),
    approved = grant(f);
  expect(applicationAuthorization(f.environment, f.repository)).toEqual(approved);
  for (const patch of [
    { CI: "true" },
    { LIVELECTURE_APP_EXECUTE: "approved-one-dollar-v1" },
    { LIVELECTURE_APP_CONTINUATION_ID: "" },
    { LIVELECTURE_APP_CONTINUATION_HASH: "bad" },
  ])
    expect(() => applicationAuthorization({ ...f.environment, ...patch }, f.repository)).toThrow();
  expect(() => applicationAuthorization(f.environment, { ...f.repository, dirty: true })).toThrow();
  expect(() =>
    applicationAuthorization(f.environment, { ...f.repository, sourceTree: oldTree }),
  ).toThrow();
  const seed = open(approved);
  for (let id = 32; id <= 38; id++) {
    seed.reserve(input);
    seed.settle(id, usage);
  }
  seed.close();
  const meter = createApplicationMeter(
    () => f.environment,
    () => f.repository,
  );
  const before = readFileSync(f.file, "utf8");
  expect(() => meter.reserve(input)).toThrow("Too few attempts");
  expect(readFileSync(f.file, "utf8")).toBe(before);
  expect(meter.reserve({ ...input, kind: "help_verify" })).toBe(39);
  meter.settle(39, usage);
  meter.close();
});
