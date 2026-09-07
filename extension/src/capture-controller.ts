import {
  ARM_EXPIRY_MS,
  CAPTURE_STORAGE_KEY,
  CONSENT_EXPIRY_MS,
  IDLE_STATUS,
  OFFSCREEN_COMMAND_CHANNEL,
  PANEL_STATUS_CHANNEL,
  isCaptureStorageRecord,
  isOffscreenToBackgroundMessage,
  isPanelToBackgroundMessage,
  type BackgroundToOffscreenMessage,
  type CaptureErrorReason,
  type CaptureStatusSnapshot,
  type CaptureStorageRecord,
} from "./capture-protocol";

/** The narrow slice of the Chrome extension APIs this controller needs, so tests
 * inject fakes instead of stubbing the entire `chrome` global. */
export interface CaptureControllerChrome {
  action: {
    onClicked: { addListener(listener: (tab: chrome.tabs.Tab) => void): void };
  };
  sidePanel: {
    open(options: { tabId: number }): Promise<void>;
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  };
  storage: {
    session: {
      get(keys: string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  tabs: {
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
  tabCapture: {
    getMediaStreamId(options: { targetTabId: number }): Promise<string>;
    getCapturedTabs(): Promise<{ tabId: number; status: string }[]>;
    onStatusChanged: {
      addListener(listener: (info: { tabId: number; status: string }) => void): void;
    };
  };
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    sendMessage(message: unknown): Promise<unknown>;
    getContexts(filter: { contextTypes: string[]; documentUrls?: string[] }): Promise<unknown[]>;
    getURL(path: string): string;
  };
  offscreen: {
    createDocument(params: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
    closeDocument(): Promise<void>;
  };
}

export interface CaptureControllerLogger {
  error(message: string): void;
}

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
/** How long reconciliation waits for the offscreen document to answer get_status. */
const RECONCILE_STATUS_TIMEOUT_MS = 2_000;

function now(): number {
  return Date.now();
}

function isNoReceivingEndError(error: unknown): boolean {
  return error instanceof Error && /receiving end does not exist/i.test(error.message);
}

/** Swallow the one expected, benign broadcast failure: no listener is currently attached. */
async function broadcast(chromeApis: CaptureControllerChrome, message: unknown): Promise<void> {
  try {
    await chromeApis.runtime.sendMessage(message);
  } catch (error) {
    if (!isNoReceivingEndError(error)) throw error;
  }
}

function snapshotOf(record: CaptureStorageRecord | undefined): CaptureStatusSnapshot {
  if (!record) return IDLE_STATUS;
  const snapshot: CaptureStatusSnapshot = { state: record.state, generation: record.generation };
  if (record.tabId !== undefined) snapshot.tabId = record.tabId;
  if (record.reason !== undefined) snapshot.reason = record.reason;
  return snapshot;
}

export function createCaptureController(
  chromeApis: CaptureControllerChrome,
  logger: CaptureControllerLogger = console,
  reconcileStatusTimeoutMs: number = RECONCILE_STATUS_TIMEOUT_MS,
) {
  // Guards concurrent action clicks / message handling from creating two offscreen
  // documents or racing two handshakes. Chrome extension service workers are
  // single-threaded, but our own async gaps are not otherwise mutually exclusive.
  let creatingOffscreen: Promise<void> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  const statusWaiters = new Map<number, (stillActive: boolean) => void>();

  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work, work);
    pending = result.catch(() => undefined);
    return result;
  }

  async function readRecord(): Promise<CaptureStorageRecord | undefined> {
    const stored = await chromeApis.storage.session.get([CAPTURE_STORAGE_KEY]);
    const value = stored[CAPTURE_STORAGE_KEY];
    return isCaptureStorageRecord(value) ? value : undefined;
  }

  async function writeRecord(record: CaptureStorageRecord): Promise<void> {
    await chromeApis.storage.session.set({ [CAPTURE_STORAGE_KEY]: record });
  }

  async function publish(record: CaptureStorageRecord): Promise<void> {
    await writeRecord(record);
    await broadcast(chromeApis, { channel: PANEL_STATUS_CHANNEL, status: snapshotOf(record) });
  }

  async function sendToOffscreen(message: BackgroundToOffscreenMessage): Promise<void> {
    await broadcast(chromeApis, message);
  }

  async function ensureOffscreenDocument(): Promise<void> {
    const url = chromeApis.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    const existing = await chromeApis.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url],
    });
    if (existing.length > 0) return;
    if (!creatingOffscreen) {
      creatingOffscreen = chromeApis.offscreen
        .createDocument({
          url,
          reasons: ["USER_MEDIA"],
          justification:
            "Consume a single-use tab-capture stream ID and keep the audio track alive so the lecture stays audible while captured.",
        })
        .finally(() => {
          creatingOffscreen = undefined;
        });
    }
    await creatingOffscreen;
  }

  async function teardown(
    record: CaptureStorageRecord,
    reason?: CaptureErrorReason,
  ): Promise<void> {
    await sendToOffscreen({
      channel: OFFSCREEN_COMMAND_CHANNEL,
      kind: "stop",
      generation: record.generation,
    });
    try {
      await chromeApis.offscreen.closeDocument();
    } catch {
      // No document existed, or it was already gone. Nothing left to clean up.
    }
    const next: CaptureStorageRecord = reason
      ? { version: 1, state: "error", generation: record.generation, tabId: record.tabId, reason }
      : { version: 1, state: "idle", generation: record.generation, tabId: record.tabId };
    await publish(next);
  }

  async function handleActionClicked(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id === undefined) return; // Restricted page or no addressable tab: fail closed.
    const tabId = tab.id;
    // Called first and awaited immediately, before any other work, so the side
    // panel opens inside the click's user-gesture window regardless of which
    // branch below actually applies. Opening an already-open panel for the
    // same tab is an idempotent no-op.
    try {
      await chromeApis.sidePanel.open({ tabId });
    } catch {
      // A restricted page (chrome://, the Web Store, etc.) rejects this. Fail closed
      // silently; there is no disclosure surface to explain anything on such a page.
      return;
    }

    const record = await readRecord();

    if (
      record &&
      (record.state === "starting" || record.state === "active" || record.state === "stopping")
    ) {
      // Reopen only; never start a second capture or silently stop.
      await broadcast(chromeApis, { channel: PANEL_STATUS_CHANNEL, status: snapshotOf(record) });
      return;
    }

    if (
      record &&
      record.state === "armed" &&
      record.tabId === tabId &&
      record.armedExpiresAt !== undefined &&
      now() < record.armedExpiresAt
    ) {
      await beginHandshake(record);
      return;
    }

    if (
      record &&
      record.state === "awaiting_consent" &&
      record.tabId === tabId &&
      record.awaitingConsentExpiresAt !== undefined &&
      now() < record.awaitingConsentExpiresAt
    ) {
      // A second click before consent only reopens the disclosure.
      await broadcast(chromeApis, { channel: PANEL_STATUS_CHANNEL, status: snapshotOf(record) });
      return;
    }

    // Idle, error, expired, or a different tab: start a fresh disclosure.
    const generation = (record?.generation ?? 0) + 1;
    const fresh: CaptureStorageRecord = {
      version: 1,
      state: "awaiting_consent",
      generation,
      tabId,
      awaitingConsentExpiresAt: now() + CONSENT_EXPIRY_MS,
    };
    await publish(fresh);
  }

  async function beginHandshake(record: CaptureStorageRecord): Promise<void> {
    const starting: CaptureStorageRecord = {
      version: 1,
      state: "starting",
      generation: record.generation,
      tabId: record.tabId,
    };
    await publish(starting);

    try {
      await ensureOffscreenDocument();
    } catch {
      await teardown(starting, "offscreen_failed");
      return;
    }

    let streamId: string;
    try {
      streamId = await chromeApis.tabCapture.getMediaStreamId({ targetTabId: record.tabId });
    } catch {
      await teardown(starting, "stream_id_failed");
      return;
    }

    // Immediately forward the single-use ID; no other await may intervene.
    await sendToOffscreen({
      channel: OFFSCREEN_COMMAND_CHANNEL,
      kind: "consume_stream",
      generation: record.generation,
      streamId,
    });
    // `active` is only entered once the offscreen document acknowledges a live
    // track (see handleOffscreenAck); "starting" already reflects the interim state.
  }

  async function handlePanelMessage(
    message: unknown,
    sendResponse: (response: unknown) => void,
  ): Promise<void> {
    if (!isPanelToBackgroundMessage(message)) return;
    if (message.kind === "get_status") {
      const record = await readRecord();
      sendResponse({ ok: true, status: snapshotOf(record) });
      return;
    }
    const record = await readRecord();
    if (!record || record.generation !== message.generation) {
      sendResponse({ ok: false, reason: "unexpected" satisfies CaptureErrorReason });
      return;
    }
    if (message.kind === "consent") {
      if (
        record.state !== "awaiting_consent" ||
        record.awaitingConsentExpiresAt === undefined ||
        now() >= record.awaitingConsentExpiresAt
      ) {
        await teardown(record, "consent_expired");
        sendResponse({ ok: false, reason: "consent_expired" satisfies CaptureErrorReason });
        return;
      }
      const armed: CaptureStorageRecord = {
        version: 1,
        state: "armed",
        generation: record.generation,
        tabId: record.tabId,
        armedExpiresAt: now() + ARM_EXPIRY_MS,
      };
      await publish(armed);
      sendResponse({ ok: true, status: snapshotOf(armed) });
      return;
    }
    // stop
    await teardown(record);
    sendResponse({ ok: true, status: IDLE_STATUS });
  }

  /** Resolves a pending `queryOffscreenGeneration` wait, if any, for this exact
   * message. Deliberately called outside `serialize()`: a reconciliation that
   * is itself mid-flight through the serialization queue would otherwise
   * block the very ack it is waiting for from ever being processed — the
   * wait would then only ever end by timing out, never by the real answer. */
  function resolveStatusWaiter(message: { generation: number; kind: string }): void {
    const waiter = statusWaiters.get(message.generation);
    if (!waiter) return;
    statusWaiters.delete(message.generation);
    waiter(message.kind === "track_active");
  }

  async function handleOffscreenAck(message: unknown): Promise<void> {
    if (!isOffscreenToBackgroundMessage(message)) return;
    const record = await readRecord();
    if (!record || record.generation !== message.generation) return; // Stale event.
    if (message.kind === "track_active" && record.state === "starting") {
      await publish({ ...record, state: "active" });
      return;
    }
    if (message.kind === "track_failed" && record.state === "starting") {
      await teardown(record, message.reason ?? "capture_failed");
      return;
    }
    if (
      message.kind === "track_ended" &&
      (record.state === "starting" || record.state === "active")
    ) {
      await teardown(record);
      return;
    }
    // "stopped" acks and any other combination need no further action.
  }

  async function handleTabRemoved(tabId: number): Promise<void> {
    const record = await readRecord();
    if (!record || record.tabId !== tabId) return;
    if (record.state === "idle" || record.state === "error") return;
    await teardown(record);
  }

  async function handleNativeStatusChanged(info: { tabId: number; status: string }): Promise<void> {
    // No generation identifier: a reconciliation hint only, never an authority.
    if (info.status !== "stopped" && info.status !== "error") return;
    const record = await readRecord();
    if (!record || record.tabId !== info.tabId) return;
    if (record.state !== "active" && record.state !== "starting") return;
    const [captured, offscreenAlive] = await Promise.all([
      chromeApis.tabCapture.getCapturedTabs(),
      queryOffscreenGeneration(record.generation),
    ]);
    const stillCaptured = captured.some(
      (entry) =>
        entry.tabId === info.tabId && (entry.status === "active" || entry.status === "pending"),
    );
    if (!stillCaptured && !offscreenAlive) await teardown(record);
    // Otherwise a newer capture on the same tab superseded a delayed stale event.
  }

  /** Resolved by `handleOffscreenAck` when a matching reply arrives on the shared
   * channel; never installs a second `onMessage` listener. */
  async function queryOffscreenGeneration(generation: number): Promise<boolean> {
    const answered = new Promise<boolean>((resolve) => {
      statusWaiters.set(generation, resolve);
    });
    await sendToOffscreen({
      channel: OFFSCREEN_COMMAND_CHANNEL,
      kind: "get_status",
      generation,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), reconcileStatusTimeoutMs);
    });
    try {
      return await Promise.race([answered, timeout]);
    } finally {
      statusWaiters.delete(generation);
      clearTimeout(timer);
    }
  }

  async function reconcileOnWake(): Promise<void> {
    const record = await readRecord();
    if (!record) return;
    if (record.state === "awaiting_consent") {
      if (
        record.awaitingConsentExpiresAt === undefined ||
        now() >= record.awaitingConsentExpiresAt
      ) {
        await publish({
          version: 1,
          state: "idle",
          generation: record.generation,
          tabId: record.tabId,
        });
      }
      return;
    }
    if (record.state === "armed") {
      if (record.armedExpiresAt === undefined || now() >= record.armedExpiresAt) {
        await publish({
          version: 1,
          state: "idle",
          generation: record.generation,
          tabId: record.tabId,
        });
      }
      return;
    }
    if (record.state === "starting" || record.state === "active" || record.state === "stopping") {
      const url = chromeApis.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
      const hasOffscreen = await chromeApis.runtime
        .getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] })
        .then((contexts) => contexts.length > 0)
        .catch(() => false);
      if (!hasOffscreen) {
        await publish({
          version: 1,
          state: "idle",
          generation: record.generation,
          tabId: record.tabId,
        });
        return;
      }
      const stillActive = await queryOffscreenGeneration(record.generation);
      if (stillActive) {
        await publish({ ...record, state: "active" });
      } else {
        await teardown(record);
      }
      return;
    }
    // idle / error: nothing to reconcile.
  }

  function attachListeners(): void {
    chromeApis.action.onClicked.addListener((tab) => {
      void serialize(() => handleActionClicked(tab)).catch((error: unknown) =>
        logger.error(
          `LiveLecture AI: capture action handling failed (${error instanceof Error ? error.name : "unknown"}).`,
        ),
      );
    });
    chromeApis.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (isPanelToBackgroundMessage(message)) {
        void serialize(() => handlePanelMessage(message, sendResponse)).catch((error: unknown) =>
          logger.error(
            `LiveLecture AI: capture message handling failed (${error instanceof Error ? error.name : "unknown"}).`,
          ),
        );
        return true; // Keep the channel open for the async sendResponse above.
      }
      if (isOffscreenToBackgroundMessage(message)) {
        resolveStatusWaiter(message);
        void serialize(() => handleOffscreenAck(message)).catch((error: unknown) =>
          logger.error(
            `LiveLecture AI: capture ack handling failed (${error instanceof Error ? error.name : "unknown"}).`,
          ),
        );
      }
      return false;
    });
    chromeApis.tabs.onRemoved.addListener((tabId) => {
      void serialize(() => handleTabRemoved(tabId)).catch((error: unknown) =>
        logger.error(
          `LiveLecture AI: capture tab-close handling failed (${error instanceof Error ? error.name : "unknown"}).`,
        ),
      );
    });
    chromeApis.tabCapture.onStatusChanged.addListener((info) => {
      void serialize(() => handleNativeStatusChanged(info)).catch((error: unknown) =>
        logger.error(
          `LiveLecture AI: capture status reconciliation failed (${error instanceof Error ? error.name : "unknown"}).`,
        ),
      );
    });
  }

  return {
    attachListeners,
    reconcileOnWake: () => serialize(reconcileOnWake),
    // Exposed for tests only; production code drives everything through the
    // listeners above.
    _internal: { handleActionClicked, handlePanelMessage, readRecord },
  };
}
