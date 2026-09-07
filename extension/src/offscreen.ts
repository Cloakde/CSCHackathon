import {
  OFFSCREEN_ACK_CHANNEL,
  isBackgroundToOffscreenMessage,
  type OffscreenAckKind,
  type CaptureErrorReason,
} from "./capture-protocol";

/** The narrow media/runtime surface this document needs, so tests inject fakes
 * instead of a real `navigator.mediaDevices` / `AudioContext` / `chrome`. */
export interface OffscreenMediaApis {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createAudioContext(): {
    createMediaStreamSource(stream: MediaStream): { connect(node: unknown): void };
    destination: unknown;
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
) {
  let currentGeneration = 0;
  let stream: MediaStream | undefined;
  let audioContext: ReturnType<OffscreenMediaApis["createAudioContext"]> | undefined;

  function stopEverything(): void {
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream = undefined;
    void audioContext?.close().catch(() => undefined);
    audioContext = undefined;
  }

  async function consumeStream(generation: number, streamId: string): Promise<void> {
    if (stream) {
      // The controller only ever hands out one active generation per profile.
      // Defensively refuse a second concurrent consume rather than doubling audio.
      sendAck(chromeApis, "track_failed", generation, "unexpected");
      return;
    }
    currentGeneration = generation;
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
      if (currentGeneration === generation) currentGeneration = 0;
      sendAck(chromeApis, "track_failed", generation, "getusermedia_failed");
      return;
    }
    if (currentGeneration !== generation) {
      // A newer stop/consume arrived while getUserMedia was pending; honor it.
      obtained.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = obtained;
    const context = media.createAudioContext();
    const source = context.createMediaStreamSource(obtained);
    // Exactly one connection: passthrough stays audible without doubling or echo.
    source.connect(context.destination);
    audioContext = context;
    const [track] = obtained.getAudioTracks();
    if (track) {
      track.onended = () => {
        if (currentGeneration === generation) {
          stopEverything();
          sendAck(chromeApis, "track_ended", generation);
        }
      };
    }
    sendAck(chromeApis, "track_active", generation);
  }

  function stop(generation: number): void {
    if (generation !== currentGeneration) return; // Already clean, or a stale command.
    stopEverything();
    sendAck(chromeApis, "stopped", generation);
  }

  function getStatus(generation: number): void {
    const alive = generation === currentGeneration && stream !== undefined;
    sendAck(chromeApis, alive ? "track_active" : "track_ended", generation);
  }

  function attach(): void {
    chromeApis.runtime.onMessage.addListener((message) => {
      if (!isBackgroundToOffscreenMessage(message)) return false;
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

  return { attach, _internal: { consumeStream, stop, getStatus } };
}

declare const chrome: OffscreenChrome | undefined;

if (typeof chrome !== "undefined") {
  createOffscreenCaptureHandler(chrome, {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext: () => new AudioContext(),
  }).attach();
}
