import { execFileSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { openTrialLedger } from "../ai-evaluation/trial/budget";
import { TRIAL_PLAN_ID, TRIAL_POLICY_HASH } from "../ai-evaluation/trial/policy";
import type { TrialLedger, TrialMeter } from "../ai-evaluation/trial/types";

export type ApplicationEnvironment = Readonly<Record<string, string | undefined>>;

export function applicationExecutionSelected(environment: ApplicationEnvironment): boolean {
  return (
    !environment.CI &&
    ["approved-one-dollar-v1", "approved-browser-continuation-v1"].includes(
      environment.LIVELECTURE_APP_EXECUTE ?? "",
    )
  );
}

export interface ApplicationRepository {
  sourceTree: string;
  dirty: boolean;
  commonDir: string;
}

export function readApplicationRepository(): ApplicationRepository {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  return {
    sourceTree: git("rev-parse", "HEAD^{tree}"),
    dirty: git("status", "--porcelain") !== "",
    commonDir: git("rev-parse", "--path-format=absolute", "--git-common-dir"),
  };
}

/** Pure checks first: selecting Gemini or possessing a key never grants a spending allowance. */
export function applicationAuthorization(
  environment: ApplicationEnvironment,
  repository: ApplicationRepository,
) {
  const continuation = environment.LIVELECTURE_APP_EXECUTE === "approved-browser-continuation-v1";
  const continuationId = environment.LIVELECTURE_APP_CONTINUATION_ID ?? "";
  const continuationHash = environment.LIVELECTURE_APP_CONTINUATION_HASH ?? "";
  if (
    environment.CI ||
    (continuation
      ? !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(continuationId) ||
        !/^[a-f0-9]{64}$/.test(continuationHash)
      : environment.LIVELECTURE_APP_EXECUTE !== "approved-one-dollar-v1" ||
        Boolean(continuationId || continuationHash)) ||
    environment.LIVELECTURE_APP_POLICY !== TRIAL_POLICY_HASH ||
    !/^[a-f0-9]{40}$/.test(environment.LIVELECTURE_APP_TREE ?? "") ||
    environment.LIVELECTURE_APP_TREE !== repository.sourceTree ||
    repository.dirty ||
    !isAbsolute(repository.commonDir)
  )
    throw new Error("Gemini application execution is not authorized.");
  return {
    sourceTree: repository.sourceTree,
    policyHash: TRIAL_POLICY_HASH,
    directory: join(repository.commonDir, "livelecture-ai-trial", TRIAL_PLAN_ID),
    ...(continuation
      ? { applicationContinuation: { id: continuationId, grantSha256: continuationHash } }
      : {}),
  };
}

/** Shares the existing durable allowance, including across restarts and other processes. */
export function createApplicationMeter(
  environment: () => ApplicationEnvironment,
  repository: () => ApplicationRepository,
): TrialMeter & { close(): void } {
  let active: TrialLedger | undefined;
  let closed = false;
  return {
    reserve(input) {
      if (closed || active) throw new Error("The application allowance is unavailable.");
      const approved = applicationAuthorization(environment(), repository());
      const ledger = openTrialLedger(approved);
      try {
        if (input.kind === "help_generate" || input.kind === "practice_generate") {
          // App answers require a separate verifier. Check under the ledger lock
          // before spending a slot that cannot possibly complete that pair.
          const snapshot = ledger.snapshot();
          if (snapshot.maxAttempts - snapshot.attempts.length < 2)
            throw new Error("Too few attempts remain to generate and verify an answer.");
        }
        const id = ledger.reserve(input);
        active = ledger;
        return id;
      } catch (error) {
        ledger.close();
        throw error;
      }
    },
    settle(id, usage) {
      if (!active || closed) throw new Error("No owned allowance reservation.");
      const ledger = active;
      try {
        ledger.settle(id, usage);
      } finally {
        active = undefined;
        ledger.close();
      }
    },
    close() {
      closed = true;
      const ledger = active;
      active = undefined;
      // Unknown in-flight usage retains its full reservation.
      ledger?.close();
    },
  };
}
