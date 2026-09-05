import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openTrialLedger } from "./budget";
import {
  TRIAL_CAP_MICRO_USD,
  TRIAL_MAX_ATTEMPTS,
  TRIAL_MAX_INPUT_TOKENS,
  TRIAL_MAX_OUTPUT_TOKENS,
  TRIAL_MAX_REQUEST_BYTES,
  TRIAL_MODEL,
  TRIAL_PLAN_ID,
  TRIAL_POLICY_HASH,
  TRIAL_RESERVE_MICRO_USD,
} from "./policy";
import type { TrialAttemptInput, TrialLedger, TrialUsage } from "./types";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeSync: vi.fn(actual.writeSync),
    fsyncSync: vi.fn(actual.fsyncSync),
  };
});

const nativeFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const SOURCE = "1".repeat(40);
const scratchRoot = resolve(process.cwd(), "work", "trial-budget-tests");
const directories: string[] = [];
const ledgers: TrialLedger[] = [];

function directory() {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const path = fs.mkdtempSync(join(scratchRoot, "case-"));
  directories.push(path);
  return path;
}

function request(patch: Partial<TrialAttemptInput> = {}): TrialAttemptInput {
  return {
    kind: "help_generate",
    scenarioId: "inner-outer",
    requestSha256: "a".repeat(64),
    requestBytes: 128,
    ...patch,
  };
}

function usage(patch: Partial<TrialUsage> = {}): TrialUsage {
  return {
    inputTokens: 100,
    outputTokens: 10,
    reportedModel: TRIAL_MODEL,
    requestId: "req_test-123",
    responseId: "resp_test-123",
    ...patch,
  };
}

function open(path = directory()) {
  const ledger = openTrialLedger({
    directory: path,
    sourceTree: SOURCE,
    policyHash: TRIAL_POLICY_HASH,
  });
  ledgers.push(ledger);
  return ledger;
}

afterEach(() => {
  vi.mocked(fs.writeSync).mockImplementation(nativeFs.writeSync);
  vi.mocked(fs.fsyncSync).mockImplementation(nativeFs.fsyncSync);
  for (const ledger of ledgers.splice(0)) {
    try {
      ledger.close();
    } catch {
      // Tests deliberately poison instances. Only their owned scratch directory is removed.
    }
  }
  for (const path of directories.splice(0)) {
    if (!resolve(path).startsWith(scratchRoot + sep)) throw new Error("Unexpected test path.");
    fs.rmSync(path, { recursive: true, force: true });
  }
  vi.clearAllMocks();
});

// Compile the exact ledger source for child-process crash/lock checks. Only its local
// policy import is made absolute; Node 24 loads that unchanged .ts module natively.
function childModule(path: string) {
  const source = fs.readFileSync(new URL("./budget.ts", import.meta.url), "utf8");
  const policyUrl = pathToFileURL(fileURLToPath(new URL("./policy.ts", import.meta.url))).href;
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace('"./policy"', JSON.stringify(policyUrl));
  expect(compiled).toContain(policyUrl);
  const modulePath = join(path, "budget-under-test.mjs");
  fs.writeFileSync(modulePath, compiled);
  return pathToFileURL(modulePath).href;
}

function child(path: string, body: string) {
  const moduleUrl = childModule(path);
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { openTrialLedger } from ${JSON.stringify(moduleUrl)};
       const options = ${JSON.stringify({ directory: join(path, "ledger"), sourceTree: SOURCE, policyHash: TRIAL_POLICY_HASH })};
       ${body}`,
    ],
    {
      cwd: path,
      encoding: "utf8",
      timeout: 10_000,
      env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, NODE_ENV: "test" },
    },
  );
}

describe("fixed trial policy", () => {
  it("reserves the rounded full-context cost and loads without application imports", () => {
    expect(TRIAL_RESERVE_MICRO_USD).toBe(
      Math.ceil((TRIAL_MAX_INPUT_TOKENS * 2 + TRIAL_MAX_OUTPUT_TOKENS * 8) / 5),
    );
    expect(TRIAL_RESERVE_MICRO_USD).toBe(422_308);
    expect(TRIAL_CAP_MICRO_USD).toBe(1_000_000);
    expect(TRIAL_MAX_ATTEMPTS).toBe(32);
    expect(TRIAL_POLICY_HASH).toMatch(/^[a-f0-9]{64}$/);
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { TRIAL_POLICY_HASH } from ${JSON.stringify(new URL("./policy.ts", import.meta.url).href)}; console.log(TRIAL_POLICY_HASH);`,
      ],
      {
        encoding: "utf8",
        env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, NODE_ENV: "test" },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(TRIAL_POLICY_HASH);
  });
});

describe("durable trial accounting", () => {
  it("fsyncs the persisted reservation before the caller can send a request", () => {
    const path = directory();
    const ledger = open(path);
    let returned = false;
    let observedReserve = false;
    vi.mocked(fs.fsyncSync).mockImplementation((fd) => {
      nativeFs.fsyncSync(fd);
      const lines = fs.readFileSync(join(path, "ledger.jsonl"), "utf8").trim().split("\n");
      const last = JSON.parse(lines.at(-1)!);
      if (last.event === "reserve") {
        expect(returned).toBe(false);
        expect(last).toEqual({ event: "reserve", attemptId: 1, input: request() });
        observedReserve = true;
      }
    });
    expect(ledger.reserve(request())).toBe(1);
    returned = true;
    expect(observedReserve).toBe(true);
    expect(ledger.snapshot()).toMatchObject({
      reservedMicroUsd: 422_308,
      chargedMicroUsd: 0,
      totalMicroUsd: 422_308,
    });
  });

  it("reconciles only known usage at uncached rates, rounding fractional microdollars up", () => {
    const ledger = open();
    ledger.settle(ledger.reserve(request()), usage({ inputTokens: 999, outputTokens: 222 }));
    expect(ledger.snapshot()).toMatchObject({
      chargedMicroUsd: 755,
      reservedMicroUsd: 0,
      totalMicroUsd: 755,
      attempts: [{ status: "settled", chargedMicroUsd: 755, usage: { inputTokens: 999 } }],
    });
    ledger.settle(ledger.reserve(request()), usage({ inputTokens: 1, outputTokens: 0 }));
    expect(ledger.snapshot().totalMicroUsd).toBe(756);
  });

  it("never permits a third uncertain full-context charge under the one-dollar cap", () => {
    const path = directory();
    const ledger = open(path);
    ledger.settle(ledger.reserve(request()));
    ledger.settle(ledger.reserve(request()));
    const before = fs.readFileSync(join(path, "ledger.jsonl"), "utf8");
    expect(ledger.snapshot().totalMicroUsd).toBe(844_616);
    expect(() => ledger.reserve(request())).toThrow("BUDGET_EXHAUSTED");
    expect(fs.readFileSync(join(path, "ledger.jsonl"), "utf8")).toBe(before);
  });

  it("keeps the 32-attempt ceiling across restarts even when charges are tiny", () => {
    const path = directory();
    const first = open(path);
    for (let n = 0; n < 16; n++) {
      first.settle(first.reserve(request()), usage({ inputTokens: 1, outputTokens: 0 }));
    }
    first.close();
    const resumed = open(path);
    for (let n = 16; n < 32; n++) {
      resumed.settle(resumed.reserve(request()), usage({ inputTokens: 1, outputTokens: 0 }));
    }
    expect(resumed.snapshot().totalMicroUsd).toBe(32);
    expect(() => resumed.reserve(request())).toThrow("ATTEMPTS_EXHAUSTED");
    expect(resumed.snapshot().attempts).toHaveLength(32);
  });

  it("allows only one active client request and blocks late refunds for older attempts", () => {
    const ledger = open();
    const first = ledger.reserve(request());
    expect(() => ledger.reserve(request())).toThrow("REQUEST_IN_FLIGHT");
    expect(() => ledger.finish()).toThrow("REQUEST_IN_FLIGHT");
    ledger.settle(first);
    const second = ledger.reserve(request());
    const before = ledger.snapshot();
    expect(() => ledger.settle(first, usage())).toThrow("ALREADY_SETTLED");
    expect(ledger.snapshot()).toEqual(before);
    ledger.settle(second, usage());
    expect(ledger.snapshot().totalMicroUsd).toBe(422_364);
    expect(() => ledger.settle(second, usage({ inputTokens: 0, outputTokens: 0 }))).toThrow(
      "ALREADY_SETTLED",
    );
  });

  it("closes an interrupted request conservatively, resumes the same allowance, and seals completion", () => {
    const path = directory();
    const first = open(path);
    first.reserve(request());
    first.close();
    expect(() => first.settle(1, usage())).toThrow("CLOSED");
    expect(first.snapshot().attempts[0]?.status).toBe("uncertain");
    const resumed = open(path);
    expect(resumed.snapshot().totalMicroUsd).toBe(422_308);
    resumed.settle(resumed.reserve(request()), usage());
    resumed.finish();
    expect(resumed.snapshot().finished).toBe(true);
    expect(() => resumed.reserve(request())).toThrow("FINISHED");
    resumed.close();
    expect(() => open(path)).toThrow("FINISHED");
    expect(() => open(path)).toThrow("FINISHED");
    expect(fs.existsSync(join(path, "ledger.lock"))).toBe(false);
  });

  it("keeps input and snapshot mutation outside the accounting state", () => {
    const ledger = open();
    const input = request();
    ledger.reserve(input);
    input.requestBytes = 999;
    const snapshot = ledger.snapshot();
    snapshot.attempts[0]!.status = "settled";
    snapshot.attempts[0]!.reservedMicroUsd = 0;
    snapshot.totalMicroUsd = 0;
    expect(ledger.snapshot().attempts[0]?.requestBytes).toBe(128);
    expect(ledger.snapshot().totalMicroUsd).toBe(422_308);
    expect(() => ledger.reserve(request())).toThrow("REQUEST_IN_FLIGHT");
  });
});

describe("invalid or untrusted accounting input", () => {
  it.each([
    { kind: "arbitrary" },
    { requestSha256: "A".repeat(64) },
    { requestSha256: "short" },
    { requestBytes: 0 },
    { requestBytes: 1.5 },
    { requestBytes: Number.NaN },
    { requestBytes: TRIAL_MAX_REQUEST_BYTES + 1 },
    { scenarioId: "case\nextra" },
    { scenarioId: "a".repeat(129) },
    { unexpected: "field" },
  ])("rejects invalid request metadata without consuming an attempt: %j", (patch) => {
    const ledger = open();
    expect(() => ledger.reserve({ ...request(), ...patch } as TrialAttemptInput)).toThrow(
      "INVALID_REQUEST",
    );
    expect(ledger.snapshot().attempts).toEqual([]);
  });

  it.each([
    { reportedModel: "other-model" },
    { inputTokens: -1 },
    { inputTokens: 1.5 },
    { inputTokens: Number.NaN },
    { inputTokens: Number.POSITIVE_INFINITY },
    { inputTokens: TRIAL_MAX_INPUT_TOKENS + 1 },
    { outputTokens: TRIAL_MAX_OUTPUT_TOKENS + 1 },
    { outputTokens: -1 },
    { requestId: "provider body must not persist\n" },
    { responseId: "" },
    { responseId: "x".repeat(201) },
    { unexpected: "provider body must not persist" },
  ])("retains full charge and never persists malformed usage: %j", (patch) => {
    const path = directory();
    const ledger = open(path);
    const id = ledger.reserve(request());
    expect(() => ledger.settle(id, { ...usage(), ...patch })).toThrow("INVALID_USAGE");
    expect(ledger.snapshot()).toMatchObject({
      reservedMicroUsd: 0,
      chargedMicroUsd: 422_308,
      attempts: [{ status: "uncertain" }],
    });
    expect(ledger.snapshot().attempts[0]).not.toHaveProperty("usage");
    expect(fs.readFileSync(join(path, "ledger.jsonl"), "utf8")).not.toContain("provider body");
    expect(() => ledger.settle(id, usage())).toThrow("ALREADY_SETTLED");
  });

  it("rejects changed source and policy without resetting the ledger", () => {
    const path = directory();
    const ledger = open(path);
    ledger.settle(ledger.reserve(request()));
    ledger.close();
    const before = fs.readFileSync(join(path, "ledger.jsonl"), "utf8");
    expect(() =>
      openTrialLedger({
        directory: path,
        sourceTree: "2".repeat(40),
        policyHash: TRIAL_POLICY_HASH,
      }),
    ).toThrow("SOURCE_MISMATCH");
    expect(() =>
      openTrialLedger({ directory: path, sourceTree: SOURCE, policyHash: "b".repeat(64) }),
    ).toThrow("POLICY_MISMATCH");
    expect(fs.readFileSync(join(path, "ledger.jsonl"), "utf8")).toBe(before);
    expect(open(path).snapshot().totalMicroUsd).toBe(422_308);
  });

  it.each([
    "",
    "{torn",
    JSON.stringify({ event: "open", version: 1 }) + "\n",
    JSON.stringify({ event: "reserve", attemptId: 1, input: request() }) + "\n",
  ])("rejects malformed persisted state without creating a new allowance", (contents) => {
    const path = directory();
    fs.writeFileSync(join(path, "ledger.jsonl"), contents);
    expect(() => open(path)).toThrow("INVALID_LEDGER");
    expect(fs.readFileSync(join(path, "ledger.jsonl"), "utf8")).toBe(contents);
  });

  it("rejects duplicate settlements and a torn reservation during replay", () => {
    const path = directory();
    const ledger = open(path);
    ledger.settle(ledger.reserve(request()), usage());
    ledger.close();
    const journalPath = join(path, "ledger.jsonl");
    const valid = fs.readFileSync(journalPath, "utf8");
    fs.appendFileSync(
      journalPath,
      JSON.stringify({ event: "settle", attemptId: 1, usage: usage() }) + "\n",
    );
    expect(() => open(path)).toThrow("INVALID_LEDGER");
    fs.writeFileSync(journalPath, valid + '{"event":"reserve"');
    expect(() => open(path)).toThrow("INVALID_LEDGER");
  });
});

describe("exclusive locks and persistence failures", () => {
  it("rejects another process and does not remove the original owner's lock", () => {
    const path = directory();
    const ledger = open(join(path, "ledger"));
    const lock = fs.readFileSync(join(path, "ledger", "ledger.lock"), "utf8");
    const result = child(
      path,
      `try { openTrialLedger(options); process.exit(2); }
       catch (error) { console.log(error.code); process.exit(error.code === 'LOCKED' ? 0 : 3); }`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("LOCKED");
    expect(fs.readFileSync(join(path, "ledger", "ledger.lock"), "utf8")).toBe(lock);
    ledger.settle(ledger.reserve(request()), usage());
  });

  it("preserves a real exited process's reservation and refuses stale-lock recovery", () => {
    const path = directory();
    const result = child(
      path,
      `const ledger = openTrialLedger(options);
       ledger.reserve(${JSON.stringify(request())});
       console.log(ledger.snapshot().totalMicroUsd);
       process.exit(0);`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("422308");
    const ledgerDirectory = join(path, "ledger");
    const before = fs.readFileSync(join(ledgerDirectory, "ledger.jsonl"), "utf8");
    expect(() => open(ledgerDirectory)).toThrow("LOCKED");
    expect(fs.readFileSync(join(ledgerDirectory, "ledger.jsonl"), "utf8")).toBe(before);
    // Explicit recovery is simulated only for this test's owned scratch lock.
    fs.unlinkSync(join(ledgerDirectory, "ledger.lock"));
    const recovered = open(ledgerDirectory);
    expect(recovered.snapshot()).toMatchObject({
      totalMicroUsd: 422_308,
      reservedMicroUsd: 0,
      attempts: [{ status: "uncertain", chargedMicroUsd: 422_308 }],
    });
    expect(() => recovered.settle(1, usage())).toThrow("ALREADY_SETTLED");
    expect(recovered.reserve(request())).toBe(2);
  });

  it.each(["write", "fsync"])("fails closed after a reservation %s failure", (operation) => {
    const path = directory();
    const ledger = open(path);
    const failWrite = () => {
      throw new Error("private disk diagnostic");
    };
    if (operation === "write") vi.mocked(fs.writeSync).mockImplementationOnce(failWrite);
    else vi.mocked(fs.fsyncSync).mockImplementationOnce(failWrite);
    expect(() => ledger.reserve(request())).toThrow("IO_FAILURE");
    expect(() => ledger.reserve(request())).toThrow("IO_FAILURE");
    expect(() => ledger.close()).toThrow("IO_FAILURE");
    expect(fs.existsSync(join(path, "ledger.lock"))).toBe(true);
    expect(() => open(path)).toThrow("LOCKED");
  });

  it("retains the full reservation when settlement cannot be durably recorded", () => {
    const path = directory();
    const ledger = open(path);
    const attempt = ledger.reserve(request());
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => {
      throw new Error("disk unavailable");
    });
    expect(() => ledger.settle(attempt, usage())).toThrow("IO_FAILURE");
    expect(ledger.snapshot().totalMicroUsd).toBe(422_308);
    expect(() => ledger.close()).toThrow("IO_FAILURE");
    expect(() => open(path)).toThrow("LOCKED");
  });

  it("cannot release a lock whose contents have been replaced", () => {
    const path = directory();
    const ledger = open(path);
    fs.writeFileSync(join(path, "ledger.lock"), "another owner\n");
    expect(() => ledger.reserve(request())).toThrow("LOCK_LOST");
    expect(() => ledger.close()).toThrow("IO_FAILURE");
    expect(fs.readFileSync(join(path, "ledger.lock"), "utf8")).toBe("another owner\n");
  });

  it("rejects an externally truncated journal before returning another reservation", () => {
    const path = directory();
    const ledger = open(path);
    ledger.settle(ledger.reserve(request()), usage());
    fs.writeFileSync(join(path, "ledger.jsonl"), "");
    expect(() => ledger.reserve(request())).toThrow("IO_FAILURE");
    expect(() => ledger.close()).toThrow("IO_FAILURE");
    expect(() => open(path)).toThrow("LOCKED");
  });

  it("does not interpret another plan's header as an unused allowance", () => {
    const path = directory();
    fs.writeFileSync(
      join(path, "ledger.jsonl"),
      JSON.stringify({
        event: "open",
        version: 1,
        planId: TRIAL_PLAN_ID + "-other",
        sourceTree: SOURCE,
        policyHash: TRIAL_POLICY_HASH,
      }) + "\n",
    );
    expect(() => open(path)).toThrow("INVALID_LEDGER");
  });
});
