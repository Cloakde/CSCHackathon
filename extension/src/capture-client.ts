import {
  IDLE_STATUS,
  PANEL_CHANNEL,
  isBackgroundToPanelStatusMessage,
  isCaptureStatusSnapshot,
  type CaptureStatusSnapshot,
} from "./capture-protocol";

export interface CaptureClientRuntime {
  sendMessage(message: unknown): Promise<unknown>;
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
    removeListener(listener: (message: unknown) => void): void;
  };
}

export interface CaptureClient {
  getStatus(): Promise<CaptureStatusSnapshot>;
  subscribe(listener: (status: CaptureStatusSnapshot) => void): () => void;
  /** Resolves once the background has recorded consent; rejects if the arm/consent
   * window has already expired or another attempt has since superseded it. */
  consent(generation: number): Promise<CaptureStatusSnapshot>;
  stop(generation: number): Promise<CaptureStatusSnapshot>;
}

interface AckResponse {
  ok: boolean;
  status?: unknown;
  reason?: unknown;
}

function isAckResponse(value: unknown): value is AckResponse {
  return typeof value === "object" && value !== null && "ok" in value;
}

export function createCaptureClient(runtime: CaptureClientRuntime): CaptureClient {
  async function getStatus(): Promise<CaptureStatusSnapshot> {
    const response = await runtime.sendMessage({ channel: PANEL_CHANNEL, kind: "get_status" });
    if (isAckResponse(response) && isCaptureStatusSnapshot(response.status)) return response.status;
    return IDLE_STATUS;
  }

  function subscribe(listener: (status: CaptureStatusSnapshot) => void): () => void {
    const handler = (message: unknown) => {
      if (isBackgroundToPanelStatusMessage(message)) listener(message.status);
    };
    runtime.onMessage.addListener(handler);
    return () => runtime.onMessage.removeListener(handler);
  }

  async function send(
    kind: "consent" | "stop",
    generation: number,
  ): Promise<CaptureStatusSnapshot> {
    const response = await runtime.sendMessage({ channel: PANEL_CHANNEL, kind, generation });
    if (!isAckResponse(response)) throw new Error("The capture request could not be completed.");
    if (!response.ok)
      throw new Error(
        response.reason === "consent_expired"
          ? "That disclosure expired. Click the extension icon again to try once more."
          : "That capture request is no longer current. Click the extension icon again to try once more.",
      );
    return isCaptureStatusSnapshot(response.status) ? response.status : IDLE_STATUS;
  }

  return {
    getStatus,
    subscribe,
    consent: (generation) => send("consent", generation),
    stop: (generation) => send("stop", generation),
  };
}
