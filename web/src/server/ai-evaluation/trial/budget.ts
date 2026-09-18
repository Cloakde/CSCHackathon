import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { join, resolve } from "node:path";
import {
  TRIAL_CAP_MICRO_USD,
  TRIAL_INPUT_PRICE_NUMERATOR,
  TRIAL_MAX_ATTEMPTS,
  TRIAL_MAX_INPUT_TOKENS,
  TRIAL_MAX_BILLABLE_OUTPUT_TOKENS,
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
  | "CONTINUATION_REQUIRED"
  | "CONTINUATION_EXPIRED"
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

interface ApplicationContinuationEvent {
  event: "application_continuation";
  id: string;
  purpose: "normal-playback-browser-acceptance";
  previousLedgerSha256: string;
  previousSourceTree: string;
  sourceTree: string;
  policyHash: string;
  baselineAttempts: number;
  baselineMicroUsd: number;
  additionalAttempts: 8;
  additionalMicroUsd: 1_000_000;
  expiresAt: number;
}

export type ApplicationContinuationGrant = Omit<
  ApplicationContinuationEvent,
  "event" | "purpose" | "sourceTree" | "policyHash" | "additionalAttempts" | "additionalMicroUsd"
>;

interface ApplicationZeroUseRecoveryEvent {
  event: "application_zero_use_recovery";
  id: string;
  previousLedgerSha256: string;
  previousSourceTree: string;
  previousContinuationId: string;
  previousGrantSha256: string;
  sourceTree: string;
  policyHash: string;
  expiresAt: number;
}

export type ApplicationZeroUseRecoveryGrant = Omit<
  ApplicationZeroUseRecoveryEvent,
  "event" | "sourceTree" | "policyHash" | "expiresAt"
>;

type LedgerEvent =
  | { event: "reserve"; attemptId: number; input: TrialAttemptInput }
  | { event: "settle"; attemptId: number; usage?: TrialUsage }
  | { event: "finish" }
  | ApplicationContinuationEvent
  | ApplicationZeroUseRecoveryEvent
  | { event: "rebind"; previousLedgerSha256: string; sourceTree: string; policyHash: string };

// Historical accounting is immutable when replaying the same append-only ledger.
// This is the only prior policy supported for an explicit reviewed transition.
export const LEGACY_POLICY_HASH =
  "072894f04d4f90b2bd831866b1c8da2f4253c2d0610da361e5f840b02e097882";
function accounting(policyHash: string) {
  if (policyHash === TRIAL_POLICY_HASH)
    return {
      model: TRIAL_MODEL,
      outputLimit: TRIAL_MAX_BILLABLE_OUTPUT_TOKENS,
      reserve: TRIAL_RESERVE_MICRO_USD,
      inputPrice: TRIAL_INPUT_PRICE_NUMERATOR,
      outputPrice: TRIAL_OUTPUT_PRICE_NUMERATOR,
      denominator: TRIAL_PRICE_DENOMINATOR,
    };
  if (policyHash === LEGACY_POLICY_HASH)
    return {
      model: "gemini-2.5-flash-lite",
      outputLimit: 2048,
      reserve: 105677,
      inputPrice: 1,
      outputPrice: 4,
      denominator: 10,
    };
  return fail("POLICY_MISMATCH");
}
const digest = (contents: string) => createHash("sha256").update(contents).digest("hex");

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

function validUsage(value: unknown, policyHash = TRIAL_POLICY_HASH): value is TrialUsage {
  const policy = accounting(policyHash);
  return (
    record(value) &&
    keys(value, ["inputTokens", "outputTokens", "reportedModel"], ["requestId", "responseId"]) &&
    integer(value.inputTokens, TRIAL_MAX_INPUT_TOKENS) &&
    integer(value.outputTokens, policy.outputLimit) &&
    value.reportedModel === policy.model &&
    ["requestId", "responseId"].every(
      (key) =>
        !Object.hasOwn(value, key) ||
        (typeof value[key] === "string" && IDENTIFIER.test(value[key])),
    )
  );
}

function usageCharge(usage: TrialUsage, policyHash: string) {
  const policy = accounting(policyHash);
  return Math.ceil(
    (usage.inputTokens * policy.inputPrice + usage.outputTokens * policy.outputPrice) /
      policy.denominator,
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

function validContinuation(value: unknown): value is ApplicationContinuationEvent {
  return (
    record(value) &&
    keys(value, [
      "event",
      "id",
      "purpose",
      "previousLedgerSha256",
      "previousSourceTree",
      "sourceTree",
      "policyHash",
      "baselineAttempts",
      "baselineMicroUsd",
      "additionalAttempts",
      "additionalMicroUsd",
      "expiresAt",
    ]) &&
    value.event === "application_continuation" &&
    typeof value.id === "string" &&
    SCENARIO.test(value.id) &&
    value.purpose === "normal-playback-browser-acceptance" &&
    typeof value.previousLedgerSha256 === "string" &&
    SHA256.test(value.previousLedgerSha256) &&
    typeof value.previousSourceTree === "string" &&
    SOURCE_TREE.test(value.previousSourceTree) &&
    typeof value.sourceTree === "string" &&
    SOURCE_TREE.test(value.sourceTree) &&
    value.policyHash === TRIAL_POLICY_HASH &&
    integer(value.baselineAttempts, TRIAL_MAX_ATTEMPTS) &&
    integer(value.baselineMicroUsd, TRIAL_CAP_MICRO_USD) &&
    value.additionalAttempts === 8 &&
    value.additionalMicroUsd === 1_000_000 &&
    integer(value.expiresAt, Number.MAX_SAFE_INTEGER, 1)
  );
}

function validZeroUseRecovery(value: unknown): value is ApplicationZeroUseRecoveryEvent {
  return (
    record(value) &&
    keys(value, [
      "event",
      "id",
      "previousLedgerSha256",
      "previousSourceTree",
      "previousContinuationId",
      "previousGrantSha256",
      "sourceTree",
      "policyHash",
      "expiresAt",
    ]) &&
    value.event === "application_zero_use_recovery" &&
    typeof value.id === "string" &&
    SCENARIO.test(value.id) &&
    typeof value.previousContinuationId === "string" &&
    SCENARIO.test(value.previousContinuationId) &&
    typeof value.previousLedgerSha256 === "string" &&
    SHA256.test(value.previousLedgerSha256) &&
    typeof value.previousGrantSha256 === "string" &&
    SHA256.test(value.previousGrantSha256) &&
    typeof value.previousSourceTree === "string" &&
    SOURCE_TREE.test(value.previousSourceTree) &&
    typeof value.sourceTree === "string" &&
    SOURCE_TREE.test(value.sourceTree) &&
    value.policyHash === TRIAL_POLICY_HASH &&
    integer(value.expiresAt, Number.MAX_SAFE_INTEGER, 1)
  );
}

function applyEvent(state: TrialLedgerSnapshot, event: LedgerEvent): TrialLedgerSnapshot {
  if (state.finished && event.event !== "application_zero_use_recovery") fail("FINISHED");
  const next = structuredClone(state);
  const policy = accounting(state.policyHash);
  const active = next.attempts.find((attempt) => attempt.status === "reserved");
  if (event.event === "reserve") {
    if (!validInput(event.input)) fail("INVALID_REQUEST");
    if (active) fail("REQUEST_IN_FLIGHT");
    if (next.attempts.length >= next.maxAttempts) fail("ATTEMPTS_EXHAUSTED");
    if (next.totalMicroUsd + policy.reserve > next.capMicroUsd) {
      fail("BUDGET_EXHAUSTED");
    }
    if (event.attemptId !== next.attempts.length + 1) fail("INVALID_LEDGER");
    next.attempts.push({
      ...event.input,
      attemptId: event.attemptId,
      status: "reserved",
      reservedMicroUsd: policy.reserve,
      chargedMicroUsd: 0,
    });
  } else if (event.event === "settle") {
    if (!active || active.attemptId !== event.attemptId) fail("ALREADY_SETTLED");
    if (event.usage !== undefined && !validUsage(event.usage, state.policyHash))
      fail("INVALID_USAGE");
    active.status = event.usage === undefined ? "uncertain" : "settled";
    active.reservedMicroUsd = 0;
    active.chargedMicroUsd =
      event.usage === undefined ? policy.reserve : usageCharge(event.usage, state.policyHash);
    if (event.usage !== undefined) active.usage = structuredClone(event.usage);
  } else if (event.event === "application_continuation") {
    if (active) fail("REQUEST_IN_FLIGHT");
    if (
      !validContinuation(event) ||
      state.applicationContinuation ||
      event.previousSourceTree !== state.sourceTree ||
      state.policyHash !== TRIAL_POLICY_HASH ||
      event.baselineAttempts !== state.attempts.length ||
      event.baselineMicroUsd !== state.totalMicroUsd
    )
      fail("INVALID_LEDGER");
    next.sourceTree = event.sourceTree;
    next.maxAttempts = event.baselineAttempts + event.additionalAttempts;
    next.capMicroUsd = event.baselineMicroUsd + event.additionalMicroUsd;
    next.applicationContinuation = {
      id: event.id,
      previousLedgerSha256: event.previousLedgerSha256,
      grantSha256: digest(JSON.stringify(event)),
      expiresAt: event.expiresAt,
    };
  } else if (event.event === "application_zero_use_recovery") {
    const grant = state.applicationContinuation;
    if (
      !validZeroUseRecovery(event) ||
      !state.finished ||
      active ||
      !grant ||
      grant.zeroUseRecovered ||
      state.attempts.length !== state.maxAttempts - 8 ||
      state.totalMicroUsd !== state.capMicroUsd - 1_000_000 ||
      event.previousSourceTree !== state.sourceTree ||
      state.policyHash !== TRIAL_POLICY_HASH ||
      event.previousContinuationId !== grant.id ||
      event.previousGrantSha256 !== grant.grantSha256 ||
      event.id === grant.id ||
      event.expiresAt !== grant.expiresAt
    )
      fail("INVALID_LEDGER");
    // Transfer the unused allowance once. No history, ceiling or deadline is reset.
    next.sourceTree = event.sourceTree;
    next.finished = false;
    next.applicationContinuation = {
      id: event.id,
      previousLedgerSha256: event.previousLedgerSha256,
      grantSha256: digest(JSON.stringify(event)),
      expiresAt: grant.expiresAt,
      zeroUseRecovered: true,
    };
  } else if (event.event === "rebind") {
    if (active) fail("REQUEST_IN_FLIGHT");
    if (state.applicationContinuation) fail("SOURCE_MISMATCH");
    if (!SOURCE_TREE.test(event.sourceTree)) fail("SOURCE_MISMATCH");
    if (event.policyHash !== TRIAL_POLICY_HASH) fail("POLICY_MISMATCH");
    if (!SHA256.test(event.previousLedgerSha256)) fail("INVALID_LEDGER");
    next.sourceTree = event.sourceTree;
    next.policyHash = event.policyHash;
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
  if (typeof header.sourceTree !== "string" || !SOURCE_TREE.test(header.sourceTree))
    fail("SOURCE_MISMATCH");
  if (typeof header.policyHash !== "string") fail("POLICY_MISMATCH");
  accounting(header.policyHash);
  let state = initialState(header as unknown as Header);
  try {
    for (const [offset, entry] of entries.slice(1).entries()) {
      if (!record(entry)) fail("INVALID_LEDGER");
      if (entry.event === "reserve" && keys(entry, ["event", "attemptId", "input"])) {
        if (!integer(entry.attemptId, state.maxAttempts, 1) || !validInput(entry.input)) {
          fail("INVALID_LEDGER");
        }
        state = applyEvent(state, {
          event: "reserve",
          attemptId: entry.attemptId,
          input: entry.input,
        });
      } else if (entry.event === "settle" && keys(entry, ["event", "attemptId"], ["usage"])) {
        if (
          !integer(entry.attemptId, state.maxAttempts, 1) ||
          (Object.hasOwn(entry, "usage") && !validUsage(entry.usage, state.policyHash))
        ) {
          fail("INVALID_LEDGER");
        }
        state = applyEvent(state, {
          event: "settle",
          attemptId: entry.attemptId,
          ...(entry.usage === undefined ? {} : { usage: entry.usage as TrialUsage }),
        });
      } else if (
        (entry.event === "application_continuation" && validContinuation(entry)) ||
        (entry.event === "application_zero_use_recovery" && validZeroUseRecovery(entry))
      ) {
        const prefix =
          contents
            .split("\n")
            .slice(0, offset + 1)
            .join("\n") + "\n";
        if (entry.previousLedgerSha256 !== digest(prefix)) fail("INVALID_LEDGER");
        state = applyEvent(state, entry);
      } else if (
        entry.event === "rebind" &&
        keys(entry, ["event", "previousLedgerSha256", "sourceTree", "policyHash"])
      ) {
        const prefix =
          contents
            .split("\n")
            .slice(0, offset + 1)
            .join("\n") + "\n";
        if (
          entry.previousLedgerSha256 !== digest(prefix) ||
          typeof entry.sourceTree !== "string" ||
          typeof entry.policyHash !== "string"
        )
          fail("INVALID_LEDGER");
        state = applyEvent(state, {
          event: "rebind",
          previousLedgerSha256: entry.previousLedgerSha256 as string,
          sourceTree: entry.sourceTree,
          policyHash: entry.policyHash,
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
  if (state.sourceTree !== expected.sourceTree) fail("SOURCE_MISMATCH");
  if (state.policyHash !== expected.policyHash) fail("POLICY_MISMATCH");
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

/** Read-only replay for binding a separately reviewed application run to closed history. */
export function inspectTrialHistory(
  contents: string,
  expected: { sourceTree: string; policyHash: string },
): TrialLedgerSnapshot {
  if (Buffer.byteLength(contents) > MAX_LEDGER_BYTES) fail("INVALID_LEDGER");
  return parseLedger(contents, {
    event: "open",
    version: 1,
    planId: TRIAL_PLAN_ID,
    ...expected,
  });
}

export {
  validInput as validTrialInput,
  validUsage as validTrialUsage,
  usageCharge as trialUsageCharge,
};

/** The CLI supplies the fixed plan directory inside the repository's Git common directory. */
export function openTrialLedger(options: {
  directory: string;
  sourceTree: string;
  policyHash: string;
  // Only explicit offline maintenance supplies this. Ordinary app/trial startup
  // never migrates a changed source or policy, and no allowance is reset.
  migration?: {
    previousSourceTree: string;
    previousPolicyHash: string;
    previousLedgerSha256: string;
  };
  /** Explicit offline maintenance only; never inferred from ordinary startup. */
  continuation?: ApplicationContinuationGrant;
  /** One reviewed recovery of a finished grant that reserved zero new attempts. */
  zeroUseRecovery?: ApplicationZeroUseRecoveryGrant;
  /** Application-only activation. The frozen trial runner never supplies this. */
  applicationContinuation?: { id: string; grantSha256: string };
}): TrialLedger {
  if (options.policyHash !== TRIAL_POLICY_HASH) fail("POLICY_MISMATCH");
  if (!SOURCE_TREE.test(options.sourceTree)) fail("SOURCE_MISMATCH");
  const maintenanceCount = [
    options.migration,
    options.continuation,
    options.zeroUseRecovery,
  ].filter(Boolean).length;
  if (maintenanceCount > 1 || (maintenanceCount > 0 && options.applicationContinuation))
    fail("INVALID_LEDGER");
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
      const migration = options.migration;
      const continuation = options.continuation;
      const zeroUseRecovery = options.zeroUseRecovery;
      const maintenance = migration ?? continuation ?? zeroUseRecovery;
      if (
        maintenance &&
        (!SHA256.test(maintenance.previousLedgerSha256) ||
          digest(contents) !== maintenance.previousLedgerSha256)
      )
        fail("INVALID_LEDGER");
      state = parseLedger(
        contents,
        maintenance
          ? {
              ...header,
              sourceTree: maintenance.previousSourceTree,
              policyHash: migration?.previousPolicyHash ?? TRIAL_POLICY_HASH,
            }
          : header,
      );
      expectedBytes = Buffer.byteLength(contents);
      if (state.finished && !zeroUseRecovery) fail("FINISHED");
      if (state.applicationContinuation) {
        if (
          !zeroUseRecovery &&
          (maintenance ||
            options.applicationContinuation?.id !== state.applicationContinuation.id ||
            options.applicationContinuation?.grantSha256 !==
              state.applicationContinuation.grantSha256)
        )
          fail("CONTINUATION_REQUIRED");
      } else if (options.applicationContinuation) fail("CONTINUATION_REQUIRED");
      if (
        continuation &&
        (!Number.isSafeInteger(continuation.expiresAt) ||
          continuation.expiresAt <= Date.now() ||
          continuation.expiresAt > Date.now() + 86_400_000)
      )
        fail("CONTINUATION_EXPIRED");
      if (
        zeroUseRecovery &&
        (!state.applicationContinuation || state.applicationContinuation.expiresAt <= Date.now())
      )
        fail("CONTINUATION_EXPIRED");
      ledgerFd = fs.openSync(ledgerPath, "a", 0o600);
      if (zeroUseRecovery)
        persist({
          ...zeroUseRecovery,
          event: "application_zero_use_recovery",
          sourceTree: header.sourceTree,
          policyHash: header.policyHash,
          expiresAt: state.applicationContinuation!.expiresAt,
        });
      if (continuation)
        persist({
          ...continuation,
          event: "application_continuation",
          purpose: "normal-playback-browser-acceptance",
          sourceTree: header.sourceTree,
          policyHash: header.policyHash,
          additionalAttempts: 8,
          additionalMicroUsd: 1_000_000,
        });
      if (migration)
        persist({
          event: "rebind",
          previousLedgerSha256: migration.previousLedgerSha256,
          sourceTree: header.sourceTree,
          policyHash: header.policyHash,
        });
    } else {
      if (
        options.migration ||
        options.continuation ||
        options.zeroUseRecovery ||
        options.applicationContinuation
      )
        fail("INVALID_LEDGER");
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
      if (state.applicationContinuation) {
        if (!options.applicationContinuation) fail("CONTINUATION_REQUIRED");
        if (Date.now() >= state.applicationContinuation.expiresAt) fail("CONTINUATION_EXPIRED");
      }
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
