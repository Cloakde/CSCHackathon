import { describe, expect, it, vi } from "vitest";
import {
  getCommittedChunksFromFixture,
  type GroundingContextSnapshot,
  type ConfusionEvent,
  type CompletedSessionView,
} from "@livelecture/shared";
import { createGeminiAppAssistance, GeminiAppError } from "./gemini-app-assistance";
import { BENCHMARK_QUESTIONS } from "./provider-trial/prompts";

const sid = "session_gemini_test";
const canonicalChunks = getCommittedChunksFromFixture().map((chunk) => ({
  ...chunk,
  sessionId: sid,
}));

function fakeGeminiResponse(payload: unknown, model = "gemini-3.1-flash-lite") {
  return new Response(
    JSON.stringify({
      responseId: "resp_test_12345",
      modelVersion: model,
      usageMetadata: {
        promptTokenCount: 150,
        candidatesTokenCount: 80,
        totalTokenCount: 230,
      },
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: JSON.stringify({ result: payload }) }],
          },
          finishReason: "STOP",
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function withToolVerification(fetcher: typeof fetch): typeof fetch {
  return (url, init) =>
    String(init?.body).includes("separate lecture-answer reviewer")
      ? Promise.resolve(
          fakeGeminiResponse({
            verdict: "supported",
            checks: [
              "answer_supported",
              "question_answered",
              "citations_support_claims",
              "scope_respected",
            ],
          }),
        )
      : fetcher(url, init);
}
describe("gemini-app-assistance", () => {
  it("supports a live concept outside the frozen sample taxonomy, preserving evidence and separate practice verification", async () => {
    const chunk = {
      chunkId: "chunk_gravity",
      sessionId: sid,
      sequence: 0,
      startMs: 0,
      endMs: 5000,
      text: "Gravity makes a dropped object accelerate downward.",
    };
    const event: ConfusionEvent = {
      confusionId: "conf_gravity",
      sessionId: sid,
      trigger: "im_lost",
      assistanceResponseId: "response_gravity",
      occurredAtMs: 5000,
      anchorChunkId: chunk.chunkId,
      contextChunkIds: [chunk.chunkId],
      evidenceChunkIds: [chunk.chunkId],
      conceptId: "concept_gravity",
      conceptTitle: "Gravity",
    };
    const view: CompletedSessionView = {
      session: {
        sessionId: sid,
        sourceMode: "live",
        status: "completed",
        startedAt: new Date(0).toISOString(),
        endedAt: new Date(5000).toISOString(),
      },
      committedChunks: [chunk],
      confusionEvents: [event],
    };
    const drill = {
      drillId: "drill_gravity",
      sessionId: sid,
      sourceConfusionEventIds: [event.confusionId],
      conceptId: event.conceptId,
      conceptTitle: event.conceptTitle,
      shortExplanation: "Gravity accelerates a dropped object downward.",
      practiceItems: [
        {
          prompt: "Which way does a dropped object accelerate?",
          expectedAnswer: "Downward.",
          explanation: "Gravity makes the object accelerate downward.",
        },
      ],
      evidenceChunkIds: [chunk.chunkId],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(fakeGeminiResponse(drill))
      .mockResolvedValueOnce(
        fakeGeminiResponse({
          verdict: "supported",
          supportedChecks: [
            "question_supported",
            "answer_correct",
            "explanation_supported",
            "confusion_aligned",
          ],
        }),
      );
    const assistant = createGeminiAppAssistance({
      apiKey: "fake-gemini-key-12345",
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      fetcher,
    });
    const generated = await assistant.generatePractice(event, "drill_gravity", {
      view,
      signal: new AbortController().signal,
    });
    expect(generated.conceptId).toBe("concept_gravity");
    expect(
      (
        await assistant.verifyPractice(
          { confusionEvent: event, view, drill: generated },
          new AbortController().signal,
        )
      ).verdict,
    ).toBe("supported");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map((call) => String(call[1]?.body)).join(" ")).not.toContain(
      "benchmarkQuestion",
    );
    await expect(
      assistant.generatePractice({ ...event, evidenceChunkIds: ["chunk_wrong"] }, "drill_wrong", {
        view,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid API key configuration", () => {
    expect(() =>
      createGeminiAppAssistance({
        meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
        apiKey: "short",
      }),
    ).toThrow(GeminiAppError);
    expect(() =>
      createGeminiAppAssistance({
        meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
        apiKey: "",
      }),
    ).toThrow(GeminiAppError);
  });

  it("generates grounded I'm Lost help and verifies citations", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(init?.headers).toMatchObject({
        "x-goog-api-key": "fake-gemini-key-12345",
        "Content-Type": "application/json",
      });
      expect(body.generationConfig.responseMimeType).toBe("application/json");

      return fakeGeminiResponse({
        groundingStatus: "grounded",
        context: {
          sessionId: sid,
          transcriptRevision: 0,
          anchorMs: 200_000,
          chunkIds: ["chunk_calc_001", "chunk_calc_002", "chunk_calc_003", "chunk_calc_004"],
        },
        diagnosis: {
          whatJustHappened:
            "The professor introduced the chain rule for differentiating composite functions.",
          mainIdea:
            "Differentiate the outer function and multiply by the derivative of the inner function.",
          simpleExplanation: "Think of peeling an onion: work from the outside in.",
          importantPrerequisite: "Power rule and definition of composite functions.",
        },
        citationChunkIds: ["chunk_calc_004"],
        conceptId: "concept_inner_derivative",
        conceptTitle: "Including the inner derivative in the chain rule",
        followUpActions: ["ask_follow_up", "show_an_example"],
      });
    });

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const context: GroundingContextSnapshot = {
      reference: {
        sessionId: sid,
        transcriptRevision: 0,
        anchorMs: 200_000,
        chunkIds: ["chunk_calc_001", "chunk_calc_002", "chunk_calc_003", "chunk_calc_004"],
      },
      startMs: 0,
      chunks: canonicalChunks.slice(0, 4),
    };

    const result = await assistant.generateHelp(context, new AbortController().signal);
    expect(result.groundingStatus).toBe("grounded");
    if (result.groundingStatus === "grounded") {
      expect(result.citationChunkIds).toEqual(["chunk_calc_004"]);
      expect(result.conceptId).toBe("concept_inner_derivative");
      expect(result.diagnosis.whatJustHappened).toContain("chain rule");
    }
  });

  it("handles insufficient_evidence help responses gracefully", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        groundingStatus: "insufficient_evidence",
        context: {
          sessionId: sid,
          transcriptRevision: 0,
          anchorMs: 45_000,
          chunkIds: ["chunk_calc_001"],
        },
        followUpActions: ["ask_follow_up"],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const context: GroundingContextSnapshot = {
      reference: {
        sessionId: sid,
        transcriptRevision: 0,
        anchorMs: 45_000,
        chunkIds: ["chunk_calc_001"],
      },
      startMs: 0,
      chunks: canonicalChunks.slice(0, 1),
    };

    const result = await assistant.generateHelp(context, new AbortController().signal);
    expect(result.groundingStatus).toBe("insufficient_evidence");
  });

  it("rejects help output that cites nonexistent chunks", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        groundingStatus: "grounded",
        context: {
          sessionId: sid,
          transcriptRevision: 0,
          anchorMs: 200_000,
          chunkIds: ["chunk_calc_001"],
        },
        diagnosis: {
          whatJustHappened: "Something happened.",
          mainIdea: "Main idea.",
          simpleExplanation: "Simple.",
          importantPrerequisite: "Prerequisite.",
        },
        citationChunkIds: ["chunk_calc_nonexistent"],
        conceptId: "concept_inner_derivative",
        conceptTitle: "Chain rule",
        followUpActions: ["ask_follow_up"],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const context: GroundingContextSnapshot = {
      reference: {
        sessionId: sid,
        transcriptRevision: 0,
        anchorMs: 200_000,
        chunkIds: ["chunk_calc_001"],
      },
      startMs: 0,
      chunks: canonicalChunks.slice(0, 1),
    };

    await expect(assistant.generateHelp(context, new AbortController().signal)).rejects.toThrow(
      GeminiAppError,
    );
  });

  it("verifies help claims with independent verification", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        verdict: "supported",
        supportedClaims: [
          "what_just_happened",
          "main_idea",
          "simple_explanation",
          "important_prerequisite",
          "concept",
        ],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const candidate = {
      context: {
        reference: {
          sessionId: sid,
          transcriptRevision: 0,
          anchorMs: 200_000,
          chunkIds: ["chunk_calc_004"],
        },
        startMs: 145_000,
        chunks: [canonicalChunks[3]!],
      },
      modelOutput: {
        groundingStatus: "grounded" as const,
        context: {
          sessionId: sid,
          transcriptRevision: 0,
          anchorMs: 200_000,
          chunkIds: ["chunk_calc_004"],
        },
        diagnosis: {
          whatJustHappened: "Chain rule introduced.",
          mainIdea: "Multiply by derivative of inside.",
          simpleExplanation: "Peel outside then inside.",
          importantPrerequisite: "Derivatives.",
        },
        citationChunkIds: ["chunk_calc_004"],
        conceptId: "concept_inner_derivative" as const,
        conceptTitle: "Inner derivative",
        followUpActions: ["ask_follow_up" as const],
      },
      citedChunks: [canonicalChunks[3]!],
    };

    const verdict = await assistant.verifyHelp(candidate, new AbortController().signal);
    expect(verdict.verdict).toBe("supported");
  });

  it("generates and verifies practice linked to confusion events", async () => {
    const drillId = "drill_gemini_test_01";
    const mockFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        fakeGeminiResponse({
          drillId,
          sessionId: sid,
          sourceConfusionEventIds: ["conf_test_01"],
          conceptId: "concept_inner_derivative",
          conceptTitle: "Inner derivative",
          shortExplanation: "Multiply by the inner derivative.",
          practiceItems: [
            {
              prompt: BENCHMARK_QUESTIONS.concept_inner_derivative,
              expectedAnswer: "The missing factor is 2; the derivative is 8(2x + 3)³.",
              explanation: "Multiply 4(2x + 3)³ by the inner derivative, 2.",
            },
          ],
          evidenceChunkIds: ["chunk_calc_004"],
        }),
      )
      .mockResolvedValueOnce(
        fakeGeminiResponse({
          verdict: "supported",
          supportedChecks: [
            "question_supported",
            "answer_correct",
            "explanation_supported",
            "confusion_aligned",
          ],
        }),
      );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const event: ConfusionEvent = {
      confusionId: "conf_test_01",
      sessionId: sid,
      trigger: "im_lost",
      assistanceResponseId: "resp_test_01",
      occurredAtMs: 200_000,
      contextChunkIds: ["chunk_calc_004"],
      anchorChunkId: "chunk_calc_004",
      conceptId: "concept_inner_derivative",
      conceptTitle: "Inner derivative",
      evidenceChunkIds: ["chunk_calc_004"],
    };

    const view: CompletedSessionView = {
      session: {
        sessionId: sid,
        title: "Calculus",
        subject: "Mathematics",
        sourceMode: "simulation",
        status: "completed",
        startedAt: new Date(0).toISOString(),
        endedAt: new Date(480_000).toISOString(),
      },
      committedChunks: canonicalChunks,
      confusionEvents: [event],
    };

    const drill = await assistant.generatePractice(event, drillId, {
      view,
      signal: new AbortController().signal,
    });
    expect(drill.drillId).toBe(drillId);
    expect(drill.practiceItems[0]!.prompt).toBe(BENCHMARK_QUESTIONS.concept_inner_derivative);

    const verdict = await assistant.verifyPractice(
      { view, confusionEvent: event, drill },
      new AbortController().signal,
    );
    expect(verdict.verdict).toBe("supported");
    const truncated = structuredClone(drill);
    truncated.practiceItems[0]!.prompt =
      "Identify the missing factor and calculate the correct derivative for (2x + 3)⁴.";
    mockFetcher.mockResolvedValueOnce(fakeGeminiResponse(truncated));
    await expect(
      assistant.generatePractice(event, drillId, { view, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "output" });
    const callsBeforeVerification = mockFetcher.mock.calls.length;
    await expect(
      assistant.verifyPractice(
        { view, confusionEvent: event, drill: truncated },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "output" });
    expect(mockFetcher).toHaveBeenCalledTimes(callsBeforeVerification);
  });

  it("handles Ask the Lecture with grounded citations", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        status: "ready",
        message:
          "The chain rule differentiates the outer function and multiplies by the derivative of the inner function.",
        citationChunkIds: ["chunk_calc_004"],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const response = await assistant.handleLectureTool(
      sid,
      { kind: "ask", question: "What does the chain rule say?", throughSequence: 4 },
      canonicalChunks,
      new AbortController().signal,
    );

    expect(response.mode).toBe("gemini");
    expect(response.status).toBe("ready");
    expect(response.message).toContain("chain rule");
    expect(response.passages).toHaveLength(1);
    expect(response.passages[0]!.citation.chunkId).toBe("chunk_calc_004");
  });

  it("handles Catch Me Up with grounded recent passages", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        status: "ready",
        message:
          "In the last two minutes, the professor solved an example for (3x^2 + 1)^5 using the power rule.",
        citationChunkIds: ["chunk_calc_005", "chunk_calc_006"],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const response = await assistant.handleLectureTool(
      sid,
      { kind: "catch_up", throughSequence: 5 },
      canonicalChunks,
      new AbortController().signal,
    );

    expect(response.mode).toBe("gemini");
    expect(response.status).toBe("ready");
    expect(response.passages.map((p) => p.citation.chunkId)).toEqual([
      "chunk_calc_005",
      "chunk_calc_006",
    ]);
  });

  it("rejects responses echoing API keys in output", async () => {
    const mockFetcher = vi.fn<typeof fetch>(async () =>
      fakeGeminiResponse({
        status: "ready",
        message: "Leaked key: fake-gemini-key-12345 in message.",
        citationChunkIds: ["chunk_calc_004"],
      }),
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    await expect(
      assistant.handleLectureTool(
        sid,
        { kind: "ask", question: "What is the key?", throughSequence: 4 },
        canonicalChunks,
        new AbortController().signal,
      ),
    ).rejects.toThrow(GeminiAppError);
  });

  it("respects abort signals during calls", async () => {
    const mockFetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => {}), // Never resolves
    );

    const assistant = createGeminiAppAssistance({
      meter: { reserve: vi.fn(() => 1), settle: vi.fn() },
      apiKey: "fake-gemini-key-12345",
      fetcher: withToolVerification(mockFetcher),
    });

    const controller = new AbortController();
    const promise = assistant.handleLectureTool(
      sid,
      { kind: "catch_up", throughSequence: 4 },
      canonicalChunks,
      controller.signal,
    );

    controller.abort();
    await expect(promise).rejects.toMatchObject({ cause: "cancelled" });
  });
});
