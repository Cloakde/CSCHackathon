import { ScribeTokenResponseSchema, type TranscriptEvent } from "@livelecture/shared";
import { LIVE_CHANNEL, LIVE_TEST_BUDGET, LiveCommandSchema } from "./live-protocol";
import { attachPcmTap } from "./live-audio";
import {
  createScribeRealtimeTransport,
  type ScribeTransportOptions,
  type ScribeSocket,
} from "./transcription/scribe-transport";
import type { OffscreenChrome } from "./offscreen";

export interface LiveOffscreenMedia {
  get(
    generation: number,
  ): { context: AudioContext; source: MediaStreamAudioSourceNode } | undefined;
  stop(generation: number): void;
}
export interface LiveOffscreenDependencies {
  tap?: typeof attachPcmTap;
  transport?: typeof createScribeRealtimeTransport;
  fetcher?: typeof fetch;
  connect?: ScribeTransportOptions["connect"];
}
interface LiveOwner {
  generation: number;
  sessionId: string;
  abort: AbortController;
  lastSeen: number;
  lease: ReturnType<typeof setInterval>;
  transport?: ReturnType<typeof createScribeRealtimeTransport>;
  untap?: () => void;
}
function connectSocket(url: string): ScribeSocket {
  const socket = new WebSocket(url);
  const adapter: ScribeSocket = {
    send: (data) => socket.send(data),
    close: (code) => socket.close(code),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
  socket.onopen = () => adapter.onopen?.();
  socket.onmessage = (event) => adapter.onmessage?.({ data: event.data });
  socket.onerror = (event) => adapter.onerror?.(event);
  socket.onclose = (event) => adapter.onclose?.({ code: event.code, reason: event.reason });
  return adapter;
}

/** All PCM, provider tokens and sockets stay in the offscreen document. */
export function createLiveOffscreen(
  chromeApis: OffscreenChrome,
  media: LiveOffscreenMedia,
  workletUrl: string,
  dependencies: LiveOffscreenDependencies = {},
) {
  let active: LiveOwner | undefined;
  function stop() {
    const previous = active;
    active = undefined;
    if (!previous) return;
    previous.abort.abort();
    clearInterval(previous.lease);
    previous.untap?.();
    previous.transport?.stop();
  }
  function fail(owner: LiveOwner) {
    if (active !== owner) return;
    const generation = active?.generation;
    stop();
    if (generation) media.stop(generation);
  }
  async function handle(raw: unknown): Promise<{ ok: boolean }> {
    const result = LiveCommandSchema.safeParse(raw);
    if (!result.success) return { ok: false };
    const command = result.data;
    if (command.kind !== "start") {
      if (
        !active ||
        command.generation !== active.generation ||
        command.sessionId !== active.sessionId
      )
        return { ok: false };
      if (command.kind === "heartbeat") active.lastSeen = Date.now();
      else fail(active);
      return { ok: true };
    }
    if (active) return { ok: false };
    const audio = media.get(command.generation);
    if (!audio) return { ok: false };
    const abort = new AbortController();
    const owner: LiveOwner = {
      generation: command.generation,
      sessionId: command.sessionId,
      abort,
      lastSeen: Date.now(),
      lease: setInterval(() => {
        if (active === owner && Date.now() - owner.lastSeen > 5_000) fail(owner);
      }, 1_000),
    };
    active = owner;
    const emit = (event: TranscriptEvent) => {
      if (active !== owner) return;
      void chromeApis.runtime
        .sendMessage({
          channel: LIVE_CHANNEL,
          kind: "event",
          generation: command.generation,
          event,
        })
        .catch(() => fail(owner));
      if (
        (event.type === "source.error" && !event.error.retryable) ||
        (event.type === "source.state" && ["error", "stopped"].includes(event.status))
      )
        fail(owner);
    };
    try {
      // Set up the tap before minting: a worklet failure spends no provider token.
      const untap = await (dependencies.tap ?? attachPcmTap)(
        audio.context,
        audio.source,
        workletUrl,
        (chunk) => owner.transport?.chunk(chunk),
        () => fail(owner),
        abort.signal,
      );
      if (active !== owner) {
        untap();
        return { ok: false };
      }
      owner.untap = untap;
      owner.transport = (dependencies.transport ?? createScribeRealtimeTransport)({
        sessionId: command.sessionId,
        budget: LIVE_TEST_BUDGET,
        connect: dependencies.connect ?? connectSocket,
        onEvent: emit,
        // A retention warning contradicts this run's disclosure: stop immediately.
        onWarning: () => fail(owner),
        onDiscardedGap: () =>
          emit({
            schemaVersion: 1,
            eventId: `gap_${crypto.randomUUID().replaceAll("-", "_")}`,
            sequence: 0,
            sessionId: command.sessionId,
            emittedAt: new Date().toISOString(),
            type: "source.error",
            sourceMode: "live",
            error: {
              code: "PROVIDER_UNAVAILABLE",
              message:
                "Some audio was missed during startup or reconnection. Only received passages can support answers.",
              retryable: true,
            },
          }),
        mintToken: async (signal) => {
          const bounded = new AbortController();
          const cancel = () => bounded.abort();
          signal?.addEventListener("abort", cancel, { once: true });
          abort.signal.addEventListener("abort", cancel, { once: true });
          if (signal?.aborted || abort.signal.aborted) cancel();
          const timer = setTimeout(cancel, 8_000);
          try {
            const response = await (dependencies.fetcher ?? fetch)(
              "http://127.0.0.1:3000/api/providers/elevenlabs/realtime-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-livelecture-spike-capability": command.capability,
                },
                body: "{}",
                credentials: "omit",
                cache: "no-store",
                redirect: "error",
                signal: bounded.signal,
              },
            );
            if (!response.ok || !response.body) throw new Error("Token unavailable");
            const reader = response.body.getReader();
            let text = "";
            let bytes = 0;
            const decoder = new TextDecoder("utf-8", { fatal: true });
            try {
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                bytes += part.value.length;
                if (bytes > 16_384) throw new Error("Invalid token response");
                text += decoder.decode(part.value, { stream: true });
              }
              text += decoder.decode();
            } finally {
              void reader.cancel().catch(() => undefined);
            }
            return ScribeTokenResponseSchema.parse(JSON.parse(text));
          } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", cancel);
            abort.signal.removeEventListener("abort", cancel);
          }
        },
      });
      if (active !== owner) {
        owner.transport.stop();
        return { ok: false };
      }
      return { ok: true };
    } catch {
      fail(owner);
      return { ok: false };
    }
  }
  function attach() {
    chromeApis.runtime.onMessage.addListener((raw, _sender, respond) => {
      if (!LiveCommandSchema.safeParse(raw).success) return false;
      void handle(raw).then(respond, () => respond({ ok: false }));
      return true;
    });
  }
  return { attach, handle, stop };
}
