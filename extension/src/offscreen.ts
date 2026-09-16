import {
  OFFSCREEN_ACK_CHANNEL,
  isBackgroundToOffscreenMessage,
  type OffscreenAckKind,
  type CaptureErrorReason,
} from "./capture-protocol";
import { createLiveOffscreen } from "./live-offscreen";

/** The narrow media/runtime surface this document needs, so tests inject fakes
 * instead of a real `navigator.mediaDevices` / `AudioContext` / `chrome`. */
export interface OffscreenMediaApis {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createAudioContext(): {
    createMediaStreamSource(stream: MediaStream): {
      connect(node: unknown): void;
      disconnect?(): void;
    };
    destination: unknown;
    resume?(): Promise<void>;
    close(): Promise<void>;
  };
}

export interface OffscreenChrome {
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
  };
}

function sendAck(
  chromeApis: OffscreenChrome,
  kind: OffscreenAckKind,
  generation: number,
  reason?: CaptureErrorReason,
): void {
  void chromeApis.runtime
    .sendMessage({
      channel: OFFSCREEN_ACK_CHANNEL,
      kind,
      generation,
      ...(reason ? { reason } : {}),
    })
    .catch(() => undefined); // No listener currently attached; nothing else to do.
}

export function createOffscreenCaptureHandler(
  chromeApis: OffscreenChrome,
  media: OffscreenMediaApis,
  onStop: () => void = () => undefined,
  requirePanelLease = false,
) {
  let currentGeneration = 0;
  let stream: MediaStream | undefined;
  let audioContext: ReturnType<OffscreenMediaApis["createAudioContext"]> | undefined;
  let sourceNode:
    ReturnType<NonNullable<typeof audioContext>["createMediaStreamSource"]> | undefined;
  let acquiring = false;
  let operation = 0;
  let lease: ReturnType<typeof setInterval> | undefined;
  let lastSeen = 0;

  function stopEverything(): void {
    clearInterval(lease);
    lease = undefined;
    operation += 1;
    acquiring = false;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream = undefined;
    onStop();
    sourceNode?.disconnect?.();
    sourceNode = undefined;
    void audioContext?.close().catch(() => undefined);
    audioContext = undefined;
  }

  async function consumeStream(generation: number, streamId: string): Promise<void> {
    if (
      requirePanelLease &&
      (!lease || currentGeneration !== generation || Date.now() - lastSeen > 5_000)
    ) {
      if (currentGeneration === generation) stop(generation);
      sendAck(chromeApis, "track_failed", generation, "unexpected");
      return;
    }
    if (stream || acquiring) {
      // The controller only ever hands out one active generation per profile.
      // Defensively refuse a second concurrent consume rather than doubling audio.
      if (generation !== currentGeneration)
        sendAck(chromeApis, "track_failed", generation, "unexpected");
      return;
    }
    currentGeneration = generation;
    const attempt = ++operation;
    acquiring = true;
    let obtained: MediaStream;
    try {
      obtained = await media.getUserMedia({
        audio: {
          // @ts-expect-error -- Chrome's tab-capture constraint shape, not standard MediaTrackConstraints.
          mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
        },
        video: false,
      });
    } catch {
      if (attempt !== operation) return;
      acquiring = false;
      if (currentGeneration === generation) currentGeneration = 0;
      sendAck(chromeApis, "track_failed", generation, "getusermedia_failed");
      return;
    }
    if (attempt !== operation || currentGeneration !== generation) {
      // A newer stop/consume arrived while getUserMedia was pending; honor it.
      obtained.getTracks().forEach((track) => track.stop());
      return;
    }
    acquiring = false;
    stream = obtained;
    const [track] = obtained.getAudioTracks();
    try {
      if (!track || track.readyState === "ended" || obtained.getAudioTracks().length !== 1)
        throw new Error("No live audio track");
      const context = media.createAudioContext();
      audioContext = context;
      sourceNode = context.createMediaStreamSource(obtained);
      sourceNode.connect(context.destination);
      track.onended = () => {
        if (currentGeneration === generation) {
          stopEverything();
          sendAck(chromeApis, "track_ended", generation);
        }
      };
      await context.resume?.();
      if (attempt !== operation) return;
      if (obtained.getAudioTracks().some((current) => current.readyState === "ended"))
        throw new Error("Audio ended while starting");
      sendAck(chromeApis, "track_active", generation);
    } catch {
      if (attempt !== operation) return;
      stopEverything();
      sendAck(chromeApis, "track_failed", generation, "capture_failed");
    }
  }

  function stop(generation: number): void {
    if (generation !== currentGeneration) return; // Already clean, or a stale command.
    stopEverything();
    currentGeneration = 0;
    sendAck(chromeApis, "stopped", generation);
  }

  function getStatus(generation: number): void {
    const alive =
      generation === currentGeneration &&
      stream !== undefined &&
      stream.getAudioTracks().some((track) => track.readyState !== "ended");
    sendAck(chromeApis, alive ? "track_active" : "track_ended", generation);
  }

  function attach(): void {
    chromeApis.runtime.onMessage.addListener((message, _sender, respond) => {
      if (!isBackgroundToOffscreenMessage(message)) return false;
      if (message.kind === "lease_start" || message.kind === "lease_heartbeat") {
        if (!requirePanelLease) {
          respond({ ok: false });
          return false;
        }
        if (message.kind === "lease_start") {
          if (lease || acquiring || stream) {
            respond({ ok: false });
            return false;
          }
          currentGeneration = message.generation;
          lastSeen = Date.now();
          const generation = currentGeneration;
          lease = setInterval(() => {
            if (currentGeneration === generation && Date.now() - lastSeen > 5_000) stop(generation);
          }, 1_000);
        } else {
          if (!lease || currentGeneration !== message.generation || Date.now() - lastSeen > 5_000) {
            respond({ ok: false });
            return false;
          }
          lastSeen = Date.now();
        }
        respond({ ok: true });
        return false;
      }
      if (message.kind === "consume_stream") {
        void consumeStream(message.generation, message.streamId);
      } else if (message.kind === "stop") {
        stop(message.generation);
      } else {
        getStatus(message.generation);
      }
      return false; // Acks are sent as independent outbound messages, not replies.
    });
  }

  return {
    attach,
    _internal: {
      consumeStream,
      stop,
      getStatus,
      getMedia: (generation: number) =>
        generation === currentGeneration && stream && audioContext && sourceNode
          ? { context: audioContext, source: sourceNode }
          : undefined,
    },
  };
}

declare const chrome: OffscreenChrome | undefined;

if (typeof chrome !== "undefined") {
  let live: ReturnType<typeof createLiveOffscreen> | undefined;
  const handler = createOffscreenCaptureHandler(
    chrome,
    {
      getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      createAudioContext: () => new AudioContext(),
    },
    () => live?.stop(),
    import.meta.env?.VITE_LIVELECTURE_LIVE_TEST === "true",
  );
  handler.attach();
  if (import.meta.env?.VITE_LIVELECTURE_LIVE_TEST === "true") {
    live = createLiveOffscreen(
      chrome,
      {
        get: (generation) =>
          handler._internal.getMedia(generation) as
            { context: AudioContext; source: MediaStreamAudioSourceNode } | undefined,
        stop: handler._internal.stop,
      },
      "pcm-worklet.js",
    );
    live.attach();
  }
}
