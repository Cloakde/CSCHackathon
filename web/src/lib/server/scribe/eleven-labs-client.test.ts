import { afterEach, describe, expect, it, vi } from "vitest";
import { mintScribeRealtimeToken, ScribeTokenMintError } from "./eleven-labs-client";

const key = "offline-test-key";

afterEach(() => vi.useRealTimers());

describe("ElevenLabs single-use realtime token adapter (TASK-102)", () => {
  it("posts to the documented token-type endpoint with the key only in the header", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, options) => {
      expect(String(url)).toBe("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
      expect(options?.method).toBe("POST");
      expect(new Headers(options?.headers).get("xi-api-key")).toBe(key);
      expect(options?.body ?? undefined).toBeUndefined();
      return Response.json({ token: "abc123" });
    });
    const result = await mintScribeRealtimeToken({ apiKey: key, fetcher });
    expect(result).toEqual({ token: "abc123", expiresInSeconds: 900 });
  });

  it("rejects a missing or empty API key before any fetch", async () => {
    const fetcher = vi.fn();
    await expect(mintScribeRealtimeToken({ apiKey: "", fetcher })).rejects.toMatchObject({
      code: "configuration",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps a non-2xx upstream response without exposing its body", async () => {
    const fetcher = vi.fn(async () => new Response(`key ${key} rejected`, { status: 401 }));
    const error = await mintScribeRealtimeToken({ apiKey: key, fetcher }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScribeTokenMintError);
    expect((error as ScribeTokenMintError).code).toBe("upstream");
    expect(String(error)).not.toContain(key);
  });

  it("rejects malformed or unexpected-shape JSON", async () => {
    const malformed = vi.fn(async () => new Response("not json", { status: 200 }));
    await expect(
      mintScribeRealtimeToken({ apiKey: key, fetcher: malformed }),
    ).rejects.toMatchObject({
      code: "response",
    });
    const wrongShape = vi.fn(async () => Response.json({ notToken: "x" }));
    await expect(
      mintScribeRealtimeToken({ apiKey: key, fetcher: wrongShape }),
    ).rejects.toMatchObject({
      code: "response",
    });
  });

  it("aborts and reports timeout when the upstream never responds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const pending = mintScribeRealtimeToken({ apiKey: key, fetcher, timeoutMs: 1_000 });
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("never leaks the key through a thrown transport error", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error(`connect failed for key ${key}`);
    });
    const error = await mintScribeRealtimeToken({ apiKey: key, fetcher }).catch((e: unknown) => e);
    expect(String(error)).not.toContain(key);
  });
});
it("keeps the timeout active through a stalled response body", async () => {
  vi.useFakeTimers();
  const pending = mintScribeRealtimeToken({
    apiKey: key,
    timeoutMs: 100,
    fetcher: async () => new Response(new ReadableStream()),
  });
  const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
  await vi.advanceTimersByTimeAsync(101);
  await assertion;
});
it("bounds upstream bytes and discards a token that echoes the permanent key", async () => {
  await expect(
    mintScribeRealtimeToken({ apiKey: key, fetcher: async () => new Response("x".repeat(8193)) }),
  ).rejects.toMatchObject({ code: "response" });
  await expect(
    mintScribeRealtimeToken({ apiKey: key, fetcher: async () => Response.json({ token: key }) }),
  ).rejects.toMatchObject({ code: "response" });
});
