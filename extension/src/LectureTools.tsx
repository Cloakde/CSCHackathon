import { useEffect, useRef, useState } from "react";
import {
  formatOffset,
  SAMPLE_LECTURE_QUESTIONS,
  type LectureToolPrompt,
  type LectureToolResponse,
  type AssistanceStatus,
} from "@livelecture/shared";

export function LectureTools({
  request,
  jump,
  blocked,
  assistanceStatus = "unknown",
}: {
  request: (prompt: LectureToolPrompt, signal: AbortSignal) => Promise<LectureToolResponse>;
  jump: (chunkId: string) => void;
  blocked: boolean;
  assistanceStatus?: AssistanceStatus;
}) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<LectureToolResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef<AbortController | undefined>(undefined);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current += 1;
      pending.current?.abort();
    },
    [],
  );

  async function submit(prompt: LectureToolPrompt) {
    if (blocked || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const version = ++revision.current;
    setBusy(true);
    setError(false);
    setResponse(undefined);
    try {
      const answer = await request(prompt, controller.signal);
      if (version === revision.current && !controller.signal.aborted) setResponse(answer);
    } catch {
      if (version === revision.current && !controller.signal.aborted) setError(true);
    } finally {
      if (version === revision.current) {
        pending.current = undefined;
        setBusy(false);
      }
    }
  }

  return (
    <section className="lecture-tools" aria-labelledby="lecture-tools-heading">
      <h2 id="lecture-tools-heading">Ask the Lecture</h2>
      <p id="sample-questions-help">
        {assistanceStatus === "prewritten"
          ? "Sample questions only · answers quote the lecture. Gemini is not connected."
          : "Ask about the lecture passages received so far. Answers must be supported by the lecture."}
      </p>
      {blocked && (
        <p role="status">
          Save the transcript before using these tools. Use “Retry saving transcript” above if
          needed.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) void submit({ kind: "ask", question: question.trim() });
        }}
      >
        <label htmlFor="lecture-question">Your question</label>
        <input
          id="lecture-question"
          value={question}
          maxLength={500}
          aria-describedby="sample-questions-help"
          disabled={blocked || busy}
          onChange={(event) => {
            setQuestion(event.target.value);
            setResponse(undefined);
          }}
        />
        <button type="submit" disabled={blocked || busy || !question.trim()}>
          {assistanceStatus === "prewritten" ? "Ask sample question" : "Ask the lecture"}
        </button>
      </form>
      <details>
        <summary>Try a sample question</summary>
        <div className="sample-questions">
          {SAMPLE_LECTURE_QUESTIONS.map((sample) => (
            <button
              key={sample.question}
              type="button"
              disabled={blocked || busy}
              onClick={() => {
                setQuestion(sample.question);
                void submit({ kind: "ask", question: sample.question });
              }}
            >
              {sample.question}
            </button>
          ))}
        </div>
      </details>
      <button
        type="button"
        disabled={blocked || busy}
        onClick={() => void submit({ kind: "catch_up" })}
      >
        Catch Me Up
      </button>
      <p className="muted">Catch Me Up covers the last two minutes, with lecture timestamps.</p>
      {busy && <p role="status">Loading lecture passages…</p>}
      {error && (
        <p role="alert">
          Could not load the lecture passages. Check the local demo service, then try again.
        </p>
      )}
      {response && (
        <section
          className="lecture-tool-result"
          aria-label={
            response.request.kind === "ask"
              ? response.mode === "prewritten"
                ? "Sample question answer"
                : "Lecture answer"
              : "Recent lecture recap"
          }
        >
          <h3>
            {response.request.kind === "ask" ? response.request.question : "Recent lecture recap"}
          </h3>
          <p role="status">{response.message}</p>
          <p>
            Through {formatOffset(response.anchorMs)} ·{" "}
            {response.mode === "gemini"
              ? response.status === "ready"
                ? "Gemini assistance · answer checked against the lecture"
                : "No verified Gemini answer"
              : "prewritten sample mode"}
          </p>
          {response.passages.map(({ text, citation }) => (
            <div key={citation.chunkId}>
              <blockquote>{text}</blockquote>
              <button type="button" onClick={() => jump(citation.chunkId)}>
                Read passage at {formatOffset(citation.startMs)}–{formatOffset(citation.endMs)}
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
