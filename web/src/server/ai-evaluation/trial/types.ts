export type TrialCallKind =
  "help_generate" | "help_verify" | "practice_generate" | "practice_verify";

export interface TrialAttemptInput {
  kind: TrialCallKind;
  scenarioId: string;
  requestSha256: string;
  requestBytes: number;
}

export interface TrialUsage {
  inputTokens: number;
  outputTokens: number;
  reportedModel: string;
  requestId?: string;
  responseId?: string;
}

export interface TrialMeter {
  reserve(input: TrialAttemptInput): number;
  settle(attemptId: number, usage?: TrialUsage): void;
}

export interface TrialAttemptSnapshot extends TrialAttemptInput {
  attemptId: number;
  status: "reserved" | "settled" | "uncertain";
  reservedMicroUsd: number;
  chargedMicroUsd: number;
  usage?: TrialUsage;
}

export interface TrialLedgerSnapshot {
  version: 1;
  planId: string;
  sourceTree: string;
  policyHash: string;
  capMicroUsd: number;
  maxAttempts: number;
  finished: boolean;
  reservedMicroUsd: number;
  chargedMicroUsd: number;
  totalMicroUsd: number;
  attempts: TrialAttemptSnapshot[];
}

export interface TrialLedger extends TrialMeter {
  snapshot(): TrialLedgerSnapshot;
  finish(): void;
  close(): void;
}
