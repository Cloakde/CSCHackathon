import type { TranscriptChunk } from "@livelecture/shared";
import type { DemoClient } from "./demo-api";

interface UploadOptions {
  sessionId: string;
  append: DemoClient["append"];
  onFailure: (error: Error) => void;
}

/** One ordered, cancellable append stream. Failures wait for an explicit retry. */
export function createDemoUploader({ sessionId, append, onFailure }: UploadOptions) {
  const chunks: TranscriptChunk[] = [];
  const controller = new AbortController();
  const waiting: { through: number; resolve: () => void; reject: (error: Error) => void }[] = [];
  let acknowledged = 0;
  let running = false;
  let failure: Error | undefined;
  const cancelled = () => new DOMException("Transcript upload was cancelled.", "AbortError");

  function settle(error?: Error) {
    for (let index = waiting.length - 1; index >= 0; index -= 1) {
      const waiter = waiting[index]!;
      if (error || waiter.through <= acknowledged) {
        waiting.splice(index, 1);
        if (error) waiter.reject(error);
        else waiter.resolve();
      }
    }
  }

  function pump() {
    if (running || failure || controller.signal.aborted || acknowledged === chunks.length) return;
    running = true;
    void (async () => {
      try {
        while (!controller.signal.aborted && acknowledged < chunks.length) {
          const batch = chunks.slice(acknowledged, acknowledged + 100);
          const result = await append(sessionId, { chunks: batch }, controller.signal);
          if (controller.signal.aborted) return;
          const accepted = new Set(result.acceptedChunkIds);
          if (
            accepted.size !== batch.length ||
            batch.some((chunk) => !accepted.has(chunk.chunkId))
          ) {
            throw new Error("The transcript was not fully saved. Retry saving the transcript.");
          }
          acknowledged += batch.length;
          settle();
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        failure = error instanceof Error ? error : new Error("Could not save the transcript.");
        settle(failure);
        onFailure(failure);
      } finally {
        running = false;
        pump();
      }
    })();
  }

  function flush(): Promise<void> {
    if (controller.signal.aborted) return Promise.reject(cancelled());
    if (failure) return Promise.reject(failure);
    const through = chunks.length;
    if (through <= acknowledged) return Promise.resolve();
    const result = new Promise<void>((resolve, reject) =>
      waiting.push({ through, resolve, reject }),
    );
    pump();
    return result;
  }

  return {
    enqueue(chunk: TranscriptChunk) {
      if (controller.signal.aborted) return;
      if (chunk.sessionId !== sessionId)
        throw new Error("Cannot upload another lecture's passage.");
      const existing = chunks.find((item) => item.chunkId === chunk.chunkId);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(chunk))
          throw new Error("A saved passage cannot change.");
        return;
      }
      if (chunk.sequence !== chunks.length)
        throw new Error("Transcript passages must arrive in order.");
      chunks.push(structuredClone(chunk));
      pump();
    },
    flush,
    retry() {
      failure = undefined;
      return flush();
    },
    getAcknowledged: () => structuredClone(chunks.slice(0, acknowledged)),
    getFailure: () => failure,
    cancel() {
      controller.abort();
      settle(cancelled());
    },
  };
}

export type DemoUploader = ReturnType<typeof createDemoUploader>;
