import { execFileSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { openTrialLedger } from "../ai-evaluation/trial/budget";
import { TRIAL_PLAN_ID, TRIAL_POLICY_HASH } from "../ai-evaluation/trial/policy";
import type { TrialLedger, TrialMeter } from "../ai-evaluation/trial/types";

export type ApplicationEnvironment = Readonly<Record<string, string | undefined>>;

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
  if (
    environment.CI ||
    environment.LIVELECTURE_APP_EXECUTE !== "approved-one-dollar-v1" ||
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
