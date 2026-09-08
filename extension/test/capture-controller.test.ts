import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARM_EXPIRY_MS,
  CAPTURE_STORAGE_KEY,
  CONSENT_EXPIRY_MS,
  OFFSCREEN_ACK_CHANNEL,
  OFFSCREEN_COMMAND_CHANNEL,
  PANEL_CHANNEL,
  PANEL_STATUS_CHANNEL,
  type CaptureStorageRecord,
} from "../src/capture-protocol";
import { createCaptureController, type CaptureControllerChrome } from "../src/capture-controller";

const OFFSCREEN_URL = "chrome-extension://fake-id/offscreen.html";
// Short enough that a genuine "nobody answered" timeout resolves the test
// almost instantly, without depending on exact microtask-flush timing.
const TEST_RECONCILE_TIMEOUT_MS = 20;

/** A minimal, fully in-memory fake of the Chrome surface the controller uses.
 * Broadcasts fan out only to registered onMessage listeners, mirroring how
 * `chrome.runtime.sendMessage` never reaches the sender's own context. */
function createFakeChrome() {
  const actionListeners: ((tab: chrome.tabs.Tab) => void)[] = [];
  const messageListeners: ((
    message: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => boolean | void)[] = [];
  const tabRemovedListeners: ((tabId: number) => void)[] = [];
  const statusChangedListeners: ((info: { tabId: number; status: string }) => void)[] = [];
  const updatedListeners: ((tabId: number, change: { status?: string; url?: string }) => void)[] =
    [];
  const activatedListeners: ((info: { tabId: number }) => void)[] = [];
  const session = new Map<string, unknown>();
  const sentMessages: unknown[] = [];
  let offscreenExists = false;
  let capturedTabs: { tabId: number; status: string }[] = [];

  const sidePanelOpen = vi.fn(async () => undefined);
  const getMediaStreamId = vi.fn(async () => "stream-id-1");
  const createDocument = vi.fn(async () => {
    offscreenExists = true;
  });
  const closeDocument = vi.fn(async () => {
    offscreenExists = false;
  });

  const chromeApis: CaptureControllerChrome = {
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setTitle: vi.fn(async () => undefined),
      onClicked: { addListener: (l) => actionListeners.push(l) },
    },
    sidePanel: { open: sidePanelOpen, setPanelBehavior: vi.fn(async () => undefined) },
    storage: {
      session: {
        get: async (keys) => {
          const result: Record<string, unknown> = {};
          for (const key of keys) if (session.has(key)) result[key] = session.get(key);
          return result;
        },
        set: async (items) => {
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        },
      },
    },
    tabs: {
      onUpdated: { addListener: (l) => updatedListeners.push(l) },
      onActivated: { addListener: (l) => activatedListeners.push(l) },
      onRemoved: { addListener: (l) => tabRemovedListeners.push(l) },
    },
    tabCapture: {
      getMediaStreamId,
      getCapturedTabs: async () => capturedTabs,
      onStatusChanged: { addListener: (l) => statusChangedListeners.push(l) },
    },
    runtime: {
      onMessage: { addListener: (l) => messageListeners.push(l) },
      // Mirrors real Chrome: a listener returning `true` keeps the channel open
      // until it actually calls sendResponse, however many ticks that takes —
      // resolving early here would let every awaited round-trip below race
      // ahead of the controller's own (deliberately serialized) async work.
      sendMessage: (message) =>
        new Promise((resolve, reject) => {
          sentMessages.push(message);
          if (messageListeners.length === 0) {
            reject(new Error("Could not establish connection. Receiving end does not exist."));
            return;
          }
          let settled = false;
          let anyKeptChannelOpen = false;
          for (const listener of [...messageListeners]) {
            const keepOpen = listener(message, {}, (value) => {
              if (!settled) {
                settled = true;
                resolve(value);
              }
            });
            if (keepOpen) anyKeptChannelOpen = true;
          }
          if (!settled && !anyKeptChannelOpen) resolve(undefined);
        }),
      getContexts: async () => (offscreenExists ? [{ documentUrl: OFFSCREEN_URL }] : []),
      getURL: (path) => `chrome-extension://fake-id/${path}`,
    },
    offscreen: { createDocument, closeDocument },
  };

  function channelOf(message: unknown): string | undefined {
    return typeof message === "object" && message !== null
      ? (message as { channel?: string }).channel
      : undefined;
  }

  return {
    chromeApis,
    fireUpdated: (id: number) => updatedListeners.forEach((l) => l(id, { status: "loading" })),
    fireActivated: (id: number) => activatedListeners.forEach((l) => l({ tabId: id })),
    fireAction: (tab: chrome.tabs.Tab) => actionListeners.forEach((l) => l(tab)),
    fireTabRemoved: (tabId: number) => tabRemovedListeners.forEach((l) => l(tabId)),
    fireStatusChanged: (info: { tabId: number; status: string }) =>
      statusChangedListeners.forEach((l) => l(info)),
    /** Simulates the offscreen document's own outbound ack broadcast. */
    fireOffscreenAck: async (message: unknown) => {
      sentMessages.push(message);
      for (const listener of [...messageListeners]) listener(message, {}, () => undefined);
    },
    messagesOn(channel: string): unknown[] {
      return sentMessages.filter((message) => channelOf(message) === channel);
    },
    setCapturedTabs: (tabs: { tabId: number; status: string }[]) => (capturedTabs = tabs),
    setOffscreenExists: (value: boolean) => (offscreenExists = value),
    session,
    sidePanelOpen,
    getMediaStreamId,
    createDocument,
    closeDocument,
  };
}

type FakeChrome = ReturnType<typeof createFakeChrome>;

/** Drains every pending microtask, regardless of call-graph depth, by yielding
 * to a macrotask boundary — by definition nothing microtask-scheduled can
 * remain pending once that boundary is reached. Timer-mode aware: a real
 * `setTimeout` never fires once a test enables fake timers, which would hang
 * that test and leak fake-timer mode into every test that runs after it. */
async function flush(): Promise<void> {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
  else await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

async function sendMessage(fake: FakeChrome, message: unknown): Promise<unknown> {
  const result = await fake.chromeApis.runtime.sendMessage(message);
  await flush();
  return result;
}

describe("capture controller (TASK-101)", () => {
  let fake: FakeChrome;
  let controller: ReturnType<typeof createCaptureController>;
  let panelStatuses: unknown[];

  beforeEach(() => {
    fake = createFakeChrome();
    panelStatuses = [];
    fake.chromeApis.runtime.onMessage.addListener((message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { channel?: string }).channel === PANEL_STATUS_CHANNEL
      )
        panelStatuses.push(message);
      return false;
    });
    controller = createCaptureController(fake.chromeApis, console, TEST_RECONCILE_TIMEOUT_MS);
    controller.attachListeners();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function storageRecord(): CaptureStorageRecord | undefined {
    return fake.session.get(CAPTURE_STORAGE_KEY) as CaptureStorageRecord | undefined;
  }

  it("opens the panel and starts a fresh disclosure on the first click", async () => {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    expect(fake.sidePanelOpen).toHaveBeenCalledWith({ tabId: 7 });
    const stored = storageRecord();
    expect(stored).toMatchObject({ state: "awaiting_consent", generation: 1, tabId: 7 });
    expect(stored?.awaitingConsentExpiresAt).toBeGreaterThan(Date.now());
  });

  it("ignores a click on a restricted page with no addressable tab", async () => {
    fake.fireAction({} as chrome.tabs.Tab);
    await flush();
    expect(fake.sidePanelOpen).not.toHaveBeenCalled();
    expect(storageRecord()).toBeUndefined();
  });

  it("fails closed when the side panel itself refuses to open", async () => {
    fake.sidePanelOpen.mockRejectedValueOnce(new Error("restricted page"));
    fake.fireAction({ id: 9 } as chrome.tabs.Tab);
    await flush();
    expect(storageRecord()).toBeUndefined();
  });

  it("a second click before consent only reopens the disclosure, never captures", async () => {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    const firstRecord = storageRecord();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    expect(fake.getMediaStreamId).not.toHaveBeenCalled();
    expect(storageRecord()).toEqual(firstRecord); // Unchanged: no new generation, no re-arm.
    expect(fake.sidePanelOpen).toHaveBeenCalledTimes(2);
  });

  it("an expired disclosure starts a brand-new generation on the next click", async () => {
    vi.useFakeTimers();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    vi.advanceTimersByTime(CONSENT_EXPIRY_MS + 1);
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    expect(storageRecord()).toMatchObject({ state: "awaiting_consent", generation: 2, tabId: 7 });
    vi.useRealTimers();
  });

  it("consent moves awaiting_consent to a one-use armed state, and rejects a stale generation", async () => {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    const staleResponse = await sendMessage(fake, {
      channel: PANEL_CHANNEL,
      kind: "consent",
      generation: 99,
    });
    expect(staleResponse).toMatchObject({ ok: false });
    expect(storageRecord()?.state).toBe("awaiting_consent");

    const response = await sendMessage(fake, {
      channel: PANEL_CHANNEL,
      kind: "consent",
      generation: 1,
    });
    expect(response).toMatchObject({ ok: true, status: { state: "armed", generation: 1 } });
    const stored = storageRecord();
    expect(stored).toMatchObject({ state: "armed", generation: 1, tabId: 7 });
    expect(stored?.armedExpiresAt).toBeGreaterThan(Date.now());
  });

  it("consenting after the disclosure expired fails and tears down without arming", async () => {
    vi.useFakeTimers();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    vi.advanceTimersByTime(CONSENT_EXPIRY_MS + 1);
    const response = await sendMessage(fake, {
      channel: PANEL_CHANNEL,
      kind: "consent",
      generation: 1,
    });
    expect(response).toMatchObject({ ok: false, reason: "consent_expired" });
    expect(storageRecord()?.state).toBe("error");
    vi.useRealTimers();
  });

  it("only the armed tab can start, and a mismatched tab click is refused", async () => {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "consent", generation: 1 });
    fake.fireAction({ id: 8 } as chrome.tabs.Tab); // A different tab entirely.
    await flush();
    expect(fake.getMediaStreamId).not.toHaveBeenCalled();
    // The mismatched click starts its own fresh disclosure for tab 8 instead.
    expect(storageRecord()).toMatchObject({ state: "awaiting_consent", tabId: 8 });
  });

  it("an expired arm cannot start capture on the next click", async () => {
    vi.useFakeTimers();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "consent", generation: 1 });
    vi.advanceTimersByTime(ARM_EXPIRY_MS + 1);
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    expect(fake.getMediaStreamId).not.toHaveBeenCalled();
    expect(storageRecord()).toMatchObject({ state: "awaiting_consent", generation: 2 });
    vi.useRealTimers();
  });

  async function armAndStart() {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "consent", generation: 1 });
    fake.fireAction({ id: 7 } as chrome.tabs.Tab); // Second click while armed.
    await flush();
  }

  it("the second armed click requests exactly one stream ID and forwards it to the offscreen document", async () => {
    await armAndStart();
    expect(fake.createDocument).toHaveBeenCalledOnce();
    expect(fake.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: OFFSCREEN_URL, reasons: ["USER_MEDIA"] }),
    );
    expect(fake.getMediaStreamId).toHaveBeenCalledExactlyOnceWith({ targetTabId: 7 });
    expect(storageRecord()?.state).toBe("starting");
    const commands = fake.messagesOn(OFFSCREEN_COMMAND_CHANNEL);
    expect(commands).toContainEqual(
      expect.objectContaining({ kind: "consume_stream", generation: 1, streamId: "stream-id-1" }),
    );
  });

  it("enters active only after the offscreen document acknowledges a live track", async () => {
    await armAndStart();
    expect(storageRecord()?.state).toBe("starting");
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    expect(storageRecord()?.state).toBe("active");
    expect(panelStatuses.at(-1)).toMatchObject({ status: { state: "active", generation: 1 } });
  });

  it("a track_failed ack tears down and surfaces a safe error reason", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_failed",
      generation: 1,
      reason: "getusermedia_failed",
    });
    await flush();
    expect(storageRecord()).toMatchObject({ state: "error", reason: "getusermedia_failed" });
    expect(fake.closeDocument).toHaveBeenCalled();
  });

  it("duplicate Start while starting/active reports current state without a second offscreen document or stream", async () => {
    await armAndStart();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab); // Rapid repeated Start.
    await flush();
    expect(fake.createDocument).toHaveBeenCalledOnce();
    expect(fake.getMediaStreamId).toHaveBeenCalledOnce();
    expect(fake.sidePanelOpen).toHaveBeenCalled(); // Reopen is fine; nothing else changed.
  });

  it("explicit Stop is idempotent and cleans up every resource", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    const first = await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "stop", generation: 1 });
    expect(first).toMatchObject({ ok: true });
    expect(storageRecord()?.state).toBe("idle");
    expect(fake.closeDocument).toHaveBeenCalled();
    const stopCommand = fake
      .messagesOn(OFFSCREEN_COMMAND_CHANNEL)
      .find((message) => (message as { kind?: string }).kind === "stop");
    expect(stopCommand).toMatchObject({ kind: "stop", generation: 1 });
    // A second Stop for the same, now-idle generation is a harmless idempotent no-op.
    const second = await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "stop", generation: 1 });
    expect(second).toMatchObject({ ok: true, status: { state: "idle" } });
  });

  it("panel unmount (no explicit Stop sent) never stops an active capture", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    // Nothing more happens here: no stop message is ever sent by an unmounting panel.
    expect(storageRecord()?.state).toBe("active");
  });

  it("tab close and a delayed track_ended converge on one cleanup path and ignore stale generations", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.fireTabRemoved(7);
    await flush();
    expect(storageRecord()?.state).toBe("idle");
    const closeCallsAfterTabRemoved = fake.closeDocument.mock.calls.length;
    // A delayed track_ended for the same, now-stopped generation changes nothing further.
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_ended",
      generation: 1,
    });
    await flush();
    expect(fake.closeDocument.mock.calls.length).toBe(closeCallsAfterTabRemoved);
  });

  it("a delayed old native stopped/error event cannot terminate a newer same-tab capture", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.setCapturedTabs([{ tabId: 7, status: "active" }]);
    fake.fireStatusChanged({ tabId: 7, status: "stopped" }); // Stale native event.
    await flush();
    expect(storageRecord()?.state).toBe("active"); // Reconciliation found it still genuinely captured.
  });

  it("a genuine native stop with no remaining capture evidence tears down", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.setCapturedTabs([]);
    fake.setOffscreenExists(false);
    fake.fireStatusChanged({ tabId: 7, status: "stopped" });
    // Nothing ever answers this generation's get_status: the reconciliation
    // genuinely waits out its (test-shortened) timeout before concluding.
    await new Promise((resolve) => setTimeout(resolve, TEST_RECONCILE_TIMEOUT_MS * 3));
    expect(storageRecord()?.state).toBe("idle");
  });

  it("old-generation panel messages cannot alter the current capture", async () => {
    await armAndStart();
    const response = await sendMessage(fake, {
      channel: PANEL_CHANNEL,
      kind: "stop",
      generation: 0,
    });
    expect(response).toMatchObject({ ok: false });
    expect(storageRecord()?.state).toBe("starting");
  });

  it("worker-restart reconciliation restores active state without requesting another stream", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.setCapturedTabs([{ tabId: 7, status: "active" }]);
    // Simulate a fresh worker: a brand-new controller instance over the same storage.
    const restarted = createCaptureController(fake.chromeApis, console, TEST_RECONCILE_TIMEOUT_MS);
    restarted.attachListeners();
    const reconciled = restarted.reconcileOnWake();
    // The status query is reached via several microtask hops, whose exact
    // count can shift under load. Rather than guess a fixed number of
    // flushes, keep re-delivering the ack (a no-op once already consumed)
    // until reconciliation actually settles, bounded well under its own
    // (test-shortened) timeout so a real regression still fails the test.
    let settled = false;
    void reconciled.then(() => {
      settled = true;
    });
    for (let attempt = 0; attempt < 10 && !settled; attempt += 1) {
      await fake.fireOffscreenAck({
        channel: OFFSCREEN_ACK_CHANNEL,
        kind: "track_active",
        generation: 1,
      });
      await flush();
    }
    await reconciled;
    expect(fake.getMediaStreamId).toHaveBeenCalledOnce(); // No second stream request.
    expect(storageRecord()?.state).toBe("active");
  });

  it("worker-restart reconciliation clears an orphaned record when the offscreen document is gone", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.setOffscreenExists(false); // The document did not survive the restart.
    const restarted = createCaptureController(fake.chromeApis, console, TEST_RECONCILE_TIMEOUT_MS);
    restarted.attachListeners();
    await restarted.reconcileOnWake();
    expect(storageRecord()?.state).toBe("idle");
    expect(fake.getMediaStreamId).toHaveBeenCalledOnce();
  });

  it("an expired awaiting_consent record is cleared, not resumed, on worker restart", async () => {
    vi.useFakeTimers();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    vi.advanceTimersByTime(CONSENT_EXPIRY_MS + 1);
    const restarted = createCaptureController(fake.chromeApis, console, TEST_RECONCILE_TIMEOUT_MS);
    restarted.attachListeners();
    await restarted.reconcileOnWake();
    expect(storageRecord()?.state).toBe("idle");
    vi.useRealTimers();
  });

  it("never persists audio or a stream ID in storage or the panel status channel", async () => {
    await armAndStart();
    const stored = JSON.stringify(Object.fromEntries(fake.session));
    expect(stored).not.toContain("stream-id-1");
    expect(JSON.stringify(panelStatuses)).not.toContain("stream-id-1");
  });
  it("opens the panel in the click stack even when reconciliation is blocked", async () => {
    let release!: (value: Record<string, unknown>) => void;
    const original = fake.chromeApis.storage.session.get;
    fake.chromeApis.storage.session.get = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const wake = controller.reconcileOnWake();
    await flush();
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    expect(fake.sidePanelOpen).toHaveBeenCalledOnce();
    fake.chromeApis.storage.session.get = original;
    release({});
    await wake;
    await flush();
  });
  it.each(["navigate", "switch"] as const)(
    "clears consent on %s before capture starts",
    async (kind) => {
      fake.fireAction({ id: 7 } as chrome.tabs.Tab);
      await flush();
      await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "consent", generation: 1 });
      if (kind === "navigate") fake.fireUpdated(7);
      else {
        fake.fireActivated(8);
        fake.fireActivated(7);
      }
      await flush();
      fake.fireAction({ id: 7 } as chrome.tabs.Tab);
      await flush();
      expect(fake.getMediaStreamId).not.toHaveBeenCalled();
      expect(storageRecord()?.state).toBe("awaiting_consent");
    },
  );
  it("shows REC while starting and clears it on Stop", async () => {
    await armAndStart();
    expect(fake.chromeApis.action.setBadgeText).toHaveBeenCalledWith({ text: "REC" });
    await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "stop", generation: 1 });
    expect(fake.chromeApis.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
  });
  it("does not cancel an already active capture solely on navigation", async () => {
    await armAndStart();
    await fake.fireOffscreenAck({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind: "track_active",
      generation: 1,
    });
    await flush();
    fake.fireUpdated(7);
    await flush();
    expect(storageRecord()?.state).toBe("active");
  });
  it("times out a missing track acknowledgment without pretending capture is active", async () => {
    vi.useFakeTimers();
    await armAndStart();
    await vi.advanceTimersByTimeAsync(10001);
    expect(storageRecord()?.state).toBe("error");
    expect(fake.closeDocument).toHaveBeenCalled();
  });

  it.each(["stop", "close"] as const)("discards a delayed stream ID after %s", async (kind) => {
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    await sendMessage(fake, { channel: PANEL_CHANNEL, kind: "consent", generation: 1 });
    let resolveStream!: (id: string) => void;
    fake.getMediaStreamId.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    );
    fake.fireAction({ id: 7 } as chrome.tabs.Tab);
    await flush();
    let stopped: Promise<unknown> | undefined;
    if (kind === "stop")
      stopped = sendMessage(fake, { channel: PANEL_CHANNEL, kind: "stop", generation: 1 });
    else fake.fireTabRemoved(7);
    resolveStream("delayed-stream");
    await stopped;
    await flush();
    expect(
      fake
        .messagesOn(OFFSCREEN_COMMAND_CHANNEL)
        .some((m) => (m as { kind: string }).kind === "consume_stream"),
    ).toBe(false);
    expect(storageRecord()?.state).not.toBe("active");
    expect(fake.closeDocument).toHaveBeenCalled();
  });
});
