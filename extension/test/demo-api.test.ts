import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoClient, DEMO_REQUEST_TIMEOUT_MS, type DemoFetch } from "../src/demo-api";

afterEach(() => vi.useRealTimers());

describe("demo request boundary", () => {
  it("times out and aborts even a stalled response body", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    const request = vi.fn<DemoFetch>(async (_url, options) => {
      requestSignal = options.signal;
      return { ok: true, json: () => new Promise(() => undefined) } as unknown as Response;
    });
    const pending = createDemoClient(request).start({ sourceMode: "simulation" });
    const checked = expect(pending).rejects.toThrow("took too long");
    await vi.advanceTimersByTimeAsync(DEMO_REQUEST_TIMEOUT_MS);
    await checked;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("rejects another website as a companion handoff", async () => {
    const request = vi.fn<DemoFetch>(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              session: {
                sessionId: "session_demo_1",
                sourceMode: "simulation",
                status: "completed",
                startedAt: "2026-09-05T00:00:00.000Z",
                endedAt: "2026-09-05T00:08:00.000Z",
              },
              handoff: { sessionId: "session_demo_1", companionRoute: "https://example.com" },
            },
          }),
        ),
    );
    await expect(
      createDemoClient(request).end("session_demo_1", "2026-09-05T00:08:00.000Z"),
    ).rejects.toThrow("could not check");
  });

  it("rejects malformed replies and invalid session paths before sending", async () => {
    const request = vi.fn<DemoFetch>(
      async () => new Response(JSON.stringify({ ok: true, data: {} })),
    );
    const client = createDemoClient(request);
    await expect(client.start({ sourceMode: "simulation" })).rejects.toThrow("could not check");
    request.mockClear();
    await expect(client.help("../another-site")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
