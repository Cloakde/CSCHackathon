import {
  GroundingContextSnapshotSchema,
  ImLostResponseSchema,
  LookbackMsSchema,
  hydrateCitationsFromChunkIds,
  type GroundingContextSnapshot,
  type ImLostResponse,
} from "./schemas/assistance";
import type { BuildImLostResponseCommand } from "./grounding";
import {
  evaluateImLostResponse,
  normalizeImLostResponseCommand,
} from "./internal/evaluate-grounding";
import { OffsetMsSchema } from "./schemas/common";
import { ConfusionEventSchema, type ConfusionEvent } from "./schemas/study";
import {
  ActiveLectureSessionSchema,
  CompletedLectureSessionSchema,
  SessionViewSchema,
  type ActiveLectureSession,
  type CompletedLectureSession,
  type LectureSession,
  type SessionView,
} from "./schemas/session";
import { TranscriptChunkSchema, type TranscriptChunk } from "./schemas/transcript";

export interface SessionStore {
  createSession(session: ActiveLectureSession): Promise<ActiveLectureSession>;
  appendCommittedChunks(sessionId: string, chunks: readonly TranscriptChunk[]): Promise<string[]>;
  getSession(sessionId: string): Promise<SessionView | undefined>;
  getChunksInRange(sessionId: string, startMs: number, endMs: number): Promise<TranscriptChunk[]>;
  createGroundingContext(sessionId: string, lookbackMs: number): Promise<GroundingContextSnapshot>;
  buildAndRecordImLostResponse(input: BuildImLostResponseCommand): Promise<ImLostResponse>;
  completeSession(sessionId: string, endedAt: string): Promise<CompletedLectureSession>;
  deleteSession(sessionId: string): Promise<boolean>;
}

interface SessionRecord {
  session: LectureSession;
  chunks: Map<string, TranscriptChunk>;
  confusionEvents: Map<string, ConfusionEvent>;
  assistanceRecords: Map<
    string,
    {
      commandFingerprint: string;
      context: GroundingContextSnapshot;
      response: ImLostResponse;
    }
  >;
  transcriptRevision: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemorySessionStore implements SessionStore {
  readonly #records = new Map<string, SessionRecord>();
  readonly #usedSessionIds = new Set<string>();
  readonly #inFlightAssistance = new Map<
    string,
    {
      sessionId: string;
      responseId: string;
      confusionId: string;
      commandFingerprint: string;
      promise: Promise<ImLostResponse>;
    }
  >();

  async createSession(sessionInput: ActiveLectureSession): Promise<ActiveLectureSession> {
    const session = ActiveLectureSessionSchema.parse(sessionInput);
    if (this.#usedSessionIds.has(session.sessionId)) {
      throw new Error(`Session ID has already been used: ${session.sessionId}`);
    }

    this.#usedSessionIds.add(session.sessionId);
    this.#records.set(session.sessionId, {
      session: clone(session),
      chunks: new Map(),
      confusionEvents: new Map(),
      assistanceRecords: new Map(),
      transcriptRevision: 0,
    });
    return clone(session);
  }

  async appendCommittedChunks(
    sessionId: string,
    chunkInputs: readonly TranscriptChunk[],
  ): Promise<string[]> {
    const record = this.#requireRecord(sessionId);
    const parsedChunks = chunkInputs.map((chunk) => TranscriptChunkSchema.parse(chunk));
    const pendingById = new Map<string, TranscriptChunk>();
    const occupiedSequences = new Map(
      [...record.chunks.values()].map((chunk) => [chunk.sequence, chunk.chunkId]),
    );

    for (const chunk of parsedChunks) {
      if (chunk.sessionId !== sessionId) {
        throw new Error(`Chunk ${chunk.chunkId} belongs to another session`);
      }

      const existing = record.chunks.get(chunk.chunkId);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(chunk)) {
          throw new Error(`Committed chunk ID cannot be mutated: ${chunk.chunkId}`);
        }
        continue;
      }

      const pending = pendingById.get(chunk.chunkId);
      if (pending && JSON.stringify(pending) !== JSON.stringify(chunk)) {
        throw new Error(`Committed chunk ID cannot be mutated within a batch: ${chunk.chunkId}`);
      }
      if (pending) continue;

      const sequenceOwner = occupiedSequences.get(chunk.sequence);
      if (sequenceOwner && sequenceOwner !== chunk.chunkId) {
        throw new Error(
          `Committed chunk sequence ${chunk.sequence} is already owned by ${sequenceOwner}`,
        );
      }
      occupiedSequences.set(chunk.sequence, chunk.chunkId);
      pendingById.set(chunk.chunkId, chunk);
    }

    const acceptedChunkIds = [...pendingById.keys()];
    if (pendingById.size === 0) return [];
    if (record.session.status !== "active") {
      throw new Error(`Session is not active: ${sessionId}`);
    }
    const candidateChunks = [...record.chunks.values(), ...pendingById.values()].sort(
      (left, right) => left.sequence - right.sequence,
    );
    for (let index = 1; index < candidateChunks.length; index += 1) {
      const previous = candidateChunks[index - 1];
      const current = candidateChunks[index];
      if (previous && current && current.startMs < previous.endMs) {
        throw new Error(
          `Committed chunk ${current.chunkId} moves backward or overlaps ${previous.chunkId}`,
        );
      }
    }

    for (const chunk of pendingById.values()) record.chunks.set(chunk.chunkId, clone(chunk));
    record.transcriptRevision += 1;
    return acceptedChunkIds;
  }

  async getSession(sessionId: string): Promise<SessionView | undefined> {
    const record = this.#records.get(sessionId);
    if (!record) return undefined;

    return SessionViewSchema.parse({
      session: clone(record.session),
      committedChunks: [...record.chunks.values()]
        .sort((left, right) => left.sequence - right.sequence)
        .map(clone),
      confusionEvents: [...record.confusionEvents.values()].map(clone),
    });
  }

  async getChunksInRange(
    sessionId: string,
    startMs: number,
    endMs: number,
  ): Promise<TranscriptChunk[]> {
    const parsedStartMs = OffsetMsSchema.parse(startMs);
    const parsedEndMs = OffsetMsSchema.parse(endMs);
    if (parsedEndMs < parsedStartMs) {
      throw new Error("Invalid transcript range");
    }
    const record = this.#requireRecord(sessionId);

    return this.#selectChunks(record, parsedStartMs, parsedEndMs).map(clone);
  }

  async createGroundingContext(
    sessionId: string,
    lookbackMsInput: number,
  ): Promise<GroundingContextSnapshot> {
    const lookbackMs = LookbackMsSchema.parse(lookbackMsInput);
    const record = this.#requireRecord(sessionId);
    if (record.session.status !== "active") {
      throw new Error(`Session is not active: ${sessionId}`);
    }
    const orderedChunks = this.#orderedChunks(record);
    const anchorMs = orderedChunks.at(-1)?.endMs ?? 0;
    const startMs = Math.max(0, anchorMs - lookbackMs);
    const chunks = this.#selectChunks(record, startMs, anchorMs);
    return GroundingContextSnapshotSchema.parse({
      reference: {
        sessionId,
        transcriptRevision: record.transcriptRevision,
        anchorMs,
        chunkIds: chunks.map((chunk) => chunk.chunkId),
      },
      startMs,
      chunks: chunks.map(clone),
    });
  }

  async buildAndRecordImLostResponse(input: BuildImLostResponseCommand): Promise<ImLostResponse> {
    const normalized = normalizeImLostResponseCommand(input);
    const commandFingerprint = JSON.stringify({
      context: normalized.context,
      modelOutput: normalized.modelOutput,
      responseId: normalized.responseId,
      confusionId: normalized.confusionId,
    });
    const record = this.#requireRecord(normalized.context.reference.sessionId);
    const existing = record.assistanceRecords.get(normalized.confusionId);
    if (existing) {
      if (existing.commandFingerprint !== commandFingerprint) {
        throw new Error(`Assistance command cannot be mutated: ${normalized.confusionId}`);
      }
      return clone(existing.response);
    }
    if (
      [...record.assistanceRecords.values()].some(
        (assistanceRecord) => assistanceRecord.response.responseId === normalized.responseId,
      )
    ) {
      throw new Error(`Assistance response IDs must be unique: ${normalized.responseId}`);
    }
    const operationKey = `${normalized.context.reference.sessionId}:${normalized.confusionId}`;
    const inFlight = this.#inFlightAssistance.get(operationKey);
    if (inFlight) {
      if (inFlight.commandFingerprint !== commandFingerprint) {
        throw new Error(`Assistance command cannot be mutated: ${normalized.confusionId}`);
      }
      return clone(await inFlight.promise);
    }
    if (
      [...this.#inFlightAssistance.values()].some(
        (operation) =>
          operation.sessionId === normalized.context.reference.sessionId &&
          operation.responseId === normalized.responseId,
      )
    ) {
      throw new Error(`Assistance response IDs must be unique: ${normalized.responseId}`);
    }

    this.#validateGroundingContext(record, normalized.context);

    const promise = Promise.resolve().then(async () => {
      const evaluated = await evaluateImLostResponse(normalized);
      return this.#recordAssistanceAgainstContext(
        evaluated.context,
        evaluated.response,
        commandFingerprint,
      );
    });
    this.#inFlightAssistance.set(operationKey, {
      sessionId: normalized.context.reference.sessionId,
      responseId: normalized.responseId,
      confusionId: normalized.confusionId,
      commandFingerprint,
      promise,
    });
    try {
      return clone(await promise);
    } finally {
      if (this.#inFlightAssistance.get(operationKey)?.promise === promise) {
        this.#inFlightAssistance.delete(operationKey);
      }
    }
  }

  #recordAssistanceAgainstContext(
    contextInput: GroundingContextSnapshot,
    responseInput: ImLostResponse,
    commandFingerprint: string,
  ): ImLostResponse {
    const context = GroundingContextSnapshotSchema.parse(contextInput);
    const response = ImLostResponseSchema.parse(responseInput);
    const event = ConfusionEventSchema.parse(response.confusionEvent);
    if (event.sessionId !== context.reference.sessionId) {
      throw new Error("Confusion event belongs to a different grounding context");
    }
    const record = this.#requireRecord(event.sessionId);
    const concurrentlyRecorded = record.assistanceRecords.get(event.confusionId);
    if (concurrentlyRecorded) {
      if (concurrentlyRecorded.commandFingerprint !== commandFingerprint) {
        throw new Error(`Assistance command cannot be mutated: ${event.confusionId}`);
      }
      return clone(concurrentlyRecorded.response);
    }
    this.#validateGroundingContext(record, context);
    if (
      event.occurredAtMs !== context.reference.anchorMs ||
      event.anchorChunkId !== context.chunks.at(-1)?.chunkId ||
      JSON.stringify(event.contextChunkIds) !== JSON.stringify(context.reference.chunkIds)
    ) {
      throw new Error("Confusion event does not exactly match its grounding context");
    }
    const canonicalCitations = hydrateCitationsFromChunkIds(
      context.reference.sessionId,
      event.evidenceChunkIds,
      context.chunks,
    );
    if (JSON.stringify(response.citations) !== JSON.stringify(canonicalCitations)) {
      throw new Error("Assistance citations do not match the canonical transcript chunks");
    }
    this.#validateConfusion(record, event);
    record.confusionEvents.set(event.confusionId, clone(event));
    record.assistanceRecords.set(event.confusionId, {
      commandFingerprint,
      context: clone(context),
      response: clone(response),
    });
    return clone(response);
  }

  #validateGroundingContext(record: SessionRecord, context: GroundingContextSnapshot): void {
    if (record.session.status !== "active") {
      throw new Error(`Session is not active: ${context.reference.sessionId}`);
    }
    if (record.transcriptRevision !== context.reference.transcriptRevision) {
      throw new Error("Grounding context is stale because the transcript changed");
    }
    const authoritativeAnchorMs = this.#orderedChunks(record).at(-1)?.endMs ?? 0;
    if (context.reference.anchorMs !== authoritativeAnchorMs) {
      throw new Error("Grounding context does not use the authoritative transcript anchor");
    }
    const currentChunks = this.#selectChunks(record, context.startMs, context.reference.anchorMs);
    if (JSON.stringify(currentChunks) !== JSON.stringify(context.chunks)) {
      throw new Error("Grounding context no longer matches the stored transcript");
    }
  }

  #validateConfusion(record: SessionRecord, event: ConfusionEvent): void {
    const referencedChunkIds = [
      ...(event.anchorChunkId ? [event.anchorChunkId] : []),
      ...event.contextChunkIds,
      ...event.evidenceChunkIds,
    ];
    for (const chunkId of referencedChunkIds) {
      const chunk = record.chunks.get(chunkId);
      if (!chunk) {
        throw new Error(`Confusion event references nonexistent chunk: ${chunkId}`);
      }
      if (chunk.endMs > event.occurredAtMs) {
        throw new Error(`Confusion event references a future transcript chunk: ${chunkId}`);
      }
    }
    const latestChunkEndMs = this.#orderedChunks(record).at(-1)?.endMs;
    if (
      (latestChunkEndMs === undefined && event.occurredAtMs !== 0) ||
      (latestChunkEndMs !== undefined && event.occurredAtMs > latestChunkEndMs)
    ) {
      throw new Error("Confusion event occurs beyond authoritative transcript progress");
    }

    SessionViewSchema.parse({
      session: record.session,
      committedChunks: this.#orderedChunks(record),
      confusionEvents: [...record.confusionEvents.values(), event],
    });
  }

  async completeSession(sessionId: string, endedAt: string): Promise<CompletedLectureSession> {
    const record = this.#requireRecord(sessionId);
    if (record.session.status === "completed") {
      if (record.session.endedAt !== endedAt) {
        throw new Error(`Completed session end time cannot be mutated: ${sessionId}`);
      }
      return clone(record.session);
    }
    const completed = CompletedLectureSessionSchema.parse({
      ...record.session,
      status: "completed",
      endedAt,
    });
    const lectureDurationMs = Date.parse(completed.endedAt) - Date.parse(completed.startedAt);
    const latestChunkEndMs = Math.max(
      0,
      ...[...record.chunks.values()].map((chunk) => chunk.endMs),
    );
    if (latestChunkEndMs > lectureDurationMs) {
      throw new Error(
        `Session cannot end before its latest committed transcript chunk: ${sessionId}`,
      );
    }
    const latestConfusionMs = Math.max(
      0,
      ...[...record.confusionEvents.values()].map((event) => event.occurredAtMs),
    );
    if (latestConfusionMs > lectureDurationMs) {
      throw new Error(`Session cannot end before its latest confusion event: ${sessionId}`);
    }
    record.session = completed;
    return clone(completed);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.#records.delete(sessionId);
  }

  #requireRecord(sessionId: string): SessionRecord {
    const record = this.#records.get(sessionId);
    if (!record) throw new Error(`Session not found: ${sessionId}`);
    return record;
  }

  #orderedChunks(record: SessionRecord): TranscriptChunk[] {
    return [...record.chunks.values()].sort((left, right) => left.sequence - right.sequence);
  }

  #selectChunks(record: SessionRecord, startMs: number, endMs: number): TranscriptChunk[] {
    return this.#orderedChunks(record).filter(
      (chunk) => chunk.endMs >= startMs && chunk.endMs <= endMs,
    );
  }
}
