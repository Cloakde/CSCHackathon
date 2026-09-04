import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("background side-panel setup", () => {
  it("logs a fixed message without exposing Chrome error details", async () => {
    vi.stubGlobal("chrome", undefined);
    const { configureSidePanel } = await import("../src/background");
    const setPanelBehavior = vi.fn(async () => {
      throw new Error("sensitive Chrome failure detail");
    });
    const error = vi.fn();

    await configureSidePanel({ setPanelBehavior }, { error });

    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
    expect(error).toHaveBeenCalledWith("LiveLecture AI: unable to configure side-panel behavior.");
    expect(error.mock.calls.flat().join(" ")).not.toContain("sensitive Chrome failure detail");
  });

  it("configures the side panel when the MV3 service worker starts", async () => {
    const setPanelBehavior = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { sidePanel: { setPanelBehavior } });

    await import("../src/background");

    expect(setPanelBehavior).toHaveBeenCalledOnce();
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });
});
