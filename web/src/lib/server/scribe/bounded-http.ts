export class ScribeHttpError extends Error {
  constructor(readonly status: number) {
    super("Transcription HTTP operation failed.");
  }
}

export async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let reject!: (error: Error) => void;
  const expired = new Promise<never>((_, fail) => {
    reject = fail;
  });
  const abort = () => {
    controller.abort();
    reject(new ScribeHttpError(408));
  };
  const timer = setTimeout(abort, timeoutMs);
  parent?.addEventListener("abort", abort, { once: true });
  try {
    if (parent?.aborted) abort();
    return await Promise.race([
      expired,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new ScribeHttpError(408);
        return work(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}

export async function readBoundedJson(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
): Promise<unknown> {
  if (!body) return {};
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new ScribeHttpError(408);
      const next = await reader.read();
      if (signal.aborted) throw new ScribeHttpError(408);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new ScribeHttpError(413);
      chunks.push(next.value);
    }
    if (!size) return {};
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
