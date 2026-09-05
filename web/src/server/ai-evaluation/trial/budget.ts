import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { join, resolve } from "node:path";
import {
  TRIAL_CAP_MICRO_USD,
  TRIAL_INPUT_PRICE_NUMERATOR,
  TRIAL_MAX_ATTEMPTS,
  TRIAL_MAX_INPUT_TOKENS,
  TRIAL_MAX_OUTPUT_TOKENS,
  TRIAL_MAX_REQUEST_BYTES,
  TRIAL_MODEL,
  TRIAL_OUTPUT_PRICE_NUMERATOR,
  TRIAL_PLAN_ID,
  TRIAL_POLICY_HASH,
  TRIAL_PRICE_DENOMINATOR,
  TRIAL_RESERVE_MICRO_USD,
} from "./policy";
import type { TrialAttemptInput, TrialLedger, TrialLedgerSnapshot, TrialUsage } from "./types";

type LedgerErrorCode =
  | "LOCKED"
  | "LOCK_LOST"
  | "INVALID_LEDGER"
  | "SOURCE_MISMATCH"
  | "POLICY_MISMATCH"
  | "INVALID_REQUEST"
  | "INVALID_USAGE"
  | "REQUEST_IN_FLIGHT"
  | "ALREADY_SETTLED"
  | "BUDGET_EXHAUSTED"
  | "ATTEMPTS_EXHAUSTED"
  | "FINISHED"
  | "CLOSED"
  | "IO_FAILURE";

export class TrialLedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode) {
    super(`Trial ledger stopped: ${code}.`);
    this.name = "TrialLedgerError";
    this.code = code;
  }
}

interface Header {
  event: "open";
  version: 1;
  planId: string;
  sourceTree: string;
  policyHash: string;
}

type LedgerEvent =
  | { event: "reserve"; attemptId: number; input: TrialAttemptInput }
  | { event: "settle"; attemptId: number; usage?: TrialUsage }
  | { event: "finish" };

const MAX_LEDGER_BYTES = 256 * 1_024;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,200}$/;
const SCENARIO = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SOURCE_TREE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CALL_KINDS = new Set([
  "help_generate",
  "help_verify",
  "practice_generate",
  "practice_verify",
]);

function fail(code: LedgerErrorCode): never {
  throw new TrialLedgerError(code);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}

function integer(value: unknown, maximum: number, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function validInput(value: unknown): value is TrialAttemptInput {
  return (
    record(value) &&
    keys(value, ["kind", "scenarioId", "requestSha256", "requestBytes"]) &&
    typeof value.kind === "string" &&
    CALL_KINDS.has(value.kind) &&
    typeof value.scenarioId === "string" &&
    SCENARIO.test(value.scenarioId) &&
    typeof value.requestSha256 === "string" &&
    SHA256.test(value.requestSha256) &&
    integer(value.requestBytes, TRIAL_MAX_REQUEST_BYTES, 1)
  );
}

function validUsage(value: unknown): value is TrialUsage {
  return (
    record(value) &&
    keys(value, ["inputTokens", "outputTokens", "reportedModel"], ["requestId", "responseId"]) &&
    integer(value.inputTokens, TRIAL_MAX_INPUT_TOKENS) &&
    integer(value.outputTokens, TRIAL_MAX_OUTPUT_TOKENS) &&
    value.reportedModel === TRIAL_MODEL &&
    ["requestId", "responseId"].every(
      (key) =>
        !Object.hasOwn(value, key) ||
        (typeof value[key] === "string" && IDENTIFIER.test(value[key])),
    )
  );
}

function usageCharge(usage: TrialUsage) {
  return Math.ceil(
    (usage.inputTokens * TRIAL_INPUT_PRICE_NUMERATOR +
      usage.outputTokens * TRIAL_OUTPUT_PRICE_NUMERATOR) /
      TRIAL_PRICE_DENOMINATOR,
  );
}

function initialState(header: Header): TrialLedgerSnapshot {
  return {
    version: 1,
    planId: header.planId,
    sourceTree: header.sourceTree,
    policyHash: header.policyHash,
    capMicroUsd: TRIAL_CAP_MICRO_USD,
    maxAttempts: TRIAL_MAX_ATTEMPTS,
    finished: false,
    reservedMicroUsd: 0,
    chargedMicroUsd: 0,
    totalMicroUsd: 0,
    attempts: [],
  };
}

function applyEvent(state: TrialLedgerSnapshot, event: LedgerEvent): TrialLedgerSnapshot {
  if (state.finished) fail("FINISHED");
  const next = structuredClone(state);
  const active = next.attempts.find((attempt) => attempt.status === "reserved");
  if (event.event === "reserve") {
    if (!validInput(event.input)) fail("INVALID_REQUEST");
    if (active) fail("REQUEST_IN_FLIGHT");
    if (next.attempts.length >= TRIAL_MAX_ATTEMPTS) fail("ATTEMPTS_EXHAUSTED");
    if (next.totalMicroUsd + TRIAL_RESERVE_MICRO_USD > TRIAL_CAP_MICRO_USD) {
      fail("BUDGET_EXHAUSTED");
    }
    if (event.attemptId !== next.attempts.length + 1) fail("INVALID_LEDGER");
    next.attempts.push({
      ...event.input,
      attemptId: event.attemptId,
      status: "reserved",
      reservedMicroUsd: TRIAL_RESERVE_MICRO_USD,
      chargedMicroUsd: 0,
    });
  } else if (event.event === "settle") {
    if (!active || active.attemptId !== event.attemptId) fail("ALREADY_SETTLED");
    if (event.usage !== undefined && !validUsage(event.usage)) fail("INVALID_USAGE");
    active.status = event.usage === undefined ? "uncertain" : "settled";
    active.reservedMicroUsd = 0;
    active.chargedMicroUsd =
      event.usage === undefined ? TRIAL_RESERVE_MICRO_USD : usageCharge(event.usage);
    if (event.usage !== undefined) active.usage = structuredClone(event.usage);
  } else {
    if (active) fail("REQUEST_IN_FLIGHT");
    next.finished = true;
  }
  next.reservedMicroUsd = next.attempts.reduce((sum, attempt) => sum + attempt.reservedMicroUsd, 0);
  next.chargedMicroUsd = next.attempts.reduce((sum, attempt) => sum + attempt.chargedMicroUsd, 0);
  next.totalMicroUsd = next.reservedMicroUsd + next.chargedMicroUsd;
  return next;
}

function parseLedger(contents: string, expected: Header): TrialLedgerSnapshot {
  // A torn final record must never be silently discarded, because it may be a reservation.
  if (!contents.endsWith("\n")) fail("INVALID_LEDGER");
  let entries: unknown[];
  try {
    entries = contents
      .slice(0, -1)
      .split("\n")
      .map((line) => JSON.parse(line));
  } catch {
    fail("INVALID_LEDGER");
  }
  const header = entries[0];
  if (
    !record(header) ||
    !keys(header, ["event", "version", "planId", "sourceTree", "policyHash"]) ||
    header.event !== "open" ||
    header.version !== 1 ||
    header.planId !== TRIAL_PLAN_ID
  ) {
    fail("INVALID_LEDGER");
  }
  if (header.sourceTree !== expected.sourceTree) fail("SOURCE_MISMATCH");
  if (header.policyHash !== expected.policyHash) fail("POLICY_MISMATCH");
  let state = initialState(expected);
  try {
    for (const entry of entries.slice(1)) {
      if (!record(entry)) fail("INVALID_LEDGER");
      if (entry.event === "reserve" && keys(entry, ["event", "attemptId", "input"])) {
        if (!integer(entry.attemptId, TRIAL_MAX_ATTEMPTS, 1) || !validInput(entry.input)) {
          fail("INVALID_LEDGER");
        }
        state = applyEvent(state, {
          event: "reserve",
          attemptId: entry.attemptId,
          input: entry.input,
        });
      } else if (entry.event === "settle" && keys(entry, ["event", "attemptId"], ["usage"])) {
        if (
          !integer(entry.attemptId, TRIAL_MAX_ATTEMPTS, 1) ||
          (Object.hasOwn(entry, "usage") && !validUsage(entry.usage))
        ) {
          fail("INVALID_LEDGER");
        }
        state = applyEvent(state, {
          event: "settle",
          attemptId: entry.attemptId,
          ...(entry.usage === undefined ? {} : { usage: entry.usage as TrialUsage }),
        });
      } else if (entry.event === "finish" && keys(entry, ["event"])) {
        state = applyEvent(state, { event: "finish" });
      } else {
        fail("INVALID_LEDGER");
      }
    }
  } catch {
    fail("INVALID_LEDGER");
  }
  return state;
}

function writeAndSync(fd: number, contents: string) {
  const bytes = Buffer.from(contents, "utf8");
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = fs.writeSync(fd, bytes, offset, bytes.byteLength - offset);
    if (written <= 0) fail("IO_FAILURE");
    offset += written;
  }
  fs.fsyncSync(fd);
}

/** The CLI supplies the fixed plan directory inside the repository's Git common directory. */
export function openTrialLedger(options: {
  directory: string;
  sourceTree: string;
  policyHash: string;
}): TrialLedger {
  if (options.policyHash !== TRIAL_POLICY_HASH) fail("POLICY_MISMATCH");
  if (!SOURCE_TREE.test(options.sourceTree)) fail("SOURCE_MISMATCH");
  const directory = resolve(options.directory);
  const lockPath = join(directory, "ledger.lock");
  const ledgerPath = join(directory, "ledger.jsonl");
  const lockContents = JSON.stringify({ owner: randomUUID(), pid: process.pid }) + "\n";
  const header: Header = {
    event: "open",
    version: 1,
    planId: TRIAL_PLAN_ID,
    sourceTree: options.sourceTree,
    policyHash: TRIAL_POLICY_HASH,
  };
  let lockFd: number | undefined;
  let ledgerFd: number | undefined;
  let closed = false;
  let poisoned = false;
  let state = initialState(header);
  let expectedBytes = 0;

  function assertOwnership() {
    try {
      const onDisk = fs.lstatSync(lockPath);
      const owned = fs.fstatSync(lockFd!);
      if (
        !onDisk.isFile() ||
        onDisk.ino !== owned.ino ||
        onDisk.dev !== owned.dev ||
        fs.readFileSync(lockPath, "utf8") !== lockContents
      ) {
        fail("LOCK_LOST");
      }
    } catch {
      poisoned = true;
      fail("LOCK_LOST");
    }
  }

  function assertOpen() {
    if (closed) fail("CLOSED");
    if (poisoned) fail("IO_FAILURE");
    assertOwnership();
  }

  function persist(event: LedgerEvent) {
    assertOpen();
    const next = applyEvent(state, event);
    const line = JSON.stringify(event) + "\n";
    try {
      const onDisk = fs.lstatSync(ledgerPath);
      const owned = fs.fstatSync(ledgerFd!);
      if (
        !onDisk.isFile() ||
        onDisk.ino !== owned.ino ||
        onDisk.dev !== owned.dev ||
        onDisk.size !== expectedBytes ||
        expectedBytes + Buffer.byteLength(line) > MAX_LEDGER_BYTES
      ) {
        fail("IO_FAILURE");
      }
      writeAndSync(ledgerFd!, line);
      expectedBytes += Buffer.byteLength(line);
      state = next;
    } catch {
      // Never resume after a write/fsync failure; retain the lock for explicit investigation.
      poisoned = true;
      fail("IO_FAILURE");
    }
  }

  function releaseLock() {
    assertOwnership();
    fs.closeSync(lockFd!);
    lockFd = undefined;
    fs.unlinkSync(lockPath);
  }

  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(directory).isDirectory()) fail("INVALID_LEDGER");
    try {
      lockFd = fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") fail("LOCKED");
      fail("IO_FAILURE");
    }
    try {
      writeAndSync(lockFd, lockContents);
    } catch {
      poisoned = true;
      fail("IO_FAILURE");
    }
    if (fs.existsSync(ledgerPath)) {
      const stat = fs.lstatSync(ledgerPath);
      if (!stat.isFile() || stat.size === 0 || stat.size > MAX_LEDGER_BYTES) fail("INVALID_LEDGER");
      const contents = fs.readFileSync(ledgerPath, "utf8");
      state = parseLedger(contents, header);
      expectedBytes = Buffer.byteLength(contents);
      if (state.finished) fail("FINISHED");
      ledgerFd = fs.openSync(ledgerPath, "a", 0o600);
    } else {
      ledgerFd = fs.openSync(ledgerPath, "ax", 0o600);
      try {
        const line = JSON.stringify(header) + "\n";
        writeAndSync(ledgerFd, line);
        expectedBytes = Buffer.byteLength(line);
      } catch {
        poisoned = true;
        fail("IO_FAILURE");
      }
    }
    // Only possible after an external, explicit recovery of an old lock. Never refund it.
    const interrupted = state.attempts.find((attempt) => attempt.status === "reserved");
    if (interrupted) persist({ event: "settle", attemptId: interrupted.attemptId });
  } catch (error) {
    if (ledgerFd !== undefined) fs.closeSync(ledgerFd);
    if (lockFd !== undefined) {
      if (!poisoned) releaseLock();
      else fs.closeSync(lockFd);
    }
    if (error instanceof TrialLedgerError) throw error;
    fail("IO_FAILURE");
  }

  return {
    reserve(input) {
      assertOpen();
      if (!validInput(input)) fail("INVALID_REQUEST");
      const attemptId = state.attempts.length + 1;
      persist({ event: "reserve", attemptId, input: structuredClone(input) });
      return attemptId;
    },
    settle(attemptId, usage) {
      assertOpen();
      const trustworthy = usage === undefined || validUsage(usage);
      persist({
        event: "settle",
        attemptId,
        ...(usage !== undefined && trustworthy ? { usage: structuredClone(usage) } : {}),
      });
      if (!trustworthy) fail("INVALID_USAGE");
    },
    snapshot() {
      return structuredClone(state);
    },
    finish() {
      persist({ event: "finish" });
    },
    close() {
      if (closed) return;
      try {
        assertOpen();
        const active = state.attempts.find((attempt) => attempt.status === "reserved");
        if (active) persist({ event: "settle", attemptId: active.attemptId });
        releaseLock();
      } finally {
        closed = true;
        if (ledgerFd !== undefined) fs.closeSync(ledgerFd);
        if (lockFd !== undefined) fs.closeSync(lockFd);
      }
    },
  };
}
