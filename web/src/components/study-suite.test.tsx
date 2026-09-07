// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCommittedChunksFromFixture, type SessionView } from "@livelecture/shared";
import { SessionReview } from "./SessionReview";
import type { StudyClient } from "../lib/client/study-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleView: SessionView = {
  session: {
    sessionId: "session_study_test",
    title: "Calculus & Algebra â€” Solving Quadratic Inequalities",
    subject: "Mathematics",
    status: "completed",
    startedAt: "2026-09-04T10:30:00.000Z",
    endedAt: "2026-09-04T11:22:00.000Z",
    sourceMode: "simulation",
  },
  committedChunks: getCommittedChunksFromFixture(),
  confusionEvents: [
    {
      confusionId: "conf_001",
      sessionId: "session_study_test",
      occurredAtMs: 650000,
      trigger: "im_lost",
      conceptId: "concept_inequality_reversal",
      conceptTitle: "Inequality Direction Reversal with Negatives",
      anchorChunkId: "chunk_calc_004",
      contextChunkIds: ["chunk_calc_001", "chunk_calc_002", "chunk_calc_003", "chunk_calc_004"],
      evidenceChunkIds: ["chunk_calc_004"],
      assistanceResponseId: "resp_001",
    },
  ],
};

const mockClient: StudyClient = {
  getSession: vi.fn().mockResolvedValue(sampleView),
  createDrill: vi.fn(),
  deleteSession: vi.fn().mockResolvedValue({ deleted: true }),
};

describe("Post-Class Study Suite tabs", () => {
  it("renders tab navigation and switches between tabs", async () => {
    render(<SessionReview sessionId="session_study_test" client={mockClient} />);
    await screen.findByRole("heading", { name: /Calculus & Algebra/i });

    expect(screen.getByRole("button", { name: /Targeted Practice/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Structured Notes" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Flashcards/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Practice Quiz/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Study Guide" })).toBeVisible();
  });

  it("displays Structured Notes with topics, formulas, and warnings", async () => {
    render(<SessionReview sessionId="session_study_test" client={mockClient} />);
    await screen.findByRole("heading", { name: /Calculus & Algebra/i });

    fireEvent.click(screen.getByRole("button", { name: "Structured Notes" }));
    expect(screen.getByRole("heading", { name: "Structured Organized Notes" })).toBeVisible();
    expect(screen.getByText(/Nonlinear Inequalities/i)).toBeVisible();
    expect(screen.getByText(/Negative Multiplier Rule/i)).toBeVisible();
    expect(screen.getByText(/The Negative Sign Flip/i)).toBeVisible();
  });

  it("interacts with Flashcards including flip and mastery tracking", async () => {
    render(<SessionReview sessionId="session_study_test" client={mockClient} />);
    await screen.findByRole("heading", { name: /Calculus & Algebra/i });

    fireEvent.click(screen.getByRole("button", { name: /Flashcards/i }));
    expect(screen.getByRole("heading", { name: "Interactive Review Flashcards" })).toBeVisible();

    const card = screen.getByRole("button", { name: "Flashcard. Click to flip." });
    expect(screen.getByText(/What happens to the inequality sign/i)).toBeVisible();

    // Flip card
    fireEvent.click(card);
    expect(screen.getByText(/The direction of the inequality must reverse/i)).toBeVisible();

    // Mark as mastered
    const masterBtn = screen.getByRole("button", { name: "Mark as Mastered" });
    fireEvent.click(masterBtn);
    expect(screen.getByText(/Mastered: 1 of 4 cards/i)).toBeVisible();
  });

  it("takes and grades the Practice Quiz", async () => {
    render(<SessionReview sessionId="session_study_test" client={mockClient} />);
    await screen.findByRole("heading", { name: /Calculus & Algebra/i });

    fireEvent.click(screen.getByRole("button", { name: /Practice Quiz/i }));
    expect(screen.getByRole("heading", { name: "Lecture Practice Quiz" })).toBeVisible();

    // Answer Q1: option 1 (x² - x - 6 < 0)
    const q1Option = screen.getByRole("radio", { name: /x.*- x - 6 < 0/i });
    fireEvent.click(q1Option);

    // Answer Q2: option 2 ((-2, 3))
    const q2Option = screen.getByRole("radio", { name: /\(-2, 3\)/i });
    fireEvent.click(q2Option);

    // Answer Q3: option 2 (The inequality is strict)
    const q3Option = screen.getByRole("radio", { name: /The inequality is strict/i });
    fireEvent.click(q3Option);

    const gradeBtn = screen.getByRole("button", { name: "Grade My Quiz" });
    fireEvent.click(gradeBtn);

    expect(screen.getByText(/Your Score: 3 \/ 3 correct/i)).toBeVisible();
    expect(
      screen.getByText(/Dividing both sides of an inequality by a negative number/i),
    ).toBeVisible();
  });

  it("renders the Comprehensive Study Guide", async () => {
    render(<SessionReview sessionId="session_study_test" client={mockClient} />);
    await screen.findByRole("heading", { name: /Calculus & Algebra/i });

    fireEvent.click(screen.getByRole("button", { name: "Study Guide" }));
    expect(
      screen.getByRole("heading", { name: "Comprehensive Printable Study Guide" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  });
});
