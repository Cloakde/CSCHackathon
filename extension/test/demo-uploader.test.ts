import { ApiContracts, getCommittedChunksFromFixture } from "@livelecture/shared";
import { describe, expect, it, vi } from "vitest";
import type { DemoClient } from "../src/demo-api";
import { createDemoUploader } from "../src/demo-uploader";

const sessionId = "session_upload_1";
const chunks = getCommittedChunksFromFixture().map((chunk) => ({ ...chunk, sessionId }));
const ids = (from: number, through: number) =>
  chunks.slice(from, through).map((chunk) => chunk.chunkId);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const append = vi.fn<DemoClient["append"]>(async (_id, body) => ({
    acceptedChunkIds: ApiContracts.appendCommittedChunks.request
      .parse(body)
      .chunks.map((chunk) => chunk.chunkId),
  }));
  const onFailure = vi.fn();
  return { append, onFailure, uploader: createDemoUploader({ sessionId, append, onFailure }) };
}

describe("ordered committed transcript uploads", () => {
  it("keeps only one append in flight and sends later arrivals in their original order", async () => {
    const { uploader, append, onFailure } = setup();
    const first = deferred<{ acceptedChunkIds: string[] }>();
    append.mockReturnValueOnce(first.promise);
    uploader.enqueue(chunks[0]!);
    uploader.enqueue(chunks[1]!);
    uploader.enqueue(chunks[2]!);
    expect(append).toHaveBeenCalledTimes(1);
    const flushed = uploader.flush();
    first.resolve({ acceptedChunkIds: ids(0, 1) });
    await flushed;
    expect(append.mock.calls.map((call) => call[1])).toEqual([
      { chunks: chunks.slice(0, 1) },
      { chunks: chunks.slice(1, 3) },
    ]);
    expect(uploader.getAcknowledged()).toEqual(chunks.slice(0, 3));
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("flush waits for its captured prefix without blocking on newer arrivals", async () => {
    const { uploader, append } = setup();
    const first = deferred<{ acceptedChunkIds: string[] }>();
    const second = deferred<{ acceptedChunkIds: string[] }>();
    append.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    uploader.enqueue(chunks[0]!);
    const prefix = uploader.flush();
    uploader.enqueue(chunks[1]!);
    first.resolve({ acceptedChunkIds: ids(0, 1) });
    await prefix;
    expect(uploader.getAcknowledged()).toEqual(chunks.slice(0, 1));
    expect(append).toHaveBeenCalledTimes(2);
    second.resolve({ acceptedChunkIds: ids(1, 2) });
    await uploader.flush();
    expect(uploader.getAcknowledged()).toEqual(chunks.slice(0, 2));
  });

  it("retains failed passages and waits for an explicit retry even when more arrive", async () => {
    const { uploader, append, onFailure } = setup();
    const offline = new Error("offline");
    append.mockRejectedValueOnce(offline);
    uploader.enqueue(chunks[0]!);
    await expect(uploader.flush()).rejects.toBe(offline);
    uploader.enqueue(chunks[1]!);
    await Promise.resolve();
    expect(append).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(offline);
    expect(uploader.getAcknowledged()).toEqual([]);
    expect(uploader.getFailure()).toBe(offline);
    await uploader.retry();
    expect(append.mock.calls[1]?.[1]).toEqual({ chunks: chunks.slice(0, 2) });
    expect(uploader.getAcknowledged()).toEqual(chunks.slice(0, 2));
    expect(uploader.getFailure()).toBeUndefined();
  });

  it.each([
    { acceptedChunkIds: [] },
    { acceptedChunkIds: ["chunk_other_1"] },
    { acceptedChunkIds: [chunks[0]!.chunkId, "chunk_other_1"] },
  ])(
    "does not advance on an incomplete or foreign acknowledgement $acceptedChunkIds",
    async ({ acceptedChunkIds }) => {
      const { uploader, append } = setup();
      append.mockResolvedValueOnce({ acceptedChunkIds });
      uploader.enqueue(chunks[0]!);
      await expect(uploader.flush()).rejects.toThrow("not fully saved");
      expect(uploader.getAcknowledged()).toEqual([]);
      await uploader.retry();
      expect(uploader.getAcknowledged()).toEqual(chunks.slice(0, 1));
    },
  );

  it("cancels waiting work and ignores a transport that returns after cancellation", async () => {
    const { uploader, append, onFailure } = setup();
    const pending = deferred<{ acceptedChunkIds: string[] }>();
    append.mockReturnValueOnce(pending.promise);
    uploader.enqueue(chunks[0]!);
    uploader.enqueue(chunks[1]!);
    const checked = expect(uploader.flush()).rejects.toMatchObject({ name: "AbortError" });
    uploader.cancel();
    await checked;
    expect(append.mock.calls[0]?.[2]?.aborted).toBe(true);
    pending.resolve({ acceptedChunkIds: ids(0, 1) });
    await Promise.resolve();
    expect(uploader.getAcknowledged()).toEqual([]);
    expect(append).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    await expect(uploader.retry()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("preserves canonical session/order/bytes and does not expose mutable stored chunks", async () => {
    const { uploader, append } = setup();
    expect(() => uploader.enqueue({ ...chunks[0]!, sessionId: "session_other_1" })).toThrow(
      "another lecture",
    );
    expect(() => uploader.enqueue(chunks[1]!)).toThrow("in order");
    const input = structuredClone(chunks[0]!);
    uploader.enqueue(input);
    input.text = "changed input";
    await uploader.flush();
    expect(() => uploader.enqueue(input)).toThrow("cannot change");
    uploader.enqueue(chunks[0]!);
    expect(append).toHaveBeenCalledTimes(1);
    const acknowledged = uploader.getAcknowledged();
    acknowledged[0]!.text = "changed output";
    expect(uploader.getAcknowledged()[0]).toEqual(chunks[0]);
  });
});
