import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function fakeCaptureChrome() {
  const actionListeners: ((tab: unknown) => void)[] = [];
  return {
    action: { onClicked: { addListener: (l: (tab: unknown) => void) => actionListeners.push(l) } },
    sidePanel: {
      open: vi.fn(async () => undefined),
      setPanelBehavior: vi.fn(async () => undefined),
    },
    storage: { session: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) } },
    tabs: { onRemoved: { addListener: vi.fn() } },
    tabCapture: {
      getMediaStreamId: vi.fn(async () => "s"),
      getCapturedTabs: vi.fn(async () => []),
      onStatusChanged: { addListener: vi.fn() },
    },
    runtime: {
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(async () => {
        throw new Error("Could not establish connection. Receiving end does not exist.");
      }),
      getContexts: vi.fn(async () => []),
      getURL: (path: string) => `chrome-extension://fake/${path}`,
    },
    offscreen: {
      createDocument: vi.fn(async () => undefined),
      closeDocument: vi.fn(async () => undefined),
    },
    _actionListeners: actionListeners,
  };
}

/** Drains pending microtasks so async work already queued (but not yet run)
 * has a chance to complete before an assertion inspects its side effects. */
async function flush(): Promise<void> {
  for (let iteration = 0; iteration < 10; iteration += 1) await Promise.resolve();
}

describe("background side-panel and capture setup (TASK-101)", () => {
  it("logs a fixed message without exposing Chrome error details", async () => {
    vi.stubGlobal("chrome", undefined);
    const { configureSidePanel } = await import("../src/background");
    const setPanelBehavior = vi.fn(async () => {
      throw new Error("sensitive Chrome failure detail");
    });
    const error = vi.fn();

    await configureSidePanel({ setPanelBehavior }, { error });

    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
    expect(error).toHaveBeenCalledWith("LiveLecture AI: unable to configure side-panel behavior.");
    expect(error.mock.calls.flat().join(" ")).not.toContain("sensitive Chrome failure detail");
  });

  it("clears the legacy automatic-open preference on every startup, not just install", async () => {
    const fake = fakeCaptureChrome();
    vi.stubGlobal("chrome", fake);

    await import("../src/background");
    await flush();

    expect(fake.sidePanel.setPanelBehavior).toHaveBeenCalledOnce();
    expect(fake.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
  });

  it("registers the capture controller's listeners synchronously at module scope and reconciles on wake", async () => {
    const { startBackground } = await import("../src/background");
    const fake = fakeCaptureChrome();

    startBackground(fake as never);

    // Listeners must be attached before this call returns, not after a later microtask.
    expect(fake._actionListeners).toHaveLength(1);
    await flush(); // reconcileOnWake's own storage read is legitimately asynchronous.
    expect(fake.storage.session.get).toHaveBeenCalled();
  });

  it("an action click routes through the capture controller, not the old openPanelOnActionClick path", async () => {
    const { startBackground } = await import("../src/background");
    const fake = fakeCaptureChrome();
    startBackground(fake as never);

    fake._actionListeners[0]?.({ id: 42 });
    await flush();

    expect(fake.sidePanel.open).toHaveBeenCalledWith({ tabId: 42 });
    expect(fake.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "livelecture.capture.v1": expect.objectContaining({ state: "awaiting_consent", tabId: 42 }),
      }),
    );
  });
});
