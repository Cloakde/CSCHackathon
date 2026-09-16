import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { afterEach, expect, it } from "vitest";
import { LEGACY_POLICY_HASH, openTrialLedger } from "./budget";
import { TRIAL_PLAN_ID, TRIAL_POLICY_HASH, TRIAL_MODEL, TRIAL_RESERVE_MICRO_USD } from "./policy";
import type { TrialLedger } from "./types";

const base = resolve(process.cwd(), "work", "trial-migration-tests");
const oldTree = "1".repeat(40),
  newTree = "2".repeat(40);
const directories: string[] = [],
  opened: TrialLedger[] = [];
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const input = {
  kind: "help_generate" as const,
  scenarioId: "synthetic",
  requestSha256: "a".repeat(64),
  requestBytes: 100,
};
function fixture(count = 1, settled = false) {
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, "ledger-"));
  directories.push(directory);
  const records: unknown[] = [
    {
      event: "open",
      version: 1,
      planId: TRIAL_PLAN_ID,
      sourceTree: oldTree,
      policyHash: LEGACY_POLICY_HASH,
    },
  ];
  for (let attemptId = 1; attemptId <= count; attemptId++)
    records.push(
      { event: "reserve", attemptId, input },
      {
        event: "settle",
        attemptId,
        ...(settled
          ? { usage: { inputTokens: 1, outputTokens: 0, reportedModel: "gemini-2.5-flash-lite" } }
          : {}),
      },
    );
  const original = records.map((record) => JSON.stringify(record) + "\n").join("");
  const file = join(directory, "ledger.jsonl");
  writeFileSync(file, original);
  const options = { directory, sourceTree: newTree, policyHash: TRIAL_POLICY_HASH };
  const migration = {
    previousSourceTree: oldTree,
    previousPolicyHash: LEGACY_POLICY_HASH,
    previousLedgerSha256: sha(original),
  };
  return { file, original, options, migration };
}
function open(options: Parameters<typeof openTrialLedger>[0]) {
  const ledger = openTrialLedger(options);
  opened.push(ledger);
  return ledger;
}
afterEach(() => {
  for (const ledger of opened.splice(0)) {
    try {
      ledger.close();
    } catch {
      /* corrupt fixtures intentionally fail */
    }
  }
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== base) throw Error("Unexpected test directory");
    rmSync(directory, { recursive: true, force: true });
  }
});

it("refuses ordinary startup on old source/policy without altering the existing allowance", () => {
  const f = fixture();
  expect(() => open(f.options)).toThrow("SOURCE_MISMATCH");
  expect(readFileSync(f.file, "utf8")).toBe(f.original);
});

it("appends a hash-bound transition, retaining old prices and attempt numbering across restart", () => {
  const f = fixture();
  const migrated = open({ ...f.options, migration: f.migration });
  expect(migrated.snapshot()).toMatchObject({
    totalMicroUsd: 105677,
    attempts: [{ status: "uncertain", chargedMicroUsd: 105677 }],
    sourceTree: newTree,
    policyHash: TRIAL_POLICY_HASH,
  });
  expect(readFileSync(f.file, "utf8").startsWith(f.original)).toBe(true);
  expect(JSON.parse(readFileSync(f.file, "utf8").trim().split("\n").at(-1)!)).toEqual({
    event: "rebind",
    previousLedgerSha256: sha(f.original),
    sourceTree: newTree,
    policyHash: TRIAL_POLICY_HASH,
  });
  migrated.close();
  const next = open(f.options);
  expect(next.reserve(input)).toBe(2);
  next.settle(2, { inputTokens: 999, outputTokens: 222, reportedModel: TRIAL_MODEL });
  expect(next.snapshot().totalMicroUsd).toBe(105677 + 583);
  next.close();
  expect(open(f.options).snapshot().totalMicroUsd).toBe(105677 + 583);
});

it("keeps legacy settled usage priced at its original rate", () => {
  const f = fixture(1, true);
  const original = f.original
    .replace('"inputTokens":1', '"inputTokens":999')
    .replace('"outputTokens":0', '"outputTokens":222');
  writeFileSync(f.file, original);
  const ledger = open({
    ...f.options,
    migration: { ...f.migration, previousLedgerSha256: sha(original) },
  });
  expect(ledger.snapshot().totalMicroUsd).toBe(189);
});

it.each(["hash", "source", "policy"])(
  "rejects an incorrect reviewed previous %s without modifying the ledger",
  (kind) => {
    const f = fixture();
    const migration = { ...f.migration };
    if (kind === "hash") migration.previousLedgerSha256 = "0".repeat(64);
    if (kind === "source") migration.previousSourceTree = "3".repeat(40);
    if (kind === "policy") migration.previousPolicyHash = "0".repeat(64);
    expect(() => open({ ...f.options, migration })).toThrow();
    expect(readFileSync(f.file, "utf8")).toBe(f.original);
  },
);

it.each(["pending", "finished", "locked"])(
  "refuses a %s ledger rather than changing its budget",
  (kind) => {
    const f = fixture();
    const content =
      kind === "pending"
        ? f.original.slice(0, f.original.lastIndexOf('{"event":"settle"'))
        : kind === "finished"
          ? f.original + '{"event":"finish"}\n'
          : f.original;
    writeFileSync(f.file, content);
    if (kind === "locked")
      writeFileSync(join(f.options.directory, "ledger.lock"), "existing owner");
    expect(() =>
      open({ ...f.options, migration: { ...f.migration, previousLedgerSha256: sha(content) } }),
    ).toThrow(
      kind === "pending" ? "REQUEST_IN_FLIGHT" : kind === "finished" ? "FINISHED" : "LOCKED",
    );
    expect(readFileSync(f.file, "utf8")).toBe(content);
  },
);

it("cannot use migration to restart the attempt ceiling", () => {
  const f = fixture(31, true);
  const ledger = open({ ...f.options, migration: f.migration });
  expect(ledger.reserve(input)).toBe(32);
  ledger.settle(32);
  expect(() => ledger.reserve(input)).toThrow("ATTEMPTS_EXHAUSTED");
  expect(ledger.snapshot().totalMicroUsd).toBe(31 + TRIAL_RESERVE_MICRO_USD);
});

it("retains old uncertain spending even when no new full reservation can fit", () => {
  const f = fixture(9);
  const ledger = open({ ...f.options, migration: f.migration });
  expect(ledger.snapshot().totalMicroUsd).toBe(9 * 105677);
  expect(() => ledger.reserve(input)).toThrow("BUDGET_EXHAUSTED");
});

it("rejects changed prior history and a repeated stale migration", () => {
  const f = fixture();
  open({ ...f.options, migration: f.migration }).close();
  expect(() => open({ ...f.options, migration: f.migration })).toThrow("INVALID_LEDGER");
  writeFileSync(
    f.file,
    readFileSync(f.file, "utf8").replace('"requestBytes":100', '"requestBytes":101'),
  );
  expect(() => open(f.options)).toThrow("INVALID_LEDGER");
});

it("does not invent a ledger when the reviewed file is missing", () => {
  const f = fixture();
  rmSync(f.file);
  expect(() => open({ ...f.options, migration: f.migration })).toThrow("INVALID_LEDGER");
  expect(existsSync(f.file)).toBe(false);
});
