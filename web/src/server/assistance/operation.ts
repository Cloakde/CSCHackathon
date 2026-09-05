export const HELP_DEADLINE_MS = 10_000;
export const PRACTICE_DEADLINE_MS = 4_000;

type AbortCause = "cancelled" | "deadline" | "deleted" | "expired" | "ended";

export class AssistanceAbortedError extends Error {
  constructor(readonly cause: AbortCause) {
    super("The assistance operation was interrupted.");
    this.name = "AssistanceAbortedError";
  }
}

export interface AssistanceOperation {
  readonly signal: AbortSignal;
  assertCurrent(): void;
  abort(cause: AbortCause): void;
  run<T>(work: () => T | PromiseLike<T>): Promise<T>;
  dispose(): void;
}

/** One deadline covers every collaborator and retry in this logical operation. */
export function createAssistanceOperation({
  requestSignal,
  deadlineMs,
  expiresAt,
  now,
}: {
  requestSignal: AbortSignal;
  deadlineMs: number;
  expiresAt: number;
  now: () => number;
}): AssistanceOperation {
  const controller = new AbortController();
  const deadlineAt = Date.now() + deadlineMs;
  const abort = (cause: AbortCause) => {
    if (!controller.signal.aborted) controller.abort(new AssistanceAbortedError(cause));
  };
  const cancel = () => abort("cancelled");
  requestSignal.addEventListener("abort", cancel, { once: true });
  if (requestSignal.aborted) cancel();
  const deadline = setTimeout(() => abort("deadline"), deadlineMs);
  const expiry = setTimeout(() => abort("expired"), Math.max(0, expiresAt - now()));
  const assertCurrent = () => {
    if (now() >= expiresAt) abort("expired");
    if (Date.now() >= deadlineAt) abort("deadline");
    controller.signal.throwIfAborted();
  };

  return {
    signal: controller.signal,
    abort,
    assertCurrent,
    run<T>(work: () => T | PromiseLike<T>): Promise<T> {
      assertCurrent();
      return new Promise<T>((resolve, reject) => {
        const cleanup = () => controller.signal.removeEventListener("abort", interrupted);
        const interrupted = () => {
          cleanup();
          reject(controller.signal.reason);
        };
        controller.signal.addEventListener("abort", interrupted, { once: true });
        // Always observe the original promise: ignored cancellation cannot create
        // an unhandled rejection or resume the caller after its wait has ended.
        Promise.resolve()
          .then(() => {
            assertCurrent();
            return work();
          })
          .then(
            (result) => {
              cleanup();
              try {
                assertCurrent();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            },
            (error: unknown) => {
              cleanup();
              reject(controller.signal.aborted ? controller.signal.reason : error);
            },
          );
      });
    },
    dispose() {
      clearTimeout(deadline);
      clearTimeout(expiry);
      requestSignal.removeEventListener("abort", cancel);
    },
  };
}
