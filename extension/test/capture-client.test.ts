import { describe, expect, it, vi } from "vitest";
import { createCaptureClient, type CaptureClientRuntime } from "../src/capture-client";
import { PANEL_CHANNEL, PANEL_STATUS_CHANNEL } from "../src/capture-protocol";

function fakeRuntime(sendMessage: CaptureClientRuntime["sendMessage"]): {
  runtime: CaptureClientRuntime;
  emit: (message: unknown) => void;
  listenerCount: () => number;
} {
  const listeners = new Set<(message: unknown) => void>();
  return {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (l) => listeners.add(l),
        removeListener: (l) => listeners.delete(l),
      },
    },
    emit: (message) => listeners.forEach((l) => l(message)),
    listenerCount: () => listeners.size,
  };
}

describe("capture client (TASK-101 side-panel surface)", () => {
  it("requests status via the panel channel and falls back to idle on a malformed reply", async () => {
    const { runtime } = fakeRuntime(
      vi.fn(async () => ({ ok: true, status: { state: "active", generation: 3 } })),
    );
    const client = createCaptureClient(runtime);
    await expect(client.getStatus()).resolves.toEqual({ state: "active", generation: 3 });

    const { runtime: broken } = fakeRuntime(vi.fn(async () => ({ ok: true, status: "garbage" })));
    await expect(createCaptureClient(broken).getStatus()).resolves.toEqual({
      state: "idle",
      generation: 0,
    });
  });

  it("sends get_status with the exact panel channel shape", async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, status: { state: "idle", generation: 0 } }));
    const { runtime } = fakeRuntime(sendMessage);
    await createCaptureClient(runtime).getStatus();
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      channel: PANEL_CHANNEL,
      kind: "get_status",
    });
  });

  it("subscribes only to status-channel broadcasts and can unsubscribe", () => {
    const { runtime, emit, listenerCount } = fakeRuntime(vi.fn());
    const client = createCaptureClient(runtime);
    const seen: unknown[] = [];
    const unsubscribe = client.subscribe((status) => seen.push(status));
    expect(listenerCount()).toBe(1);

    emit({ channel: PANEL_STATUS_CHANNEL, status: { state: "armed", generation: 1 } });
    emit({ channel: "some-unrelated-channel", status: { state: "active", generation: 99 } });
    expect(seen).toEqual([{ state: "armed", generation: 1 }]);

    unsubscribe();
    expect(listenerCount()).toBe(0);
    emit({ channel: PANEL_STATUS_CHANNEL, status: { state: "active", generation: 2 } });
    expect(seen).toHaveLength(1); // Nothing delivered after unsubscribe.
  });

  it("consent resolves with the new status on success", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      status: { state: "armed", generation: 1 },
    }));
    const { runtime } = fakeRuntime(sendMessage);
    await expect(createCaptureClient(runtime).consent(1)).resolves.toEqual({
      state: "armed",
      generation: 1,
    });
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      channel: PANEL_CHANNEL,
      kind: "consent",
      generation: 1,
    });
  });

  it("consent and stop reject with a safe message on failure, never a raw Chrome error", async () => {
    const { runtime } = fakeRuntime(vi.fn(async () => ({ ok: false, reason: "consent_expired" })));
    await expect(createCaptureClient(runtime).consent(1)).rejects.toThrow(/expired/i);

    const { runtime: other } = fakeRuntime(
      vi.fn(async () => ({ ok: false, reason: "unexpected" })),
    );
    await expect(createCaptureClient(other).stop(1)).rejects.toThrow(/no longer current/i);
  });

  it("throws if the background never returns a recognizable response", async () => {
    const { runtime } = fakeRuntime(vi.fn(async () => undefined));
    await expect(createCaptureClient(runtime).stop(1)).rejects.toThrow();
  });
});
