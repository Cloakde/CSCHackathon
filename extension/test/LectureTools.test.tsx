import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { buildLectureToolResponse, getCommittedChunksFromFixture } from "@livelecture/shared";
import { LectureTools } from "../src/LectureTools";

it("submits a typed question and activates a citation using the keyboard", async () => {
  const user = userEvent.setup();
  const sid = "session_keyboard";
  const chunks = getCommittedChunksFromFixture().map((chunk) => ({ ...chunk, sessionId: sid }));
  const request = vi.fn(async (prompt) =>
    buildLectureToolResponse(sid, { ...prompt, throughSequence: 9 }, chunks),
  );
  const jump = vi.fn();
  render(<LectureTools request={request} jump={jump} blocked={false} />);
  await user.tab();
  expect(screen.getByLabelText("Your question")).toHaveFocus();
  await user.keyboard("What are inner and outer functions?{Enter}");
  const result = await screen.findByRole("region", { name: "Sample question answer" });
  expect(request).toHaveBeenCalledTimes(1);
  const citation = within(result).getByRole("button", { name: "Read passage at 0:45–1:30" });
  // Native buttons stay in the tab order, including when suggestions are closed.
  for (let index = 0; index < 8 && document.activeElement !== citation; index += 1)
    await user.tab();
  expect(citation).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(jump).toHaveBeenCalledWith("chunk_calc_002");
});

it("keeps all tools disabled until transcript saving can resume", async () => {
  const request = vi.fn();
  render(<LectureTools request={request} jump={vi.fn()} blocked />);
  expect(screen.getByLabelText("Your question")).toBeDisabled();
  for (const button of screen.getAllByRole("button", { hidden: true }))
    expect(button).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Catch Me Up" }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Retry saving transcript");
});
