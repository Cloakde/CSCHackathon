import {
  StableIdSchema,
  TranscriptEventSchema,
  type TranscriptEvent,
  type TranscriptSource,
  type TranscriptSourceSnapshot,
} from "@livelecture/shared";
import type { CaptureClient, CaptureClientRuntime } from "./capture-client";
import { OFFSCREEN_COMMAND_CHANNEL, type CaptureStatusSnapshot } from "./capture-protocol";
import { LIVE_CHANNEL, LiveEventSchema } from "./live-protocol";

/** An explicit, bounded rehearsal source. No audio or token is stored by the panel. */
export class LiveTranscriptSource implements TranscriptSource {
  private snapshot: TranscriptSourceSnapshot = {
    mode: "live",
    status: "idle",
    session: { sessionId: "live_pending", title: "Live lecture test" },
  };
  private listeners = new Set<(event: TranscriptEvent) => void>();
  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private captureTimer?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private capability = "";
  private generation = 0;
  private epoch = 0;
  private sequence = 0;
  private connecting = false;
  constructor(
    private capture: CaptureClient,
    private runtime: CaptureClientRuntime,
  ) {}
  prepare(sessionId: string, capability: string) {
    if (this.snapshot.status === "active" || this.snapshot.status === "starting")
      throw new Error("Stop the current live test first.");
    StableIdSchema.parse(sessionId);
    if (!/^[a-f0-9]{32}$/.test(capability))
      throw new Error("Enter the temporary live-test code from the authorized launcher.");
    this.capability = capability;
    this.snapshot = {
      ...this.snapshot,
      status: "idle",
      session: { ...this.snapshot.session, sessionId },
    };
  }
  subscribe(listener: (event: TranscriptEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  getSnapshot() {
    return this.snapshot;
  }
  private publish(event: Record<string, unknown>) {
    const parsed = TranscriptEventSchema.parse({
      ...event,
      schemaVersion: 1,
      eventId: `live_event_${crypto.randomUUID().replaceAll("-", "_")}`,
      sequence: this.sequence++,
      sessionId: this.snapshot.session.sessionId,
      emittedAt: new Date().toISOString(),
    });
    for (const listener of this.listeners) listener(parsed);
  }
  private state(status: TranscriptSourceSnapshot["status"]) {
    this.snapshot = { ...this.snapshot, status };
    this.publish({ type: "source.state", sourceMode: "live", status });
  }
  private fail() {
    this.stop();
    this.state("error");
    this.publish({
      type: "source.error",
      sourceMode: "live",
      error: {
        code: "PROVIDER_UNAVAILABLE",
        message:
          "Live transcription stopped. Check the test setup; the sample lecture has not been substituted.",
        retryable: false,
      },
    });
  }
  start() {
    if (["starting", "active"].includes(this.snapshot.status)) return;
    if (!this.capability) {
      this.fail();
      return;
    }
    const epoch = ++this.epoch;
    let consented = false;
    this.deadline = setTimeout(() => {
      if (epoch === this.epoch) this.fail();
    }, 65_000);
    this.state("starting");
    this.publish({
      type: "session.started",
      sourceMode: "live",
      startedAt: new Date().toISOString(),
      title: this.snapshot.session.title,
    });
    const onEvent = (raw: unknown) => {
      const parsed = LiveEventSchema.safeParse(raw);
      if (
        !parsed.success ||
        epoch !== this.epoch ||
        parsed.data.generation !== this.generation ||
        parsed.data.event.sessionId !== this.snapshot.session.sessionId
      )
        return;
      const event = parsed.data.event;
      if (event.type === "source.error" && !event.error.retryable) {
        this.fail();
        return;
      }
      if (event.type === "source.state") {
        if (event.status === "stopped" || event.status === "error") {
          this.fail();
          return;
        }
        this.state(event.status);
        return;
      }
      this.publish(event);
    };
    this.runtime.onMessage.addListener(onEvent);
    const onCapture = async (status: CaptureStatusSnapshot) => {
      if (epoch !== this.epoch) return;
      if (this.generation && status.generation !== this.generation) {
        this.fail();
        return;
      }
      if (status.state === "error" || (status.state === "idle" && this.generation)) {
        this.fail();
        return;
      }
      this.generation = status.generation;
      if (status.state !== "active" || this.connecting || !consented) return;
      clearTimeout(this.deadline);
      this.connecting = true;
      try {
        const response = await this.runtime.sendMessage({
          channel: LIVE_CHANNEL,
          kind: "start",
          generation: this.generation,
          sessionId: this.snapshot.session.sessionId,
          capability: this.capability,
        });
        if (epoch !== this.epoch) return;
        if (
          !response ||
          typeof response !== "object" ||
          !("ok" in response) ||
          response.ok !== true
        )
          throw new Error("Live test unavailable");
        this.capability = "";
        this.timer = setInterval(() => {
          void this.runtime
            .sendMessage({
              channel: LIVE_CHANNEL,
              kind: "heartbeat",
              generation: this.generation,
              sessionId: this.snapshot.session.sessionId,
            })
            .then((reply) => {
              if (!reply || typeof reply !== "object" || !("ok" in reply) || reply.ok !== true)
                throw new Error("Live helper unavailable");
            })
            .catch(() => {
              if (epoch === this.epoch) this.fail();
            });
        }, 1_000);
      } catch {
        if (epoch === this.epoch) this.fail();
      }
    };
    const off = this.capture.subscribe((status) => {
      void onCapture(status);
    });
    this.unsubscribe = () => {
      off();
      this.runtime.onMessage.removeListener(onEvent);
    };
    void this.capture
      .getStatus()
      .then(async (status) => {
        if (epoch !== this.epoch) return;
        if (status.state !== "awaiting_consent")
          throw new Error("Open the lecture tab using the extension icon first.");
        this.generation = status.generation;
        await this.capture.consent(status.generation);
        consented = epoch === this.epoch;
        if (consented)
          this.captureTimer = setInterval(() => {
            void this.runtime
              .sendMessage({
                channel: OFFSCREEN_COMMAND_CHANNEL,
                kind: "lease_heartbeat",
                generation: status.generation,
              })
              .then((reply) => {
                if (!reply || typeof reply !== "object" || !("ok" in reply) || reply.ok !== true)
                  throw new Error("Capture lease expired");
              })
              .catch(() => {
                if (epoch === this.epoch) this.fail();
              });
          }, 1_000);
        // The second toolbar click supplies Chrome's required user gesture.
      })
      .catch(() => {
        if (epoch === this.epoch) this.fail();
      });
  }
  stop() {
    ++this.epoch;
    clearInterval(this.timer);
    clearInterval(this.captureTimer);
    clearTimeout(this.deadline);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.connecting = false;
    this.capability = "";
    const generation = this.generation;
    this.generation = 0;
    if (generation)
      void this.capture
        .stop(generation)
        .finally(() =>
          this.runtime
            .sendMessage({
              channel: LIVE_CHANNEL,
              kind: "stop",
              generation,
              sessionId: this.snapshot.session.sessionId,
            })
            .catch(() => undefined),
        )
        .catch(() => undefined);
    if (this.snapshot.status !== "idle" && this.snapshot.status !== "stopped")
      this.state("stopped");
  }
}
