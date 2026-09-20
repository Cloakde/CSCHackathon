import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { validTrialInput, validTrialUsage, trialUsageCharge } from "../ai-evaluation/trial/budget";
import { TRIAL_POLICY_HASH, TRIAL_RESERVE_MICRO_USD } from "../ai-evaluation/trial/policy";
import { applicationRunPaths, inspectApplicationRun } from "./application-run";
import type {
  TrialAttemptInput,
  TrialLedger,
  TrialLedgerSnapshot,
  TrialUsage,
} from "../ai-evaluation/trial/types";

// A single reviewed session allocation. This is deliberately not a renewal API.
export const OVERLAP_RUN_ID = "transcript-overlap-20260918-v1";
export const OVERLAP_RUN_EXPIRES_AT = Date.parse("2026-09-18T15:30:00.000Z");
const BASELINE_ATTEMPTS = 39;
const BASELINE_MICRO_USD = 484_900;
const MAX_ATTEMPTS = 43;
const CAP_MICRO_USD = 1_480_630;
const MAX_BYTES = 256 * 1024;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);

const Plan = z
  .object({
    version: z.literal(1),
    id: z.literal(OVERLAP_RUN_ID),
    purpose: z.literal("actual-gemini-transcript-overlap"),
    authorization: z.literal("overnight-session-20260918"),
    sourceCommit: revision,
    sourceTree: revision,
    packageManifestSha256: sha,
    helpersSha256: sha,
    ciRunId: z.number().int().positive().safe(),
    policyHash: z.literal(TRIAL_POLICY_HASH),
    predecessor: z
      .object({
        sha256: sha,
        planHash: sha,
        sourceTree: revision,
        attempts: z.literal(BASELINE_ATTEMPTS),
        debitMicroUsd: z.literal(BASELINE_MICRO_USD),
      })
      .strict(),
    additionalAttempts: z.literal(4),
    additionalMicroUsd: z.literal(995_730),
    cumulativeMaxAttempts: z.literal(MAX_ATTEMPTS),
    cumulativeCapMicroUsd: z.literal(CAP_MICRO_USD),
    expiresAt: z.literal(OVERLAP_RUN_EXPIRES_AT),
  })
  .strict();

export type OverlapRunPlan = z.infer<typeof Plan>;
export function overlapRunPlanHash(plan: OverlapRunPlan): string {
  return hash(JSON.stringify(Plan.parse(plan)));
}

export function overlapRunPaths(commonDir: string) {
  if (!isAbsolute(commonDir)) throw new Error("Overlap run requires an absolute Git directory.");
  const directory = join(commonDir, "livelecture-overlap-runs", OVERLAP_RUN_ID);
  const predecessor = applicationRunPaths(commonDir);
  return {
    directory,
    journal: join(directory, "journal.jsonl"),
    lock: join(directory, "run.lock"),
    predecessor: predecessor.journal,
    predecessorLock: predecessor.lock,
  };
}

function readBounded(path: string): string {
  const stat = fs.lstatSync(path);
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES)
    throw new Error("Invalid overlap accounting file.");
  // These are runtime Git accounting files, never assets to include in a build.
  return fs.readFileSync(/* turbopackIgnore: true */ path, "utf8");
}

function history(commonDir: string, plan: OverlapRunPlan) {
  const paths = overlapRunPaths(commonDir);
  if (fs.existsSync(/* turbopackIgnore: true */ paths.predecessorLock))
    throw new Error("Predecessor accounting is locked.");
  const contents = readBounded(paths.predecessor);
  if (hash(contents) !== plan.predecessor.sha256)
    throw new Error("Closed predecessor history changed.");
  const inspected = inspectApplicationRun(
    commonDir,
    plan.predecessor.planHash,
    plan.predecessor.sourceTree,
  );
  if (readBounded(paths.predecessor) !== contents)
    throw new Error("Closed predecessor history changed during inspection.");
  const previous = inspected.state;
  if (
    !previous.finished ||
    previous.attempts.length !== BASELINE_ATTEMPTS ||
    previous.totalMicroUsd !== BASELINE_MICRO_USD ||
    previous.reservedMicroUsd !== 0 ||
    previous.attempts.some((entry) => entry.status === "reserved") ||
    inspected.plan.expiresAt !== OVERLAP_RUN_EXPIRES_AT
  )
    throw new Error("Expected complete closed predecessor accounting.");
  return previous;
}

type Event =
  | { event: "reserve"; attemptId: number; input: TrialAttemptInput }
  | { event: "settle"; attemptId: number; usage?: TrialUsage }
  | { event: "finish" };

function apply(state: TrialLedgerSnapshot, event: Event) {
  if (state.finished) throw new Error("Overlap run is finished.");
  const next = structuredClone(state);
  const active = next.attempts.find((entry) => entry.status === "reserved");
  if (event.event === "reserve") {
    if (!validTrialInput(event.input)) throw new Error("Invalid overlap request.");
    if (active) throw new Error("Overlap request is in flight.");
    const kinds = [
      ...next.attempts.slice(BASELINE_ATTEMPTS).map((entry) => entry.kind),
      event.input.kind,
    ];
    const sequences = [
      ["help_generate", "help_generate", "help_verify"],
      ["help_generate", "help_verify", "help_generate", "help_verify"],
    ];
    if (
      !sequences.some(
        (sequence) =>
          kinds.length <= sequence.length && kinds.every((kind, index) => kind === sequence[index]),
      )
    )
      throw new Error("Only the fixed Help overlap sequences are allowed.");
    const pair = event.input.kind === "help_generate";
    const required = pair ? 2 : 1;
    if (next.attempts.length + required > MAX_ATTEMPTS)
      throw new Error("Too few attempts remain for the overlap operation.");
    if (next.totalMicroUsd + required * TRIAL_RESERVE_MICRO_USD > CAP_MICRO_USD)
      throw new Error("Too little budget remains for the overlap operation.");
    if (event.attemptId !== next.attempts.length + 1)
      throw new Error("Invalid overlap attempt sequence.");
    next.attempts.push({
      ...event.input,
      attemptId: event.attemptId,
      status: "reserved",
      reservedMicroUsd: TRIAL_RESERVE_MICRO_USD,
      chargedMicroUsd: 0,
    });
  } else if (event.event === "settle") {
    if (!active || active.attemptId !== event.attemptId)
      throw new Error("No matching overlap reservation.");
    if (event.usage !== undefined && !validTrialUsage(event.usage))
      throw new Error("Invalid recorded overlap usage.");
    active.status = event.usage === undefined ? "uncertain" : "settled";
    active.reservedMicroUsd = 0;
    active.chargedMicroUsd =
      event.usage === undefined
        ? TRIAL_RESERVE_MICRO_USD
        : trialUsageCharge(event.usage, TRIAL_POLICY_HASH);
    if (event.usage !== undefined) active.usage = structuredClone(event.usage);
  } else {
    if (active) throw new Error("Overlap request is in flight.");
    next.finished = true;
  }
  next.reservedMicroUsd = next.attempts.reduce((sum, entry) => sum + entry.reservedMicroUsd, 0);
  next.chargedMicroUsd = next.attempts.reduce((sum, entry) => sum + entry.chargedMicroUsd, 0);
  next.totalMicroUsd = next.reservedMicroUsd + next.chargedMicroUsd;
  return next;
}

function replay(commonDir: string, contents: string, expectedHash: string, sourceTree: string) {
  if (!contents.endsWith("\n")) throw new Error("Incomplete overlap journal.");
  const records: unknown[] = contents
    .slice(0, -1)
    .split("\n")
    .map((line) => JSON.parse(line));
  const header = z
    .object({ event: z.literal("open"), plan: Plan })
    .strict()
    .parse(records[0]);
  const plan = header.plan;
  if (overlapRunPlanHash(plan) !== expectedHash || plan.sourceTree !== sourceTree)
    throw new Error("Overlap run source or reviewed plan mismatch.");
  const previous = history(commonDir, plan);
  const snapshot = structuredClone(previous);
  delete snapshot.applicationContinuation;
  let state: TrialLedgerSnapshot = {
    ...snapshot,
    planId: OVERLAP_RUN_ID,
    sourceTree,
    finished: false,
    maxAttempts: MAX_ATTEMPTS,
    capMicroUsd: CAP_MICRO_USD,
  };
  for (const record of records.slice(1)) {
    if (!record || typeof record !== "object" || Array.isArray(record))
      throw new Error("Invalid overlap journal event.");
    const entry = record as Record<string, unknown>;
    const keys = Object.keys(entry).sort().join(",");
    if (entry.event === "reserve" && keys === "attemptId,event,input") {
      if (!Number.isSafeInteger(entry.attemptId) || !validTrialInput(entry.input))
        throw new Error("Invalid overlap reservation.");
    } else if (
      entry.event === "settle" &&
      (keys === "attemptId,event" || keys === "attemptId,event,usage")
    ) {
      if (
        !Number.isSafeInteger(entry.attemptId) ||
        (Object.hasOwn(entry, "usage") && !validTrialUsage(entry.usage))
      )
        throw new Error("Invalid overlap settlement.");
    } else if (entry.event !== "finish" || keys !== "event") {
      throw new Error("Invalid overlap journal event.");
    }
    state = apply(state, record as Event);
  }
  return { plan, state };
}

export function inspectOverlapRun(commonDir: string, planHash: string, sourceTree: string) {
  return replay(commonDir, readBounded(overlapRunPaths(commonDir).journal), planHash, sourceTree);
}

function syncWrite(fd: number, contents: string) {
  const bytes = Buffer.from(contents);
  let offset = 0;
  while (offset < bytes.length) {
    const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
    if (written <= 0) throw new Error("Overlap journal write failed.");
    offset += written;
  }
  fs.fsyncSync(fd);
}

/** Maintenance only. Durable exclusive creation is the one-run claim; never overwrites. */
export function initializeOverlapRun(commonDir: string, proposed: OverlapRunPlan) {
  const plan = Plan.parse(proposed);
  if (Date.now() >= plan.expiresAt) throw new Error("Overlap run expired.");
  history(commonDir, plan);
  const paths = overlapRunPaths(commonDir);
  fs.mkdirSync(/* turbopackIgnore: true */ paths.directory, { recursive: true, mode: 0o700 });
  if (
    !fs.lstatSync(paths.directory).isDirectory() ||
    fs.existsSync(/* turbopackIgnore: true */ paths.lock)
  )
    throw new Error("Overlap run directory is unavailable.");
  const fd = fs.openSync(/* turbopackIgnore: true */ paths.journal, "wx", 0o600);
  try {
    syncWrite(fd, JSON.stringify({ event: "open", plan }) + "\n");
  } finally {
    fs.closeSync(fd);
  }
  return overlapRunPlanHash(plan);
}

/** Opens only a previously initialized run. Holds its exclusive lock across a provider call. */
export function openOverlapRun(options: {
  commonDir: string;
  sourceTree: string;
  planHash: string;
}): TrialLedger {
  if (!/^[a-f0-9]{64}$/.test(options.planHash) || !/^[a-f0-9]{40}$/.test(options.sourceTree))
    throw new Error("Invalid overlap run activation.");
  const paths = overlapRunPaths(options.commonDir);
  const lockContents = JSON.stringify({ owner: randomUUID(), pid: process.pid }) + "\n";
  // No mkdir or initialization here: possession of credentials cannot create a grant.
  const lockFd = fs.openSync(/* turbopackIgnore: true */ paths.lock, "wx", 0o600);
  let journalFd: number | undefined;
  let poisoned = false,
    closed = false;
  let contents = "";
  let plan: OverlapRunPlan;
  let state: TrialLedgerSnapshot;

  function ownership() {
    const onDisk = fs.lstatSync(paths.lock),
      owned = fs.fstatSync(lockFd);
    if (
      !onDisk.isFile() ||
      onDisk.ino !== owned.ino ||
      onDisk.dev !== owned.dev ||
      fs.readFileSync(/* turbopackIgnore: true */ paths.lock, "utf8") !== lockContents
    )
      throw new Error("Overlap run lock was lost.");
  }
  function assertOpen() {
    if (closed || poisoned) throw new Error("Overlap journal is unavailable.");
    try {
      ownership();
    } catch (error) {
      poisoned = true;
      throw error;
    }
  }
  function persist(event: Event) {
    assertOpen();
    const next = apply(state, event);
    const line = JSON.stringify(event) + "\n";
    try {
      history(options.commonDir, plan);
      const disk = fs.lstatSync(paths.journal),
        owned = fs.fstatSync(journalFd!);
      if (
        !disk.isFile() ||
        disk.ino !== owned.ino ||
        disk.dev !== owned.dev ||
        readBounded(paths.journal) !== contents ||
        Buffer.byteLength(contents + line) > MAX_BYTES
      )
        throw new Error("Overlap journal changed unexpectedly.");
      syncWrite(journalFd!, line);
      contents += line;
      state = next;
    } catch (error) {
      poisoned = true;
      throw error;
    }
  }
  function release() {
    ownership();
    fs.unlinkSync(paths.lock);
  }
  try {
    try {
      syncWrite(lockFd, lockContents);
    } catch (error) {
      poisoned = true;
      throw error;
    }
    contents = readBounded(paths.journal);
    ({ plan, state } = replay(options.commonDir, contents, options.planHash, options.sourceTree));
    if (state.finished) throw new Error("Overlap run is finished.");
    // A crash keeps its lock/reservation; never reclaim or resume an interrupted request.
    if (state.attempts.some((entry) => entry.status === "reserved"))
      throw new Error("Overlap run has unresolved usage.");
    journalFd = fs.openSync(/* turbopackIgnore: true */ paths.journal, "a", 0o600);
  } catch (error) {
    try {
      if (!poisoned) release();
    } finally {
      fs.closeSync(lockFd);
      if (journalFd !== undefined) fs.closeSync(journalFd);
    }
    throw error;
  }
  return {
    reserve(input) {
      assertOpen();
      if (Date.now() >= plan.expiresAt) throw new Error("Overlap run expired.");
      const attemptId = state.attempts.length + 1;
      persist({ event: "reserve", attemptId, input: structuredClone(input) });
      return attemptId;
    },
    settle(attemptId, usage) {
      const valid = usage === undefined || validTrialUsage(usage);
      persist({ event: "settle", attemptId, ...(usage !== undefined && valid ? { usage } : {}) });
      if (!valid) throw new Error("Invalid usage retained at the full reservation.");
    },
    snapshot() {
      assertOpen();
      return structuredClone(state);
    },
    finish() {
      persist({ event: "finish" });
    },
    close() {
      if (closed) return;
      try {
        assertOpen();
        const active = state.attempts.find((entry) => entry.status === "reserved");
        if (active) persist({ event: "settle", attemptId: active.attemptId });
        release();
      } finally {
        closed = true;
        fs.closeSync(lockFd);
        if (journalFd !== undefined) fs.closeSync(journalFd);
      }
    },
  };
}
