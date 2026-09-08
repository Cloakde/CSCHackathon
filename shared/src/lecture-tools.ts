import { z } from "zod";
import { CitationSchema } from "./schemas/assistance";
import { StableIdSchema } from "./schemas/common";
import { TranscriptChunkSchema, type TranscriptChunk } from "./schemas/transcript";
import { getCommittedChunksFromFixture } from "./simulation";

const canonical = getCommittedChunksFromFixture();
export const RECAP_WINDOW_MS = 120_000;
export const LECTURE_TOOL_MESSAGE_LIMIT = 2_000;
export const GEMINI_TOOL_FALLBACK =
  "This answer could not be verified against the lecture. Try another question or review the cited lecture passages directly.";

/** A published sample catalog, not a keyword/semantic question classifier. */
export const SAMPLE_LECTURE_QUESTIONS = [
  {
    question: "What are inner and outer functions?",
    evidence: ["chunk_calc_002", "chunk_calc_003"],
  },
  { question: "What does the chain rule say?", evidence: ["chunk_calc_004"] },
  {
    question: "How do I differentiate (3x² + 1)⁵?",
    evidence: ["chunk_calc_005", "chunk_calc_006"],
  },
  {
    question: "Why multiply by the inner derivative?",
    evidence: ["chunk_calc_004", "chunk_calc_008"],
  },
] as const;

const sequence = z
  .number()
  .int()
  .min(-1)
  .max(canonical.length - 1);
export const LectureToolRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ask"),
      question: z.string().trim().min(1).max(500),
      throughSequence: sequence,
    })
    .strict(),
  z.object({ kind: z.literal("catch_up"), throughSequence: sequence }).strict(),
]);
export type LectureToolRequest = z.infer<typeof LectureToolRequestSchema>;
export type LectureToolPrompt = { kind: "ask"; question: string } | { kind: "catch_up" };

export const LectureToolResponseSchema = z
  .object({
    sessionId: StableIdSchema,
    mode: z.enum(["prewritten", "gemini"]),
    request: LectureToolRequestSchema,
    anchorMs: z.number().int().nonnegative(),
    status: z.enum(["ready", "insufficient_evidence", "unsupported_question"]),
    message: z.string().min(1).max(LECTURE_TOOL_MESSAGE_LIMIT),
    passages: z
      .array(
        z
          .object({
            text: z.string().min(1).max(10_000),
            citation: CitationSchema.strict(),
          })
          .strict(),
      )
      .max(canonical.length),
  })
  .strict();
export type LectureToolResponse = z.infer<typeof LectureToolResponseSchema>;
export const LectureToolEnvelopeSchema = z
  .object({ ok: z.literal(true), data: LectureToolResponseSchema })
  .strict();

function normalized(question: string) {
  return question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "")
    .trim();
}

/** Validate the canonical synthetic source before choosing evidence for either provider mode. */
export function lectureToolSnapshot(
  sessionId: string,
  input: LectureToolRequest,
  chunks: readonly TranscriptChunk[],
) {
  StableIdSchema.parse(sessionId);
  const request = LectureToolRequestSchema.parse(input);
  if (chunks.length > canonical.length || request.throughSequence >= chunks.length)
    throw new Error("The requested lecture snapshot is unavailable.");
  const checked = chunks
    .map((raw, index) => {
      const chunk = TranscriptChunkSchema.strict().parse(raw);
      const expected = canonical[index]!;
      if (
        chunk.sessionId !== sessionId ||
        chunk.sequence !== index ||
        chunk.chunkId !== expected.chunkId ||
        chunk.text !== expected.text ||
        chunk.startMs !== expected.startMs ||
        chunk.endMs !== expected.endMs ||
        chunk.speakerLabel !== expected.speakerLabel
      )
        throw new Error("The lecture snapshot could not be verified.");
      return chunk;
    })
    .slice(0, request.throughSequence + 1);
  const anchorMs = checked.at(-1)?.endMs ?? 0;
  return {
    request,
    anchorMs,
    checked,
    evidence:
      request.kind === "catch_up"
        ? checked.filter((chunk) => chunk.endMs > Math.max(0, anchorMs - RECAP_WINDOW_MS))
        : checked,
  };
}

/** Only an exact canonical prefix can support this offline demo. Partial/future text is excluded. */
export function buildLectureToolResponse(
  sessionId: string,
  input: LectureToolRequest,
  chunks: readonly TranscriptChunk[],
): LectureToolResponse {
  const { request, anchorMs, checked, evidence } = lectureToolSnapshot(sessionId, input, chunks);
  let selected: TranscriptChunk[] = [];
  let status: LectureToolResponse["status"] = "ready";
  let message = "Exact passages from the sample lecture, with source timestamps.";
  if (request.kind === "ask") {
    const sample = SAMPLE_LECTURE_QUESTIONS.find(
      (entry) => normalized(entry.question) === normalized(request.question),
    );
    if (!sample) {
      status = "unsupported_question";
      message =
        "Sample mode supports only the suggested questions. Gemini is not connected, so other questions cannot be answered here yet.";
    } else {
      selected = checked.filter((chunk) =>
        (sample.evidence as readonly string[]).includes(chunk.chunkId),
      );
      if (selected.length !== sample.evidence.length) {
        selected = [];
        status = "insufficient_evidence";
        message =
          "The passages for this question have not arrived yet. Let the sample lecture continue, then ask again.";
      }
    }
  } else {
    selected = evidence;
    message =
      "Recent lecture excerpts overlapping the last two minutes. These are quoted passages, not an AI summary.";
    if (!selected.length) {
      status = "insufficient_evidence";
      message =
        "No complete lecture passage has arrived yet. Let the sample lecture continue, then try again.";
    }
  }
  return LectureToolResponseSchema.parse({
    sessionId,
    mode: "prewritten",
    request,
    anchorMs,
    status,
    message,
    passages: selected.map((chunk) => ({
      text: chunk.text,
      citation: { chunkId: chunk.chunkId, startMs: chunk.startMs, endMs: chunk.endMs },
    })),
  });
}

/** Validate content as well as shape; server-supplied text never invents a new sample answer. */
export function validateLectureToolResponse(
  sessionId: string,
  request: LectureToolRequest,
  chunks: readonly TranscriptChunk[],
  raw: unknown,
): LectureToolResponse {
  const incoming = LectureToolResponseSchema.parse(raw);
  const requested = LectureToolRequestSchema.parse(request);
  if (incoming.sessionId !== sessionId)
    throw new Error("This response belongs to another session.");
  if (JSON.stringify(incoming.request) !== JSON.stringify(requested))
    throw new Error("This response does not match the requested prompt.");
  if (incoming.mode === "prewritten") {
    const expected = buildLectureToolResponse(sessionId, requested, chunks);
    if (JSON.stringify(incoming) !== JSON.stringify(expected))
      throw new Error("This response did not match the requested lecture passages.");
    return incoming;
  }
  const { evidence: allowedChunks, anchorMs } = lectureToolSnapshot(sessionId, requested, chunks);
  if (incoming.anchorMs !== anchorMs)
    throw new Error("This response does not match the requested anchor offset.");
  const chunkMap = new Map(allowedChunks.map((chunk) => [chunk.chunkId, chunk]));
  const seenIds = new Set<string>();
  for (const passage of incoming.passages) {
    if (seenIds.has(passage.citation.chunkId))
      throw new Error("Duplicate cited chunk in lecture tool response.");
    seenIds.add(passage.citation.chunkId);
    const chunk = chunkMap.get(passage.citation.chunkId);
    if (!chunk) throw new Error("Cited chunk was not committed in the requested snapshot.");
    if (
      passage.citation.startMs !== chunk.startMs ||
      passage.citation.endMs !== chunk.endMs ||
      passage.text !== chunk.text
    )
      throw new Error("Cited passage text or offsets do not match canonical transcript.");
  }
  if (incoming.status === "ready" && incoming.passages.length === 0)
    throw new Error("A generated answer needs supporting passages.");
  if (
    incoming.status !== "ready" &&
    (incoming.passages.length > 0 || incoming.message !== GEMINI_TOOL_FALLBACK)
  )
    throw new Error("Unverified generated content must be discarded.");
  return incoming;
}
