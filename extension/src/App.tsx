import {
  formatOffset,
  isReplayableTranscriptSource,
  SimulationTranscriptSource,
  type PartialTranscriptChunk,
  type TranscriptChunk,
  type TranscriptEvent,
  type TranscriptSource,
} from "@livelecture/shared";
import { useCallback, useEffect, useRef, useState } from "react";

interface AppProps {
  source?: TranscriptSource;
}

const speedOptions = [1, 12, 60, 240] as const;

function upsertChunk(chunks: TranscriptChunk[], incoming: TranscriptChunk): TranscriptChunk[] {
  if (chunks.some((chunk) => chunk.chunkId === incoming.chunkId)) return chunks;
  return [...chunks, incoming].sort((left, right) => left.sequence - right.sequence);
}

export function App({ source: providedSource }: AppProps) {
  const [fallbackSource] = useState<TranscriptSource>(() => new SimulationTranscriptSource());
  const source = providedSource ?? fallbackSource;
  const [snapshot, setSnapshot] = useState(source.getSnapshot());
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [partial, setPartial] = useState<PartialTranscriptChunk>();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const syncSnapshot = useCallback(() => setSnapshot(source.getSnapshot()), [source]);

  useEffect(() => {
    setSnapshot(source.getSnapshot());
    setChunks([]);
    setPartial(undefined);
    const unsubscribe = source.subscribe((event: TranscriptEvent) => {
      if (event.type === "transcript.partial") setPartial(event.chunk);
      if (event.type === "transcript.committed") {
        setChunks((current) => upsertChunk(current, event.chunk));
        setPartial(undefined);
      }
      if (event.type === "session.started") {
        setChunks([]);
        setPartial(undefined);
      }
      syncSnapshot();
    });
    return unsubscribe;
  }, [source, syncSnapshot]);

  useEffect(() => {
    if (chunks.length === 0 && !partial) return;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transcriptEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [chunks, partial]);

  const handleStart = () => {
    if (snapshot.status === "stopped" && isReplayableTranscriptSource(source)) {
      source.reset();
      setChunks([]);
      setPartial(undefined);
    }
    source.start();
    syncSnapshot();
  };

  const handlePauseToggle = () => {
    if (!isReplayableTranscriptSource(source)) return;

    if (source.getSnapshot().replay.isPaused) source.resume();
    else source.pause();
    syncSnapshot();
  };

  const handleStop = () => {
    source.stop();
    setPartial(undefined);
    syncSnapshot();
  };

  const handleReset = () => {
    if (!isReplayableTranscriptSource(source)) return;

    source.reset();
    setChunks([]);
    setPartial(undefined);
    syncSnapshot();
  };

  const handleSpeed = (speed: number) => {
    if (!isReplayableTranscriptSource(source)) return;

    source.setSpeed(speed);
    syncSnapshot();
  };

  const replaySnapshot = isReplayableTranscriptSource(source)
    ? source.getSnapshot().replay
    : undefined;
  const sourceLabel = snapshot.mode === "simulation" ? "SIMULATION" : "LIVE";
  const sourceDescription =
    snapshot.mode === "simulation"
      ? "Synthetic transcript — no audio is being captured"
      : "Selected-tab audio source — use Stop to end capture";
  const sourceSummary = snapshot.mode === "simulation" ? "Fixture replay" : "Selected-tab audio";
  const sessionTitle = snapshot.session.title ?? snapshot.session.subject ?? "Untitled lecture";
  const statusLabel = `${snapshot.status.slice(0, 1).toUpperCase()}${snapshot.status.slice(1)}`;
  const progressLabel = snapshot.progress
    ? `${snapshot.progress.current}/${snapshot.progress.total} events`
    : statusLabel;
  const isRunning = snapshot.status === "active" || snapshot.status === "starting";
  const canStop = isRunning || snapshot.status === "stopping";
  const isStartDisabled = isRunning || snapshot.status === "stopping";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          LL
        </div>
        <div>
          <p className="eyebrow">LiveLecture AI</p>
          <h1>{sessionTitle}</h1>
        </div>
        <span
          className={`source-pill status-${snapshot.status}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {sourceLabel} · {statusLabel}
        </span>
      </header>

      <section className="simulation-banner" aria-label={`${sourceLabel} source disclosure`}>
        <strong>{sourceLabel}</strong>
        <span>{sourceDescription}</span>
      </section>

      <section className="session-summary" aria-label="Session summary">
        <div>
          <span className="summary-label">Source</span>
          <strong>{sourceSummary}</strong>
        </div>
        <div>
          <span className="summary-label">Progress</span>
          <strong>{progressLabel}</strong>
        </div>
        <div>
          <span className="summary-label">Committed</span>
          <strong>{chunks.length} chunks</strong>
        </div>
      </section>

      <section className="controls" aria-label="Transcript source controls">
        <button
          className="primary-button"
          type="button"
          onClick={handleStart}
          disabled={isStartDisabled}
        >
          {replaySnapshot && snapshot.status === "stopped" ? "Replay" : "Start"}
        </button>
        <button type="button" onClick={handleStop} disabled={!canStop}>
          Stop
        </button>
        {replaySnapshot ? (
          <>
            <button
              type="button"
              onClick={handlePauseToggle}
              disabled={snapshot.status !== "active"}
            >
              {replaySnapshot.isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={snapshot.status === "idle" && chunks.length === 0}
            >
              Reset
            </button>
            <label className="speed-control">
              <span>Speed</span>
              <select
                value={replaySnapshot.speed}
                onChange={(event) => handleSpeed(Number(event.target.value))}
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
      </section>

      <section className="transcript-panel" aria-labelledby="transcript-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lecture transcript</p>
            <h2 id="transcript-heading">What the class is covering</h2>
          </div>
          <span className="source-pill">{sourceLabel}</span>
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
              <span className="empty-glyph" aria-hidden="true">
                00:00
              </span>
              <p>
                {snapshot.mode === "simulation"
                  ? "Start the deterministic replay to verify the transcript interface."
                  : "Start the live source to begin the transcript."}
              </p>
            </div>
          ) : null}

          {chunks.map((chunk) => (
            <article className="transcript-row" key={chunk.chunkId} data-chunk-id={chunk.chunkId}>
              <time dateTime={`PT${Math.floor(chunk.startMs / 1_000)}S`}>
                {formatOffset(chunk.startMs)}
              </time>
              <div>
                {chunk.speakerLabel ? <strong>{chunk.speakerLabel}</strong> : null}
                <p>{chunk.text}</p>
              </div>
            </article>
          ))}

          {partial ? (
            <article className="transcript-row partial-row" aria-label="Partial transcript">
              <time dateTime={`PT${Math.floor(partial.startMs / 1_000)}S`}>
                {formatOffset(partial.startMs)}
              </time>
              <div>
                <strong>{partial.speakerLabel ?? "Speaker"}</strong>
                <p>
                  {partial.text}
                  <span className="typing-cursor" aria-hidden="true" />
                </p>
              </div>
            </article>
          ) : null}
          <div ref={transcriptEndRef} />
        </div>
      </section>

      <p className="bootstrap-note">
        {snapshot.mode === "simulation"
          ? "Bootstrap proves fixture → validated events → transcript UI. Live capture and provider calls are intentionally not enabled yet."
          : "Transcript events are supplied through the shared source boundary. Check the visible source state before capture."}
      </p>
    </main>
  );
}
