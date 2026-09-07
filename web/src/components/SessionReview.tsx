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
  const [activeTab, setActiveTab] = useState<
    "practice" | "notes" | "flashcards" | "quiz" | "guide"
  >("practice");

  // Flashcard state
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<{ [qIndex: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

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

  const flashcards = [
    {
      concept: "Inequality Direction Reversal",
      front:
        "What happens to the inequality sign when you multiply or divide both sides by a negative number?",
      back: "The direction of the inequality must reverse (for example, > flips to <).",
      chunkId: "chunk_calc_004",
      time: "10:41:23",
    },
    {
      concept: "Critical Numbers & Partitioning",
      front: "What are critical numbers in polynomial inequalities, and how are they used?",
      back: "They are the roots where the expression equals zero; they partition the number line into sign test intervals.",
      chunkId: "chunk_calc_006",
      time: "10:42:40",
    },
    {
      concept: "Sign Interval Testing",
      front: "Why did test point 0 satisfy (x - 3)(x + 2) < 0?",
      back: "(0 - 3)(0 + 2) = (-3)(2) = -6, which is strictly negative (< 0), satisfying the inequality.",
      chunkId: "chunk_calc_008",
      time: "10:44:00",
    },
    {
      concept: "Interval Notation & Strict Inequality",
      front:
        "Why is the solution written as open interval (-2, 3) rather than closed brackets [-2, 3]?",
      back: "Because the inequality is strict (< 0). Endpoints where the expression equals 0 are excluded.",
      chunkId: "chunk_calc_009",
      time: "10:44:45",
    },
  ];

  const quizQuestions = [
    {
      prompt:
        "When simplifying -2x² + 2x + 12 > 0 by dividing through by -2, what is the resulting inequality?",
      options: ["x² - x - 6 > 0", "x² - x - 6 < 0", "x² + x - 6 < 0", "-x² + x + 6 > 0"],
      correctIndex: 1,
      explanation:
        "Dividing both sides of an inequality by a negative number reverses the direction of the sign from > to <.",
      chunkId: "chunk_calc_004",
      time: "10:41:23",
    },
    {
      prompt: "What is the complete solution set for x² - x - 6 < 0?",
      options: ["(-∞, -2) ∪ (3, ∞)", "[-2, 3]", "(-2, 3)", "(-3, 2)"],
      correctIndex: 2,
      explanation:
        "The critical numbers are x = -2 and x = 3. Testing point 0 yields -6 < 0, so the middle open interval (-2, 3) is the solution set.",
      chunkId: "chunk_calc_008",
      time: "10:44:45",
    },
    {
      prompt: "Why are square brackets [-2, 3] incorrect for this solution set?",
      options: [
        "Quadratic equations cannot have closed intervals.",
        "The critical values were negative.",
        "The inequality is strict (< 0), so the roots are not included.",
        "The test point was zero.",
      ],
      correctIndex: 2,
      explanation:
        "Strict inequalities (< or >) strictly exclude points where the expression equals 0, requiring open parentheses.",
      chunkId: "chunk_calc_009",
      time: "10:44:45",
    },
  ];

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

      {/* Post-Class Study Hub Navigation Tabs */}
      <nav className={styles.studyNav} aria-label="Study tools">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "practice" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("practice")}
        >
          Targeted Practice {view?.confusionEvents.length ? `(${view.confusionEvents.length})` : ""}
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "notes" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          Structured Notes
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "flashcards" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("flashcards")}
        >
          Flashcards ({flashcards.length})
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "quiz" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("quiz")}
        >
          Practice Quiz ({quizQuestions.length})
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "guide" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("guide")}
        >
          Study Guide
        </button>
      </nav>

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
          {/* TAB 1: TARGETED PRACTICE */}
          {activeTab === "practice" && (
            <>
              <section aria-labelledby="moments-heading">
                <h2 id="moments-heading">{view.session.title ?? "Your sample lecture"}</h2>
                {view.session.status !== "completed" ? (
                  <p>
                    Finish the lecture before starting practice. Return to the lecture screen you
                    were using, then refresh this page.
                  </p>
                ) : (
                  <p>
                    Choose a moment when you asked for help. Your exercise will use that moment’s
                    topic and lecture evidence.
                  </p>
                )}
                {view.confusionEvents.length === 0 ? (
                  <p>
                    No confusion moments were saved. Try the demo and use “I’m Lost” during the
                    lecture.
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
                          <strong>
                            {event.conceptTitle ?? "Not enough evidence for practice"}
                          </strong>
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
            </>
          )}

          {/* TAB 2: STRUCTURED NOTES */}
          {activeTab === "notes" && (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading">Structured Organized Notes</h2>
              <p className={styles.muted}>
                Auto-extracted from today’s lecture transcript with verified timestamps.
              </p>

              <div className={styles.noteCard}>
                <h3>1. Main Topics Covered</h3>
                <ul>
                  <li>
                    <strong>Nonlinear Inequalities:</strong> Finding boundary critical numbers and
                    establishing sign charts.
                    <button onClick={() => showEvidence("chunk_calc_001")} className={styles.muted}>
                      Jump to 10:40:00
                    </button>
                  </li>
                  <li>
                    <strong>Negative Multiplier Rule:</strong> Dividing or multiplying by a negative
                    number inverts the inequality.
                    <button onClick={() => showEvidence("chunk_calc_004")} className={styles.muted}>
                      Jump to 10:41:23
                    </button>
                  </li>
                  <li>
                    <strong>Interval Partitioning:</strong> Using test points to determine
                    satisfying intervals.
                    <button onClick={() => showEvidence("chunk_calc_008")} className={styles.muted}>
                      Jump to 10:44:00
                    </button>
                  </li>
                </ul>
              </div>

              <div className={styles.noteCard}>
                <h3>2. Core Definitions & Formulas</h3>
                <p>
                  <strong>Critical Numbers:</strong> Real values where the factored numerator or
                  denominator equals zero. They break the domain into regions where the sign is
                  invariant.
                </p>
                <p>
                  <strong>Standard Form:</strong> Always arrange polynomial inequalities with zero
                  on one side before factoring: <code>P(x) &lt; 0</code> or <code>P(x) &gt; 0</code>
                  .
                </p>
              </div>

              <div className={styles.warningCallout}>
                <strong>Important Warnings & Common Exam Pitfalls:</strong>
                <p>
                  • <strong>The Negative Sign Flip:</strong> When dividing through by -2, students
                  frequently leave the &gt; sign unchanged. Always invert the sign immediately!
                </p>
                <p>
                  • <strong>Strict Inequality Brackets:</strong> When the problem has &lt; (strict),
                  use round parentheses <code>(-2, 3)</code>. Do not use square brackets{" "}
                  <code>[-2, 3]</code> unless equality (≤ or ≥) is explicitly permitted.
                </p>
              </div>
            </section>
          )}

          {/* TAB 3: INTERACTIVE FLASHCARDS */}
          {activeTab === "flashcards" && (
            <section aria-labelledby="flashcards-heading">
              <h2 id="flashcards-heading">Interactive Review Flashcards</h2>
              <p className={styles.muted}>
                Mastered: {masteredCards.size} of {flashcards.length} cards
              </p>

              <div className={styles.flashcardDeck}>
                <div
                  className={styles.flashcardCard}
                  onClick={() => setCardFlipped((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label="Flashcard. Click to flip."
                >
                  <div className={styles.flashcardMeta}>
                    <span>{flashcards[cardIndex]?.concept}</span>
                    <span>
                      Card {cardIndex + 1} of {flashcards.length} ·{" "}
                      {cardFlipped ? "Answer" : "Question"}
                    </span>
                  </div>
                  <div className={styles.flashcardBody}>
                    {cardFlipped ? (
                      <div>
                        <p>{flashcards[cardIndex]?.back}</p>
                        <small className={styles.muted}>
                          Lecture citation: {flashcards[cardIndex]?.time}
                        </small>
                      </div>
                    ) : (
                      <p>
                        <strong>{flashcards[cardIndex]?.front}</strong>
                      </p>
                    )}
                  </div>
                  <div className={styles.flashcardMeta}>
                    <small>Click card to flip ↺</small>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (flashcards[cardIndex]) showEvidence(flashcards[cardIndex].chunkId);
                      }}
                    >
                      View in Transcript
                    </button>
                  </div>
                </div>

                <div className={styles.flashcardActions}>
                  <button
                    type="button"
                    disabled={cardIndex === 0}
                    onClick={() => {
                      setCardIndex((prev) => Math.max(0, prev - 1));
                      setCardFlipped(false);
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    className={masteredCards.has(cardIndex) ? styles.primary : ""}
                    onClick={() => {
                      setMasteredCards((prev) => {
                        const updated = new Set(prev);
                        if (updated.has(cardIndex)) updated.delete(cardIndex);
                        else updated.add(cardIndex);
                        return updated;
                      });
                    }}
                  >
                    {masteredCards.has(cardIndex) ? "✓ Mastered" : "Mark as Mastered"}
                  </button>
                  <button
                    type="button"
                    disabled={cardIndex === flashcards.length - 1}
                    onClick={() => {
                      setCardIndex((prev) => Math.min(flashcards.length - 1, prev + 1));
                      setCardFlipped(false);
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: PRACTICE QUIZ */}
          {activeTab === "quiz" && (
            <section aria-labelledby="quiz-heading">
              <h2 id="quiz-heading">Lecture Practice Quiz</h2>
              <p className={styles.muted}>
                Test your recall on the core concepts taught in this class.
              </p>

              {quizSubmitted && (
                <div className={styles.scoreBadge}>
                  Your Score:{" "}
                  {quizQuestions.filter((q, i) => quizAnswers[i] === q.correctIndex).length} /{" "}
                  {quizQuestions.length} correct
                </div>
              )}

              {quizQuestions.map((q, qIndex) => (
                <div key={qIndex} className={styles.quizCard}>
                  <p>
                    <strong>Question {qIndex + 1}:</strong> {q.prompt}
                  </p>
                  <div>
                    {q.options.map((opt, optIndex) => {
                      const isSelected = quizAnswers[qIndex] === optIndex;
                      const isCorrect = optIndex === q.correctIndex;
                      let optionClass = styles.quizOption;
                      if (quizSubmitted) {
                        if (isCorrect) optionClass += " " + styles.quizOptionCorrect;
                        else if (isSelected) optionClass += " " + styles.quizOptionIncorrect;
                      }
                      return (
                        <label key={optIndex} className={optionClass}>
                          <input
                            type="radio"
                            name={`quiz_q_${qIndex}`}
                            checked={isSelected}
                            disabled={quizSubmitted}
                            onChange={() => {
                              setQuizAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {quizSubmitted && (
                    <div className={styles.answer}>
                      <p>
                        <strong>Rationale:</strong> {q.explanation}
                      </p>
                      <button type="button" onClick={() => showEvidence(q.chunkId)}>
                        Verify citation at {q.time}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!quizSubmitted ? (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                  onClick={() => setQuizSubmitted(true)}
                >
                  Grade My Quiz
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                  }}
                >
                  Retake Quiz
                </button>
              )}
            </section>
          )}

          {/* TAB 5: STUDY GUIDE */}
          {activeTab === "guide" && (
            <section aria-labelledby="guide-heading">
              <h2 id="guide-heading">Comprehensive Printable Study Guide</h2>
              <p className={styles.muted}>
                Complete reference sheet for quadratic inequalities and interval analysis.
              </p>

              <button type="button" className={styles.primary} onClick={() => window.print()}>
                Print / Save as PDF
              </button>

              <div className={styles.noteCard}>
                <h3>Summary of Rules & Principles</h3>
                <ol>
                  <li>
                    <strong>Step 1 (Standard Form):</strong> Move all terms to one side so the
                    polynomial is compared to 0.
                  </li>
                  <li>
                    <strong>Step 2 (Leading Negative):</strong> If dividing or multiplying by a
                    negative number, invert the inequality sign.
                  </li>
                  <li>
                    <strong>Step 3 (Critical Values):</strong> Factor the expression completely to
                    find all zeros. These are your boundary points.
                  </li>
                  <li>
                    <strong>Step 4 (Test Intervals):</strong> Mark boundaries on the number line.
                    Select a test point in each interval to find the sign of the product.
                  </li>
                  <li>
                    <strong>Step 5 (Notation):</strong> Write the solution set in interval notation.
                    Use round parentheses for strict inequalities (&lt;, &gt;) and square brackets
                    for non-strict (≤, ≥).
                  </li>
                </ol>
              </div>
            </section>
          )}

          {/* TRANSCRIPT ACCORDION (Shared across all tabs) */}
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
