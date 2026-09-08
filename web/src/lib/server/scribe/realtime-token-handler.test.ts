import { describe, expect, it, vi } from "vitest";
import { CAPABILITY_HEADER, createRealtimeTokenHandler } from "./realtime-token-handler";

const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const CAPABILITY = "one-run-capability-value";
const KEY = "offline-test-key";

function request(
  overrides: Partial<{ method: string; headers: Record<string, string>; body: string }> = {},
) {
  const headers = {
    host: "127.0.0.1:3000",
    origin: ORIGIN,
    [CAPABILITY_HEADER]: CAPABILITY,
    "content-type": "application/json",
    ...overrides.headers,
  };
  const method = overrides.method ?? "POST";
  return new Request("http://127.0.0.1:3000/api/providers/elevenlabs/realtime-token", {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body: overrides.body ?? "{}" }),
  });
}

function handler(options: Partial<Parameters<typeof createRealtimeTokenHandler>[0]> = {}) {
  const mintToken = vi.fn(async () => ({ token: "minted-token", expiresInSeconds: 900 }));
  return {
    mintToken,
    handle: createRealtimeTokenHandler({
      enabled: true,
      extensionId: EXTENSION_ID,
      capabilityToken: CAPABILITY,
      apiKey: KEY,
      mintToken,
      ...options,
    }),
  };
}

describe("realtime-token route (TASK-102)", () => {
  it("is disabled by default even with otherwise-correct configuration", async () => {
    const { handle, mintToken } = handler({ enabled: false });
    const response = await handle(request());
    expect(response.status).toBe(404);
    expect(mintToken).not.toHaveBeenCalled();
  });

  it("mints one fresh credential for a fully valid request, with no-store and CORS", async () => {
    const { handle, mintToken } = handler();
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const body = await response.json();
    expect(body).toEqual({
      token: "minted-token",
      expiresInSeconds: 900,
      modelId: "scribe_v2_realtime",
      audioFormat: "pcm_16000",
      commitStrategy: "vad",
    });
    expect(mintToken).toHaveBeenCalledExactlyOnceWith({
      apiKey: KEY,
      signal: expect.any(AbortSignal),
    });
  });

  it("handles preflight with an exact origin, no wildcard", async () => {
    const { handle } = handler();
    const response = await handle(request({ method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain(CAPABILITY_HEADER);

    const wrongOrigin = await handle(
      request({ method: "OPTIONS", headers: { origin: "https://evil.example" } }),
    );
    expect(wrongOrigin.status).toBe(404);
  });

  it.each([
    ["non-loopback host", { headers: { host: "example.com" } }],
    ["missing origin", { headers: { origin: "" } }],
    ["wrong origin", { headers: { origin: "chrome-extension://someone-else" } }],
    ["missing capability", { headers: { [CAPABILITY_HEADER]: "" } }],
    ["wrong capability", { headers: { [CAPABILITY_HEADER]: "guessed" } }],
    ["wrong content-type", { headers: { "content-type": "text/plain" } }],
    ["wrong method", { method: "GET" }],
  ])("rejects %s before contacting the upstream", async (_label, overrides) => {
    const { handle, mintToken } = handler();
    const response = await handle(request(overrides as Parameters<typeof request>[0]));
    expect(response.status).not.toBe(200);
    expect(mintToken).not.toHaveBeenCalled();
  });

  it("rejects an oversized or schema-invalid body before the upstream call", async () => {
    const { handle, mintToken } = handler();
    const oversized = await handle(
      request({ body: JSON.stringify({ padding: "x".repeat(2_000) }) }),
    );
    expect(oversized.status).toBe(413);
    const wrongShape = await handle(request({ body: JSON.stringify({ unexpected: "field" }) }));
    expect(wrongShape.status).toBe(400);
    expect(mintToken).not.toHaveBeenCalled();
  });

  it("enforces a hard issuance cap for the one-run capability", async () => {
    const { handle, mintToken } = handler({ maxIssuances: 2 });
    expect((await handle(request())).status).toBe(200);
    expect((await handle(request())).status).toBe(200);
    const third = await handle(request());
    expect(third.status).toBe(429);
    expect(mintToken).toHaveBeenCalledTimes(2);
  });

  it("reserves the issuance slot before the mint completes, so a concurrent request cannot slip past the cap", async () => {
    let releaseFirst!: () => void;
    const pendingFirst = new Promise<{ token: string; expiresInSeconds: number }>((resolve) => {
      releaseFirst = () => resolve({ token: "first", expiresInSeconds: 900 });
    });
    const mintToken = vi.fn().mockReturnValueOnce(pendingFirst).mockResolvedValue({
      token: "second",
      expiresInSeconds: 900,
    });
    const { handle } = handler({ maxIssuances: 1, mintToken });
    const first = handle(request());
    const second = await handle(request()); // Issued while the first is still pending.
    expect(second.status).toBe(429);
    releaseFirst();
    expect((await first).status).toBe(200);
    expect(mintToken).toHaveBeenCalledTimes(1);
  });

  it("maps an upstream mint failure to a safe error without exposing the key", async () => {
    const mintToken = vi.fn(async () => {
      throw new Error(`upstream rejected key ${KEY}`);
    });
    const { handle } = handler({ mintToken });
    const response = await handle(request());
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(KEY);
  });

  it("never returns the permanent API key; it appears only where the fake upstream received it", async () => {
    let sawKeyOnlyInMintCall = false;
    const mintToken = vi.fn(async (options: { apiKey: string }) => {
      sawKeyOnlyInMintCall = options.apiKey === KEY;
      return { token: "minted-token", expiresInSeconds: 900 };
    });
    const { handle } = handler({ mintToken });
    const response = await handle(request());
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain(KEY);
    expect(sawKeyOnlyInMintCall).toBe(true);
  });

  it("treats a missing extension ID or capability configuration as disabled, not a 500", async () => {
    const { handle } = handler({ extensionId: undefined });
    expect((await handle(request())).status).toBe(404);
    const { handle: handle2 } = handler({ capabilityToken: undefined });
    expect((await handle2(request())).status).toBe(404);
    const { handle: handle3 } = handler({ apiKey: undefined });
    expect((await handle3(request())).status).toBe(404);
  });
});
it("rejects a chunked oversized body before EOF and never mints", async () => {
  const { handle, mintToken } = handler();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(2048));
    },
  });
  const req = request();
  const response = await handle(
    new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(response.status).toBe(413);
  expect(mintToken).not.toHaveBeenCalled();
});
it("bounds stalled incoming bodies and cancellation before any issuance", async () => {
  vi.useFakeTimers();
  try {
    const { handle, mintToken } = handler();
    const req = request();
    const pending = handle(
      new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: new ReadableStream(),
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending).status).toBe(408);
    expect(mintToken).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("an authenticated HEAD proves readiness without spending either issuance", async () => {
  const { handle, mintToken } = handler();
  expect((await handle(request({ method: "HEAD" }))).status).toBe(204);
  expect(mintToken).not.toHaveBeenCalled();
  expect((await handle(request())).status).toBe(200);
  expect((await handle(request())).status).toBe(200);
  expect((await handle(request())).status).toBe(429);
});
