import {
  ApiContracts,
  ApiErrorSchema,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  getCommittedChunksFromFixture,
  type ImLostResponse,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";
import { DEMO_ORIGIN } from "../../demo-api";
import { AI_EVALUATION_CASES } from "../cases";

export type TrialDispatcher = (request: Request) => Promise<Response>;
export type FrozenCase = (typeof AI_EVALUATION_CASES)[number];
export interface TrialScenarioResult {
  id: string;
  timingPath:
    "dispatcher" | "extension_component_real_clock" | "extension_component_injected_clock";
  status: "observed_for_review" | "changes_required";
  helpDurationMs?: number;
  practiceDurationMs?: number;
  overlapObserved?: boolean;
  sourceSpeed?: number;
  sourcePaused?: boolean;
  confusionCount?: number;
  citationFocus?: boolean;
  help?: ImLostResponse;
  practice?: WeakAreaDrillResponse;
  failure?: string;
  expected: { conceptId: string | null; evidenceIds: readonly string[]; answer: string | null };
  comparisons?: { conceptMatches: boolean; expectedEvidencePresent: boolean };
}

export function scenarioRecord(fixture: FrozenCase): TrialScenarioResult {
  return {
    id: fixture.id,
    timingPath: "dispatcher",
    status: "changes_required",
    expected: {
      conceptId: fixture.conceptId,
      evidenceIds: fixture.evidenceIds,
      answer: fixture.expectedAnswer,
    },
  };
}

/** Expected review material never enters these API bodies or provider inputs. */
export function invoke(dispatcher: TrialDispatcher, path: string, method = "POST", body?: unknown) {
  return dispatcher(
    new Request(`${DEMO_ORIGIN}${path}`, {
      method,
      headers: {
        Host: "127.0.0.1:3000",
        "X-LiveLecture-Demo": "scripted-v1",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

export function recordComparisons(result: TrialScenarioResult) {
  if (!result.help) return;
  result.comparisons = {
    conceptMatches: (result.help.confusionEvent.conceptId ?? null) === result.expected.conceptId,
    expectedEvidencePresent: result.expected.evidenceIds.every((id) =>
      result.help!.citations.some((citation) => citation.chunkId === id),
    ),
  };
  // Equivalent prose and alternate evidence need human judgment, not string grading.
}

export async function runStaticScenario(
  dispatcher: TrialDispatcher,
  fixture: FrozenCase,
): Promise<TrialScenarioResult> {
  const result = scenarioRecord(fixture);
  let path = "";
  let stage = "start";
  try {
    const started = ApiContracts.startSession.response.parse(
      await (
        await invoke(dispatcher, "/api/sessions", "POST", { sourceMode: "simulation" })
      ).json(),
    );
    if (!started.ok) throw new Error();
    const session = started.data.session;
    path = `/api/sessions/${session.sessionId}`;
    const chunks = getCommittedChunksFromFixture()
      .slice(0, fixture.chunkCount)
      .map((chunk) => ({ ...chunk, sessionId: session.sessionId }));
    stage = "append";
    const appended = await invoke(dispatcher, `${path}/chunks`, "POST", { chunks });
    if (!appended.ok) throw new Error();
    stage = "help";
    const helpStart = performance.now();
    const helpResponse = await invoke(dispatcher, `${path}/im-lost`, "POST", {
      lookbackMs: fixture.lookbackMs,
    });
    result.helpDurationMs = performance.now() - helpStart;
    const help = ApiContracts.imLost.response.parse(await helpResponse.json());
    if (!help.ok) throw new Error();
    result.help = help.data;
    recordComparisons(result);
    stage = "finish";
    const ended = await invoke(dispatcher, `${path}/end`, "POST", {
      endedAt: new Date(Date.parse(session.startedAt) + fixture.anchorMs).toISOString(),
    });
    if (!ended.ok) throw new Error();
    const view = ApiContracts.getSession.response.parse(
      await (await invoke(dispatcher, path, "GET")).json(),
    );
    if (!view.ok) throw new Error();
    result.confusionCount = view.data.confusionEvents.length;
    stage = "practice";
    const practiceStart = performance.now();
    const practiceResponse = await invoke(dispatcher, `${path}/weak-area-drills`, "POST", {
      confusionEventIds: [help.data.confusionEvent.confusionId],
    });
    result.practiceDurationMs = performance.now() - practiceStart;
    const practiceBody: unknown = await practiceResponse.json();
    if (fixture.id === "insufficient") {
      const failure = ApiErrorSchema.parse(practiceBody);
      if (
        help.data.groundingStatus !== "insufficient_evidence" ||
        help.data.message !== INSUFFICIENT_EVIDENCE_MESSAGE ||
        help.data.citations.length !== 0 ||
        practiceResponse.status !== 400 ||
        failure.error.code !== "INSUFFICIENT_CONTEXT"
      )
        throw new Error();
    } else {
      if (help.data.groundingStatus !== "grounded") throw new Error();
      const practice = ApiContracts.createWeakAreaDrill.response.parse(practiceBody);
      if (!practice.ok) throw new Error();
      result.practice = practice.data;
    }
    if (
      result.confusionCount !== 1 ||
      result.helpDurationMs > 10_000 ||
      result.practiceDurationMs > 4_000
    )
      throw new Error();
    result.status = "observed_for_review";
  } catch {
    result.failure = `${stage}_failed`;
  } finally {
    if (path) {
      const deleted = await invoke(dispatcher, path, "DELETE");
      if (!deleted.ok) {
        result.status = "changes_required";
        result.failure = "cleanup_failed";
      }
    }
  }
  return result;
}
