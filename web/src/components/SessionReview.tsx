"use client";

import { useEffect, useRef, useState } from "react";
import {
  assertWeakAreaDrillLinkage,
  formatOffset,
  type SessionView,
  type WeakAreaDrillResponse,
} from "@livelecture/shared";
import { createStudyClient, studyErrorMessage, type StudyClient } from "../lib/client/study-client";
import styles from "./SessionReview.module.css";

const defaultClient = createStudyClient();

export function SessionReview({
  sessionId,
  client = defaultClient,
}: {
  sessionId: string;
  client?: StudyClient;
}) {
  const [view, setView] = useState<SessionView>();
  const [selected, setSelected] = useState("");
  const [drill, setDrill] = useState<WeakAreaDrillResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("loading");
  const [deleted, setDeleted] = useState(false);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [itemIndex, setItemIndex] = useState(0);
  const [highlight, setHighlight] = useState("");
  const transcript = useRef<HTMLDetailsElement>(null);
  const operation = useRef<{ revision: number; controller?: AbortController }>({ revision: 0 });

  function cancel() {
    operation.current.controller?.abort();
    operation.current.revision += 1;
  }
  function begin() {
    cancel();
    const controller = new AbortController();
    operation.current.controller = controller;
    return { revision: operation.current.revision, signal: controller.signal };
  }
  const current = (revision: number) => operation.current.revision === revision;

  useEffect(() => {
    const task = begin();
    setView(undefined);
    setDrill(undefined);
    setDeleted(false);
    setError("");
    setBusy("loading");
    void client
      .getSession(sessionId, task.signal)
      .then((result) => {
        if (!current(task.revision)) return;
        setView(result);
        setSelected(result.confusionEvents.find((event) => event.conceptId)?.confusionId ?? "");
        setBusy("");
      })
      .catch((reason: unknown) => {
        if (!current(task.revision)) return;
        setError(studyErrorMessage(reason));
        setBusy("");
      });
    return cancel;
  }, [sessionId, client, reload]);

  function clearExercise() {
    setDrill(undefined);
    setAttempt("");
    setRevealed(false);
    setItemIndex(0);
    setHighlight("");
    setError("");
  }
  function choose(confusionId: string) {
    cancel();
    setBusy("");
    setSelected(confusionId);
    clearExercise();
  }
  async function practice() {
    if (!view || !selected || view.session.status !== "completed") return;
    const task = begin();
    clearExercise();
    setBusy("practice");
    try {
      const result = await client.createDrill(sessionId, selected, task.signal);
      assertWeakAreaDrillLinkage(
        { sessionId, confusionEventIds: [selected] },
        view.confusionEvents,
        result,
      );
      if (current(task.revision)) setDrill(result);
    } catch (reason) {
      if (current(task.revision)) setError(studyErrorMessage(reason));
    } finally {
      if (current(task.revision)) setBusy("");
    }
  }
  async function remove() {
    const task = begin();
    clearExercise();
    setBusy("deleting");
    try {
      await client.deleteSession(sessionId, task.signal);
      if (current(task.revision)) {
        setView(undefined);
        setDeleted(true);
      }
    } catch (reason) {
      if (current(task.revision)) setError(studyErrorMessage(reason));
    } finally {
      if (current(task.revision)) setBusy("");
    }
  }
  function showEvidence(chunkId: string) {
    setHighlight(chunkId);
    if (transcript.current) transcript.current.open = true;
    const element = document.getElementById(`review-${chunkId}`);
    element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  }
  const item = drill?.practiceItems[itemIndex];

  return (
    <main className={styles.review}>
      <nav>
        <a href="/">LiveLecture AI</a>
        <a href="/demo">Start a new demo</a>
      </nav>
      <header>
        <p className={styles.label}>SIMULATION · After the lecture</p>
        <h1>Practice where you got stuck.</h1>
        <p>PREWRITTEN DEMO HELP — no AI provider used</p>
        <p className={styles.muted}>
          This sample session is kept temporarily in local server memory. It expires automatically
          and disappears when the server restarts.
        </p>
      </header>
      {busy === "loading" && <p role="status">Loading your lecture…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!view && <button onClick={() => setReload((value) => value + 1)}>Try again</button>}
        </div>
      )}
      {deleted && <p role="status">Sample session deleted. You can start a fresh demo.</p>}
      {view && (
        <>
          <section aria-labelledby="moments-heading">
            <h2 id="moments-heading">{view.session.title ?? "Your sample lecture"}</h2>
            {view.session.status !== "completed" ? (
              <p>
                Finish the lecture before starting practice. Return to the lecture screen you were
                using, then refresh this page.
              </p>
            ) : (
              <p>
                Choose a moment when you asked for help. Your exercise will use that moment’s topic
                and lecture evidence.
              </p>
            )}
            {view.confusionEvents.length === 0 ? (
              <p>
                No confusion moments were saved. Try the demo and use “I’m Lost” during the lecture.
              </p>
            ) : (
              <fieldset disabled={busy === "deleting"}>
                <legend>Your confusion moments</legend>
                {view.confusionEvents.map((event) => (
                  <label key={event.confusionId} className={styles.moment}>
                    <input
                      type="radio"
                      name="confusion"
                      value={event.confusionId}
                      checked={selected === event.confusionId}
                      disabled={!event.conceptId}
                      onChange={() => choose(event.confusionId)}
                    />
                    <span>
                      <strong>{event.conceptTitle ?? "Not enough evidence for practice"}</strong>
                      <small>Asked for help at {formatOffset(event.occurredAtMs)}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <button
              className={styles.primary}
              disabled={!selected || !!busy || view.session.status !== "completed"}
              onClick={() => void practice()}
            >
              {busy === "practice" ? "Preparing practice…" : "Practice this topic"}
            </button>
          </section>
          {drill && item && (
            <section aria-labelledby="practice-heading" aria-live="polite">
              <p className={styles.label}>From your selected confusion moment</p>
              <h2 id="practice-heading">{drill.conceptTitle}</h2>
              <p>{drill.shortExplanation}</p>
              <h3>
                Question {itemIndex + 1} of {drill.practiceItems.length}
              </h3>
              <p>{item.prompt}</p>
              <label className={styles.answerLabel} htmlFor="practice-attempt">
                Your attempt
              </label>
              <textarea
                id="practice-attempt"
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
                rows={3}
                placeholder="Work it out in your own words…"
              />
              <button onClick={() => setRevealed(true)} disabled={revealed}>
                Show answer and explanation
              </button>
              {revealed && (
                <div className={styles.answer}>
                  <h3>Answer</h3>
                  <p>{item.expectedAnswer}</p>
                  <h3>Why this works</h3>
                  <p>{item.explanation}</p>
                  <p className={styles.muted}>
                    Compare this with your attempt. This demo does not automatically grade your
                    answer.
                  </p>
                </div>
              )}
              {itemIndex + 1 < drill.practiceItems.length && (
                <button
                  onClick={() => {
                    setItemIndex((value) => value + 1);
                    setAttempt("");
                    setRevealed(false);
                  }}
                >
                  Next question
                </button>
              )}
              <h3>Back to the lecture</h3>
              <div className={styles.citations}>
                {drill.evidenceChunkIds.map((id) => {
                  const chunk = view.committedChunks.find((entry) => entry.chunkId === id);
                  return (
                    chunk && (
                      <button key={id} onClick={() => showEvidence(id)}>
                        Lecture at {formatOffset(chunk.startMs)}
                      </button>
                    )
                  );
                })}
              </div>
            </section>
          )}
          <details ref={transcript} className={styles.transcript}>
            <summary>Review the sample transcript ({view.committedChunks.length} passages)</summary>
            <ol>
              {view.committedChunks.map((chunk) => (
                <li
                  key={chunk.chunkId}
                  id={`review-${chunk.chunkId}`}
                  tabIndex={-1}
                  className={highlight === chunk.chunkId ? styles.highlight : ""}
                >
                  <strong>
                    {formatOffset(chunk.startMs)}–{formatOffset(chunk.endMs)}
                  </strong>
                  <p>{chunk.text}</p>
                </li>
              ))}
            </ol>
          </details>
          <footer>
            <button disabled={busy === "deleting"} onClick={() => void remove()}>
              {busy === "deleting" ? "Deleting…" : "Delete this sample session"}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
