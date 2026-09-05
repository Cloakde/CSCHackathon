import {
  formatOffset,
  ImLostResponseSchema,
  isReplayableTranscriptSource,
  SimulationTranscriptSource,
  type ActiveLectureSession,
  type ImLostResponse,
  type PartialTranscriptChunk,
  type TranscriptChunk,
  type TranscriptSource,
} from "@livelecture/shared";
import { useEffect, useRef, useState } from "react";
import { createDemoClient, type DemoClient } from "./demo-api";
import { demoHandoffUrl, type CompanionDestination } from "./demo-handoff";
import { createDemoUploader, type DemoUploader } from "./demo-uploader";

interface AppProps {
  source?: TranscriptSource;
  client?: DemoClient;
  navigate?: (url: string) => void;
  companionDestination?: CompanionDestination;
}

type Operation = "start" | "help" | "end" | "reset";
const speedOptions = [1, 12, 60, 240];
// The unchanged local demo client requests a fifteen-minute grounding window.
const helpLookbackMs = 900_000;

export function App({
  source: providedSource,
  client: providedClient,
  navigate,
  companionDestination = "prototype",
}: AppProps) {
  const [fallbackSource] = useState(() => {
    const source = new SimulationTranscriptSource();
    source.setSpeed(12);
    return source;
  });
  const [fallbackClient] = useState(() => createDemoClient());
  const client = providedClient ?? fallbackClient;
  const source = providedSource ?? fallbackSource;
  const [snapshot, setSnapshot] = useState(source.getSnapshot());
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [partial, setPartial] = useState<PartialTranscriptChunk>();
  const [session, setSession] = useState<ActiveLectureSession>();
  const [help, setHelp] = useState<ImLostResponse>();
  const [savedConcepts, setSavedConcepts] = useState<string[]>([]);
  const [handoff, setHandoff] = useState<string>();
  const [highlighted, setHighlighted] = useState<string>();
  const [busy, setBusy] = useState<Operation>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState<Operation>();
  const [uploadError, setUploadError] = useState<string>();
  const sessionRef = useRef<ActiveLectureSession | undefined>(undefined);
  const chunksRef = useRef<TranscriptChunk[]>([]);
  const uploaderRef = useRef<DemoUploader | undefined>(undefined);
  const generationRef = useRef(0);
  const busyRef = useRef<Operation | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const completedRef = useRef(false);
  const rowsRef = useRef(new Map<string, HTMLElement>());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generationRef.current += 1;
    busyRef.current = undefined;
    sessionRef.current = undefined;
    chunksRef.current = [];
    uploaderRef.current?.cancel();
    uploaderRef.current = undefined;
    completedRef.current = false;
    setSnapshot(source.getSnapshot());
    setChunks([]);
    setPartial(undefined);
    setSession(undefined);
    setHelp(undefined);
    setSavedConcepts([]);
    setHandoff(undefined);
    setHighlighted(undefined);
    setBusy(undefined);
    setError(undefined);
    setRetry(undefined);
    setUploadError(undefined);
    const unsubscribe = source.subscribe((event) => {
      const currentSession = sessionRef.current;
      if (!currentSession || completedRef.current) return;
      if (event.type === "transcript.partial") {
        setPartial({ ...event.chunk, sessionId: currentSession.sessionId });
      }
      if (event.type === "transcript.committed") {
        if (!chunksRef.current.some((chunk) => chunk.chunkId === event.chunk.chunkId)) {
          chunksRef.current = [
            ...chunksRef.current,
            { ...event.chunk, sessionId: currentSession.sessionId },
          ].sort((left, right) => left.sequence - right.sequence);
          setChunks(chunksRef.current);
          uploaderRef.current?.enqueue({ ...event.chunk, sessionId: currentSession.sessionId });
        }
        setPartial(undefined);
      }
      if (event.type === "session.ended") {
        source.stop();
        setPartial(undefined);
      }
      setSnapshot(source.getSnapshot());
    });
    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
      uploaderRef.current?.cancel();
      unsubscribe();
      source.stop();
    };
  }, [source]);

  useEffect(() => {
    // Keep a selected citation in view while the lecture continues.
    if (highlighted || (chunks.length === 0 && !partial)) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transcriptEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [chunks, partial, highlighted]);

  function setOperation(operation: Operation | undefined) {
    busyRef.current = operation;
    setBusy(operation);
  }

  async function run(operation: Operation) {
    if (operation !== "reset" && busyRef.current) return;
    if (operation === "reset" && busyRef.current === "reset") return;
    if (operation === "start" && (sessionRef.current || source.getSnapshot().mode !== "simulation"))
      return;
    if (
      (operation === "help" || operation === "end") &&
      (!sessionRef.current || completedRef.current)
    )
      return;
    if (operation === "reset") {
      generationRef.current += 1;
      abortRef.current?.abort();
      uploaderRef.current?.cancel();
      uploaderRef.current = undefined;
      setUploadError(undefined);
      source.stop();
      setSnapshot(source.getSnapshot());
    }
    const generation = generationRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setOperation(operation);
    setError(undefined);
    setRetry(undefined);
    const current = () => generation === generationRef.current && !controller.signal.aborted;
    try {
      if (operation === "start") {
        const created = await client.start(
          {
            sourceMode: "simulation",
            title: source.getSnapshot().session.title,
            subject: source.getSnapshot().session.subject,
          },
          controller.signal,
        );
        if (!current()) {
          // An injected/slow transport may still deliver a Start after cancellation.
          await client.remove(created.sessionId).catch(() => undefined);
          return;
        }
        sessionRef.current = created;
        setSession(created);
        uploaderRef.current = createDemoUploader({
          sessionId: created.sessionId,
          append: (...args) => client.append(...args),
          onFailure: (failure) => {
            if (
              generation === generationRef.current &&
              sessionRef.current?.sessionId === created.sessionId
            ) {
              setUploadError(failure.message);
            }
          },
        });
        if (isReplayableTranscriptSource(source)) source.reset();
        source.start();
        setSnapshot(source.getSnapshot());
      } else if (operation === "reset") {
        const existing = sessionRef.current;
        if (existing) await client.remove(existing.sessionId, controller.signal);
        if (!current()) return;
        if (isReplayableTranscriptSource(source)) source.reset();
        sessionRef.current = undefined;
        chunksRef.current = [];
        completedRef.current = false;
        setSession(undefined);
        setChunks([]);
        setPartial(undefined);
        setHelp(undefined);
        setSavedConcepts([]);
        setHandoff(undefined);
        setHighlighted(undefined);
        setUploadError(undefined);
        setSnapshot(source.getSnapshot());
      } else {
        const existing = sessionRef.current;
        if (!existing) return;
        if (operation === "end") {
          source.stop();
          setPartial(undefined);
          setSnapshot(source.getSnapshot());
        }
        const uploader = uploaderRef.current;
        if (!uploader) throw new Error("Reset and delete this session before starting again.");
        // Wait for passages already visible; newer passages keep uploading while Help runs.
        await uploader.flush();
        if (!current()) return;
        const minimumAnchorSequence = uploader.getAcknowledged().at(-1)?.sequence ?? -1;
        if (operation === "help") {
          const incoming = await client.help(existing.sessionId, controller.signal);
          if (!current()) return;
          const parsed = ImLostResponseSchema.safeParse(incoming);
          if (!parsed.success)
            throw new Error(
              "This explanation did not match the lecture passage. Try I’m Lost again.",
            );
          const answer = parsed.data;
          const context = chunksRef.current;
          const event = answer.confusionEvent;
          const anchor = context.find((chunk) => chunk.chunkId === event.anchorChunkId);
          const expectedContext = context.filter(
            (chunk) =>
              chunk.endMs >= Math.max(0, event.occurredAtMs - helpLookbackMs) &&
              chunk.endMs <= event.occurredAtMs,
          );
          const invalidContext =
            answer.sessionId !== existing.sessionId ||
            (anchor?.sequence ?? -1) < minimumAnchorSequence ||
            event.occurredAtMs !== (anchor?.endMs ?? 0) ||
            (event.anchorChunkId !== undefined && !anchor) ||
            event.contextChunkIds.length !== expectedContext.length ||
            event.contextChunkIds.some((id, index) => id !== expectedContext[index]?.chunkId);
          const invalidCitation = answer.citations.some(
            (citation) =>
              !context.some(
                (chunk) =>
                  chunk.chunkId === citation.chunkId &&
                  chunk.startMs === citation.startMs &&
                  chunk.endMs === citation.endMs,
              ),
          );
          if (invalidContext || invalidCitation)
            throw new Error(
              "This explanation did not match the lecture passage. Try I’m Lost again.",
            );
          setHelp(answer);
          setHighlighted(undefined);
          if (answer.groundingStatus === "grounded" && event.conceptTitle) {
            const title = event.conceptTitle;
            setSavedConcepts((previous) =>
              previous.includes(title) ? previous : [...previous, title],
            );
          }
        } else {
          const endedAt = new Date(
            Date.parse(existing.startedAt) + (chunksRef.current.at(-1)?.endMs ?? 0),
          ).toISOString();
          const result = await client.end(existing.sessionId, endedAt, controller.signal);
          if (!current()) return;
          const destination = demoHandoffUrl(companionDestination, existing.sessionId, result);
          completedRef.current = true;
          setHandoff(destination);
        }
      }
    } catch (failure) {
      if (current()) {
        if (failure !== uploaderRef.current?.getFailure()) {
          setError(
            failure instanceof Error ? failure.message : "Something went wrong. Please try again.",
          );
          setRetry(operation);
        }
      }
    } finally {
      if (current()) setOperation(undefined);
    }
  }

  function jumpToCitation(chunkId: string) {
    const row = rowsRef.current.get(chunkId);
    if (!row) {
      setError("That lecture passage is no longer available. Try I’m Lost again.");
      return;
    }
    setHighlighted(chunkId);
    row.scrollIntoView({ behavior: "auto", block: "center" });
    row.focus({ preventScroll: true });
  }

  const replay = isReplayableTranscriptSource(source) ? source.getSnapshot().replay : undefined;
  const running = snapshot.status === "active" || snapshot.status === "starting";
  const progressMs = chunks.at(-1)?.endMs ?? 0;
  const status = handoff
    ? "Finished"
    : running
      ? replay?.isPaused
        ? "Paused"
        : "Playing"
      : session
        ? "Replay stopped"
        : "Ready";
  const title = snapshot.session.title ?? "Sample lecture";
  const liveUnavailable = snapshot.mode !== "simulation";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">LiveLecture AI</p>
          <h1>{title}</h1>
        </div>
        <span className="source-pill" role="status">
          {status}
        </span>
      </header>
      <section className="simulation-banner" aria-label="SIMULATION source disclosure">
        <strong>SIMULATION</strong>
        <span>Synthetic lecture text — no audio is being captured.</span>
      </section>
      <p className="demo-disclosure">
        <strong>PREWRITTEN DEMO HELP</strong> — no AI provider used.
      </p>
      <section className="journey-guide" aria-label="How to try the demo">
        <p>Follow a lecture. Get unstuck. Practice what was hard.</p>
        <ol>
          <li>Start the sample lecture.</li>
          <li>
            Press <strong>I’m Lost</strong> when a step is unclear.
          </li>
          <li>Finish and try practice chosen for that difficulty.</li>
        </ol>
      </section>
      {liveUnavailable ? (
        <p role="alert">Live audio is not enabled in this demo. Use the sample lecture.</p>
      ) : null}
      {error ? (
        <div className="error-message" role="alert">
          <p>{error}</p>
          {retry ? (
            <button type="button" disabled={Boolean(busy)} onClick={() => void run(retry)}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
      {uploadError ? (
        <div className="error-message" role="alert">
          <p>{uploadError} Your visible passages are kept here until they can be saved.</p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              const uploader = uploaderRef.current;
              if (!uploader) return;
              setUploadError(undefined);
              void uploader.retry().catch(() => undefined);
            }}
          >
            Retry saving transcript
          </button>
        </div>
      ) : null}
      <section className="controls" aria-label="Lecture controls">
        <button
          className="primary-button"
          type="button"
          disabled={Boolean(session) || Boolean(busy) || liveUnavailable}
          onClick={() => void run("start")}
        >
          {busy === "start" ? "Starting…" : "Start sample lecture"}
        </button>
        <button
          type="button"
          onClick={() => {
            source.stop();
            setPartial(undefined);
            setSnapshot(source.getSnapshot());
          }}
          disabled={!running}
        >
          Stop replay
        </button>
        {replay ? (
          <>
            <button
              type="button"
              disabled={!running}
              onClick={() => {
                if (!isReplayableTranscriptSource(source)) return;
                if (replay.isPaused) source.resume();
                else source.pause();
                setSnapshot(source.getSnapshot());
              }}
            >
              {replay.isPaused ? "Resume" : "Pause"}
            </button>
            <label className="speed-control">
              <span>Speed</span>
              <select
                value={replay.speed}
                onChange={(event) => {
                  if (isReplayableTranscriptSource(source))
                    source.setSpeed(Number(event.target.value));
                  setSnapshot(source.getSnapshot());
                }}
              >
                {speedOptions.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <button
          type="button"
          disabled={(!session && !busy) || busy === "reset"}
          onClick={() => void run("reset")}
        >
          {busy === "reset" ? "Deleting…" : "Reset & delete session"}
        </button>
      </section>
      <section className="learning-actions" aria-label="Get help and practice">
        <div>
          <p className="eyebrow">{formatOffset(progressMs)} of 8:00</p>
          <p>
            {progressMs < 145_000
              ? "Wait for the first explanation, then ask for help."
              : progressMs < 300_000
                ? "Try I’m Lost for help spotting the inner and outer functions."
                : "Try I’m Lost for help remembering the inner derivative."}
          </p>
        </div>
        <div className="action-buttons">
          <button
            className="primary-button"
            type="button"
            disabled={
              !session ||
              Boolean(busy) ||
              Boolean(handoff) ||
              Boolean(uploadError) ||
              !uploaderRef.current
            }
            onClick={() => void run("help")}
          >
            {busy === "help" ? "Preparing help…" : "I’m Lost"}
          </button>
          <button
            type="button"
            disabled={
              !session ||
              Boolean(busy) ||
              Boolean(handoff) ||
              Boolean(uploadError) ||
              !uploaderRef.current
            }
            onClick={() => void run("end")}
          >
            {busy === "end" ? "Finishing…" : "Finish lecture"}
          </button>
        </div>
        {savedConcepts.length > 0 ? (
          <p className="saved-message">Saved for practice: {savedConcepts.join(" · ")}</p>
        ) : null}
        {handoff ? (
          <div className="handoff">
            <p>
              {savedConcepts.length
                ? "Your difficult moments are ready to practice."
                : companionDestination === "meltingpot"
                  ? "Lecture finished. Open MeltingPot to review this session."
                  : "Lecture finished. Open the companion app to review this session."}
            </p>
            <a
              className="primary-button"
              href={handoff}
              target="_blank"
              rel="noopener noreferrer"
              onClick={
                navigate
                  ? (event) => {
                      event.preventDefault();
                      navigate(handoff);
                    }
                  : undefined
              }
            >
              {companionDestination === "meltingpot" ? "Open in MeltingPot" : "Open my practice"}
            </a>
            <p className="small-note">
              {companionDestination === "meltingpot"
                ? "Opens MeltingPot in a new tab. If it is unavailable, start the MeltingPot rework app and use this link again. Keep both local demo servers running."
                : "Opens the companion app in a new tab. Keep the local demo server running."}
            </p>
          </div>
        ) : null}
      </section>
      {help ? (
        <section className="help-panel" aria-labelledby="help-heading" aria-live="polite">
          <p className="eyebrow">
            Help for this moment · {formatOffset(help.confusionEvent.occurredAtMs)}
          </p>
          <h2 id="help-heading">
            {help.confusionEvent.conceptTitle ?? "A little more lecture is needed"}
          </h2>
          {help.groundingStatus === "grounded" ? (
            <>
              <p>{help.diagnosis.simpleExplanation}</p>
              <details>
                <summary>See the steps and the idea to remember</summary>
                <p>
                  <strong>What just happened:</strong> {help.diagnosis.whatJustHappened}
                </p>
                <p>
                  <strong>Main idea:</strong> {help.diagnosis.mainIdea}
                </p>
                <p>
                  <strong>Remember:</strong> {help.diagnosis.importantPrerequisite}
                </p>
              </details>
              <p className="citation-label">Check the lecture passage:</p>
              <div className="citations">
                {help.citations.map((citation) => (
                  <button
                    key={citation.chunkId}
                    type="button"
                    onClick={() => jumpToCitation(citation.chunkId)}
                  >
                    Go to {formatOffset(citation.startMs)}–{formatOffset(citation.endMs)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>
              {help.message} Let a little more of the sample lecture play, then try I’m Lost again.
            </p>
          )}
        </section>
      ) : null}
      <section className="transcript-panel" aria-labelledby="transcript-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Sample lecture · {chunks.length} passages</p>
            <h2 id="transcript-heading">What the class is covering</h2>
          </div>
          {highlighted ? (
            <button type="button" onClick={() => setHighlighted(undefined)}>
              Follow latest
            </button>
          ) : null}
        </div>
        <div
          className="transcript"
          role="log"
          aria-label="Lecture transcript"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {chunks.length === 0 && !partial ? (
            <div className="empty-state">
              <span className="empty-glyph">0:00</span>
              <p>
                Start the sample lecture to watch its words appear here. No microphone or recording
                is used.
              </p>
            </div>
          ) : null}
          {chunks.map((chunk) => (
            <article
              key={chunk.chunkId}
              ref={(element) => {
                if (element) rowsRef.current.set(chunk.chunkId, element);
                else rowsRef.current.delete(chunk.chunkId);
              }}
              tabIndex={-1}
              className={`transcript-row${highlighted === chunk.chunkId ? " citation-highlight" : ""}`}
              data-chunk-id={chunk.chunkId}
              aria-label={`Lecture passage at ${formatOffset(chunk.startMs)}`}
            >
              <time dateTime={`PT${Math.floor(chunk.startMs / 1_000)}S`}>
                {formatOffset(chunk.startMs)}
              </time>
              <div>
                <strong>{chunk.speakerLabel ?? "Lecturer"}</strong>
                <p>{chunk.text}</p>
              </div>
            </article>
          ))}
          {partial ? (
            <article className="transcript-row partial-row" aria-label="Partial transcript">
              <time>{formatOffset(partial.startMs)}</time>
              <p>{partial.text}</p>
            </article>
          ) : null}
          <div ref={transcriptEndRef} />
        </div>
      </section>
      <p className="small-note">
        This local demo keeps sessions temporarily in memory. Reset deletes this session; restarting
        the server clears all sessions. Closing this page stops replay.
      </p>
    </main>
  );
}
