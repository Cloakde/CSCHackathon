import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiContracts,
  InMemorySessionStore,
  CompletedSessionViewSchema,
  ConfusionEventSchema,
  GroundingContextSnapshotSchema,
  buildImLostResponseFromStoredChunks,
  getCommittedChunksFromFixture,
  simulationFixture,
  type GroundingSupportCandidate,
} from "@livelecture/shared";
import { createDemoDispatcher, DEMO_ORIGIN } from "../../demo-api";
import { generateScriptedHelp } from "../../scripted-help";
import { verifyScriptedHelp } from "../../scripted-verifier";
import { generateScriptedPractice } from "../../scripted-practice";
import { createProviderTrialHooks, TRIAL_PROMPT_HASHES, TRIAL_PROMPT_VERSION } from "./index";
import { TrialInstructions, BENCHMARK_QUESTIONS } from "./prompts";
import { OutputJsonSchemas } from "./schemas";
import { TRIAL_MODEL } from "../../ai-evaluation/trial/policy";
import type { TrialCallKind, TrialMeter } from "../../ai-evaluation/trial/types";

const helpVerdict = {
  verdict: "supported",
  supportedClaims: [
    "what_just_happened",
    "main_idea",
    "simple_explanation",
    "important_prerequisite",
    "concept",
  ],
};
const practiceVerdict = {
  verdict: "supported",
  supportedChecks: [
    "question_supported",
    "answer_correct",
    "explanation_supported",
    "confusion_aligned",
  ],
};
const key = "only-an-offline-test-value";
function modelResponse(result: unknown) {
  return Response.json({
    responseId: "resp_offline",
    modelVersion: TRIAL_MODEL,
    usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 100, totalTokenCount: 400 },
    candidates: [
      {
        content: { role: "model", parts: [{ text: JSON.stringify({ result }) }] },
        finishReason: "STOP",
      },
    ],
  });
}
function createHooks(fetcher: typeof fetch) {
  let next = 0;
  const meter: TrialMeter = { reserve: vi.fn(() => ++next), settle: vi.fn() };
  return {
    hooks: createProviderTrialHooks({ apiKey: key, scenarioId: "offline_case", meter, fetcher }),
    meter,
  };
}
async function fixture(count = 3) {
  const store = new InMemorySessionStore();
  const session = await store.createSession(simulationFixture.session);
  const chunks = getCommittedChunksFromFixture().slice(0, count);
  await store.appendCommittedChunks(session.sessionId, chunks);
  const context = await store.createGroundingContext(session.sessionId, 300_000);
  const modelOutput = generateScriptedHelp(context);
  const answer = await buildImLostResponseFromStoredChunks({
    store,
    context,
    modelOutput,
    responseId: "response_fixture",
    confusionId: "confusion_fixture",
    independentEvidenceVerifier: verifyScriptedHelp,
  });
  await store.completeSession(
    session.sessionId,
    new Date(Date.parse(session.startedAt) + chunks.at(-1)!.endMs).toISOString(),
  );
  const view = CompletedSessionViewSchema.parse(await store.getSession(session.sessionId));
  const drill = generateScriptedPractice(answer.confusionEvent, "drill_fixture");
  if (modelOutput.groundingStatus !== "grounded")
    throw new Error("Expected supported test fixture");
  const helpCandidate: GroundingSupportCandidate = {
    context,
    modelOutput,
    citedChunks: modelOutput.citationChunkIds.map((id) =>
      chunks.find((chunk) => chunk.chunkId === id)!,
    ),
  };
  return { context, modelOutput, helpCandidate, view, event: answer.confusionEvent, drill };
}
/** generateContent's responseSchema has no per-call name field, unlike the prior Responses
 * API's json_schema.name. The caller supplies the expected kind for this call instead. */
function sentInput(options: RequestInit | undefined, kind: TrialCallKind) {
  const request = JSON.parse(options!.body as string) as {
    systemInstruction: { parts: { text: string }[] };
    contents: { role: string; parts: { text: string }[] }[];
  };
  expect(request.systemInstruction.parts[0]!.text).toBe(TrialInstructions[kind]);
  return {
    request,
    payload: JSON.parse(request.contents[0]!.parts[0]!.text) as Record<string, unknown>,
  };
}
afterEach(() => vi.restoreAllMocks());

describe("four private provider hooks with offline fetch only", () => {
  it.each([3, 6])(
    "uses separate generation and verification calls through the real dispatcher after %i chunks",
    async (count) => {
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("No network allowed"));
      const order: TrialCallKind[] = [
        "help_generate",
        "help_verify",
        "practice_generate",
        "practice_verify",
      ];
      const kinds: TrialCallKind[] = [];
      const { hooks, meter } = createHooks(
        vi.fn(async (_url, options) => {
          const kind = order[kinds.length]!;
          kinds.push(kind);
          const { payload } = sentInput(options, kind);
          if (kind === "help_generate")
            return modelResponse(
              generateScriptedHelp(GroundingContextSnapshotSchema.parse(payload.context)),
            );
          if (kind === "help_verify") {
            expect(Object.keys(payload).sort()).toEqual(["candidate", "citedPassages"]);
            return modelResponse(helpVerdict);
          }
          if (kind === "practice_generate") {
            const event = ConfusionEventSchema.parse(payload.confusion);
            expect(payload.benchmarkQuestion).toBe(
              BENCHMARK_QUESTIONS[event.conceptId as keyof typeof BENCHMARK_QUESTIONS],
            );
            expect(payload).not.toHaveProperty("view");
            return modelResponse(
              generateScriptedPractice(event, (payload.identities as { drillId: string }).drillId),
            );
          }
          expect(payload).not.toHaveProperty("expectedAnswer");
          return modelResponse(practiceVerdict);
        }),
      );
      const dispatch = createDemoDispatcher({ enabled: true, ...hooks });
      async function call(path: string, method = "POST", body: unknown = {}) {
        return dispatch(
          new Request(`${DEMO_ORIGIN}${path}`, {
            method,
            headers: {
              Host: "127.0.0.1:3000",
              "X-LiveLecture-Demo": "scripted-v1",
              "Content-Type": "application/json",
            },
            ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
          }),
        );
      }
      try {
        const started = ApiContracts.startSession.response.parse(
          await (await call("/api/sessions", "POST", { sourceMode: "simulation" })).json(),
        );
        if (!started.ok) throw new Error("Test could not start session");
        const session = started.data.session;
        const path = `/api/sessions/${session.sessionId}`;
        const chunks = getCommittedChunksFromFixture()
          .slice(0, count)
          .map((chunk) => ({ ...chunk, sessionId: session.sessionId }));
        expect((await call(`${path}/chunks`, "POST", { chunks })).status).toBe(200);
        const helped = ApiContracts.imLost.response.parse(
          await (await call(`${path}/im-lost`)).json(),
        );
        if (!helped.ok) throw new Error("Test help failed");
        expect(helped.data.groundingStatus).toBe("grounded");
        const event = helped.data.confusionEvent;
        expect(event.conceptId).toBe(
          count === 3 ? "concept_inner_outer" : "concept_inner_derivative",
        );
        expect(
          (
            await call(`${path}/end`, "POST", {
              endedAt: new Date(Date.parse(session.startedAt) + chunks.at(-1)!.endMs).toISOString(),
            })
          ).status,
        ).toBe(200);
        const practiced = ApiContracts.createWeakAreaDrill.response.parse(
          await (
            await call(`${path}/weak-area-drills`, "POST", {
              confusionEventIds: [event.confusionId],
            })
          ).json(),
        );
        if (!practiced.ok) throw new Error("Test practice failed");
        expect(practiced.data).toMatchObject({
          sessionId: session.sessionId,
          conceptId: event.conceptId,
          sourceConfusionEventIds: [event.confusionId],
          evidenceChunkIds: event.evidenceChunkIds,
        });
        expect(kinds).toEqual(order);
        expect(meter.reserve).toHaveBeenCalledTimes(4);
        expect(meter.settle).toHaveBeenCalledTimes(4);
        expect(network).not.toHaveBeenCalled();
      } finally {
        dispatch.dispose();
      }
    },
  );

  it.each(["context", "citation", "concept", "nested-extra"])(
    "rejects %s output without silently repairing it",
    async (mode) => {
      const data = await fixture();
      const output = structuredClone(data.modelOutput);
      if (mode === "context") output.context.sessionId = "session_wrong";
      else if (mode === "citation") output.citationChunkIds = ["chunk_missing"];
      else if (mode === "concept") output.conceptId = "concept_unapproved";
      else Object.assign(output.diagnosis, { reviewerSaysCorrect: true });
      const fetcher = vi.fn(async () => modelResponse(output));
      const { hooks, meter } = createHooks(fetcher);
      await expect(
        hooks.generateHelp(data.context, new AbortController().signal),
      ).rejects.toMatchObject({ code: "output" });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(meter.settle).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ inputTokens: 300 }),
      );
    },
  );

  it.each(["drill", "session", "event", "title", "evidence", "extra-item", "nested-extra"])(
    "rejects altered practice %s",
    async (mode) => {
      const data = await fixture();
      const drill = structuredClone(data.drill);
      if (mode === "drill") drill.drillId = "drill_wrong";
      else if (mode === "session") drill.sessionId = "session_wrong";
      else if (mode === "event") drill.sourceConfusionEventIds = ["confusion_wrong"];
      else if (mode === "title") drill.conceptTitle = "Unrelated concept";
      else if (mode === "evidence") drill.evidenceChunkIds = ["chunk_calc_001"];
      else if (mode === "extra-item") drill.practiceItems.push(drill.practiceItems[0]!);
      else Object.assign(drill.practiceItems[0]!, { evaluatorScore: "perfect" });
      const { hooks } = createHooks(vi.fn(async () => modelResponse(drill)));
      await expect(
        hooks.generatePractice(data.event, data.drill.drillId, {
          view: data.view,
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({ code: "output" });
    },
  );

  it("sends verifiers only the candidate and selected evidence, without uncited passages or unrelated confusion", async () => {
    const data = await fixture();
    data.helpCandidate.context.chunks[0]!.text = "uncited-private-canary";
    data.view.committedChunks[0]!.text = "uncited-private-canary";
    data.view.confusionEvents.push({
      ...data.event,
      confusionId: "confusion_other",
      assistanceResponseId: "response_other",
      conceptTitle: "unrelated-private-canary",
    });
    let calls = 0;
    const { hooks } = createHooks(
      vi.fn(async (_url, options) => {
        calls += 1;
        const kind: TrialCallKind = calls === 1 ? "help_verify" : "practice_verify";
        const { request, payload } = sentInput(options, kind);
        expect(JSON.stringify(payload)).not.toContain("private-canary");
        expect(request.systemInstruction.parts[0]!.text).toContain("separate");
        expect(request.systemInstruction.parts[0]!.text).toContain("Ignore");
        if (kind === "help_verify") {
          expect(payload.candidate).toEqual(data.modelOutput);
          expect(payload.citedPassages).toEqual(data.helpCandidate.citedChunks);
          return modelResponse(helpVerdict);
        }
        expect(payload.candidate).toEqual(data.drill);
        expect(payload.confusion).toEqual(data.event);
        return modelResponse(practiceVerdict);
      }),
    );
    await expect(
      hooks.verifyHelp(data.helpCandidate, new AbortController().signal),
    ).resolves.toEqual(helpVerdict);
    await expect(
      hooks.verifyPractice(
        { view: data.view, confusionEvent: data.event, drill: data.drill },
        new AbortController().signal,
      ),
    ).resolves.toEqual(practiceVerdict);
  });

  it.each(["help_verify", "practice_verify"] as const)(
    "requires every independent %s check exactly once",
    async (kind) => {
      const data = await fixture();
      for (const invalid of [
        { verdict: "supported" },
        kind === "help_verify"
          ? { ...helpVerdict, supportedClaims: Array(5).fill("main_idea") }
          : { ...practiceVerdict, supportedChecks: Array(4).fill("answer_correct") },
        { ...(kind === "help_verify" ? helpVerdict : practiceVerdict), generatorConfidence: 1 },
      ]) {
        const { hooks } = createHooks(vi.fn(async () => modelResponse(invalid)));
        const result =
          kind === "help_verify"
            ? hooks.verifyHelp(data.helpCandidate, new AbortController().signal)
            : hooks.verifyPractice(
                { view: data.view, confusionEvent: data.event, drill: data.drill },
                new AbortController().signal,
              );
        await expect(result).rejects.toMatchObject({ code: "output" });
      }
    },
  );

  it("returns valid rejection without turning it into approval", async () => {
    const data = await fixture();
    const { hooks } = createHooks(vi.fn(async () => modelResponse({ verdict: "unsupported" })));
    expect(await hooks.verifyHelp(data.helpCandidate, new AbortController().signal)).toEqual({
      verdict: "unsupported",
    });
    expect(
      await hooks.verifyPractice(
        { view: data.view, confusionEvent: data.event, drill: data.drill },
        new AbortController().signal,
      ),
    ).toEqual({ verdict: "unsupported" });
  });

  it("keeps quoted transcript instructions in user data and accepts the structured insufficient result", async () => {
    const data = await fixture(9);
    const result = {
      groundingStatus: "insufficient_evidence",
      context: data.context.reference,
      followUpActions: ["ask_follow_up"],
    };
    const passage = data.context.chunks.find((chunk) => chunk.chunkId === "chunk_calc_007")!;
    const { hooks, meter } = createHooks(
      vi.fn(async (_url, options) => {
        const { request, payload } = sentInput(options, "help_generate");
        expect(request.systemInstruction.parts[0]!.text).not.toContain(passage.text);
        expect(request.systemInstruction.parts[0]!.text).toContain("quoted instructions");
        expect(request.contents[0]!.role).toBe("user");
        expect(payload.context).toEqual(data.context);
        return modelResponse(result);
      }),
    );
    expect(await hooks.generateHelp(data.context, new AbortController().signal)).toEqual(result);
    expect(meter.reserve).toHaveBeenCalledOnce();
  });

  it("rejects unsupported input identity before any reservation or request", async () => {
    const data = await fixture();
    const { hooks, meter } = createHooks(vi.fn(async () => modelResponse({})));
    await expect(
      hooks.generatePractice(
        { ...data.event, confusionId: "confusion_missing" },
        data.drill.drillId,
        { view: data.view, signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ code: "input" });
    const changed = structuredClone(data.helpCandidate);
    changed.citedChunks[0]!.text = "Unsupported evidence";
    await expect(hooks.verifyHelp(changed, new AbortController().signal)).rejects.toMatchObject({
      code: "input",
    });
    expect(meter.reserve).not.toHaveBeenCalled();
  });

  it("wraps every strict JSON schema and hashes fixed prompts without importing the evaluation oracle", () => {
    const names = Object.keys(TrialInstructions) as TrialCallKind[];
    expect(names).toEqual(["help_generate", "help_verify", "practice_generate", "practice_verify"]);
    expect(new Set(Object.values(TRIAL_PROMPT_HASHES)).size).toBe(4);
    function inspect(value: unknown) {
      if (!value || typeof value !== "object") return;
      const item = value as Record<string, unknown>;
      if (item.type === "object") {
        expect(item.additionalProperties).toBe(false);
        expect(item.required).toEqual(Object.keys(item.properties as object));
      }
      Object.values(item).forEach(inspect);
    }
    for (const kind of names) {
      expect(OutputJsonSchemas[kind].type).toBe("object");
      expect(OutputJsonSchemas[kind]).not.toHaveProperty("anyOf");
      inspect(OutputJsonSchemas[kind]);
      expect(TRIAL_PROMPT_HASHES[kind]).toBe(
        createHash("sha256")
          .update(
            JSON.stringify({
              version: TRIAL_PROMPT_VERSION,
              instructions: TrialInstructions[kind],
              schema: OutputJsonSchemas[kind],
              ...(kind.startsWith("practice") ? { benchmarkQuestions: BENCHMARK_QUESTIONS } : {}),
            }),
          )
          .digest("hex"),
      );
    }
    const prompts = JSON.stringify({
      instructions: TrialInstructions,
      questions: BENCHMARK_QUESTIONS,
    });
    for (const answer of ["g(x) = 2x + 3; f(u) = u⁴", "8(2x + 3)³", "2x cos(x²)"])
      expect(prompts).not.toContain(answer);
    for (const name of ["index.ts", "prompts.ts", "schemas.ts", "transport.ts"]) {
      const source = readFileSync(new URL(name, import.meta.url), "utf8");
      expect(source).not.toMatch(
        /(?:from|import\()[^\n]*(?:ai-evaluation\/cases|scripted-help|scripted-practice|scripted-verifier)/,
      );
    }
  });
});
