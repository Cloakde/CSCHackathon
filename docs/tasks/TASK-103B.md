# TASK-103 Phase B — A capped real-model trial

**Tier:** 1

**State:** Contract IN REVIEW; no provider calls authorized yet

**Base:** `0b80cb902c9db3edec3fb1266fa440e3d0e70e84` (clean local/remote main verified)

**Coordinator:** Codex Coordinator

**Independent reviewer/integrator:** `m3_review`, no implementation ownership

## Scope and authorization

The Product Owner's subsequent **Execute** authorizes building, reviewing and verifying the next real-AI trial connection. Finish that concrete runnable work before requesting the separate spending approval. This is a narrow continuation of TASK-103; it does not activate M4, change the live transcription provider or waive pending human acceptance. No provider request, credential use or cost occurs until the user approves the concrete cap below. Never infer permission from the older $2 draft.

Build an isolated CLI trial using the actual existing dispatcher and extension component, with four separate provider hooks. Normal runtime remains the labelled prewritten demo. Do not alter dispatcher behavior, schemas, fixtures, client/UI, MeltingPot, running services, dependencies, capture, deployment or laptop controls. No audio or real student data is used.

## Proposed provider and limits

Use only `gpt-4.1-mini-2025-04-14` through foreground `POST https://api.openai.com/v1/responses`. Current official pricing is $0.40/M input and $1.60/M output tokens, with a 1,047,576-token context window. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini), checked 2026-09-04 PDT / 2026-09-05 UTC. Its dated snapshot, non-reasoning behavior and simple accounting make it a bounded trial choice; quality and latency are unmeasured.

Propose **$1 total**, at most **32 HTTP attempts**, one active client request at a time, 2,048 maximum output tokens, 32 KiB maximum serialized request body, and 128 KiB maximum response body. The documented context limit bounds the conservative input reservation; body bytes are not misrepresented as exact token counts. Reserve **422,308 microdollars** before each attempt, rounded up from `(1,047,576 × 0.40 + 2,048 × 1.60)` microdollars. Reconcile only independently validated provider usage, charging all input at the uncached rate. Failed requests without trustworthy usage keep their full reservation. Unknown cancellation never means free service.

Use `store:false`, `background:false`, `service_tier:"default"`, `prompt_cache_retention:"in_memory"`, `truncation:"disabled"`, no tools, streaming, conversations, previous responses, alternate endpoints or automatic network/JSON-repair retries. Strict JSON output is wrapped in an object because root unions are unsupported; local runtime validation remains required. [Responses reference](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

API content is not used for training by default. `store:false` does not establish zero retention: abuse-monitoring logs may retain content for up to 30 days with stated exceptions, and temporary prompt-cache state may remain. No zero-retention account approval is assumed. Only synthetic text enters this trial. [Data controls](https://developers.openai.com/api/docs/guides/your-data).

Existing total operation bounds remain **10 seconds for Help**, including verification and one stale retry, and **4 seconds for practice**, including verification. If real calls miss these budgets, record the finding; do not silently raise them. Local connection cancellation cannot prove provider computation or billing stopped.

## Frozen private seams

The budget lane exports from `web/src/server/ai-evaluation/trial/types.ts`:

```typescript
type TrialCallKind = "help_generate" | "help_verify" | "practice_generate" | "practice_verify";
interface TrialAttemptInput {
  kind: TrialCallKind;
  scenarioId: string;
  requestSha256: string;
  requestBytes: number;
}
interface TrialUsage {
  inputTokens: number;
  outputTokens: number;
  reportedModel: string;
  requestId?: string;
  responseId?: string;
}
interface TrialMeter {
  reserve(input: TrialAttemptInput): number;
  settle(attemptId: number, usage?: TrialUsage): void;
}
```

`policy.ts` exports fixed `TRIAL_PLAN_ID`, `TRIAL_MODEL`, `TRIAL_ENDPOINT`, `TRIAL_CAP_MICRO_USD`, `TRIAL_MAX_ATTEMPTS`, `TRIAL_RESERVE_MICRO_USD`, `TRIAL_MAX_INPUT_TOKENS`, `TRIAL_MAX_OUTPUT_TOKENS`, `TRIAL_MAX_REQUEST_BYTES`, `TRIAL_MAX_RESPONSE_BYTES`, `TRIAL_POLICY_HASH`. The hash covers pricing and fixed settings. No request can override these values.

`budget.ts` exports `openTrialLedger({directory, sourceTree, policyHash})`. It exclusively locks that directory, persists and fsyncs reservations before sending, preserves accounting across restarts, and rejects malformed or mismatched source/policy ledgers. The returned object implements TrialMeter and adds `snapshot()` (serializable state including attempts, known usage, reserved/charged total and finished state), `finish()` (persist one completed trial; repeat execution then refused), and `close()` (release its own lock). Do not automatically remove stale locks or reset a used allowance. An interrupted invocation can resume the same remaining allowance; uncertain attempts remain charged conservatively.

The adapter exports `createProviderTrialHooks({apiKey, meter, scenarioId, fetcher?})` from `web/src/server/assistance/provider-trial/index.ts`, returning the four required `DemoDispatcherOptions` hooks. `fetcher` is solely the injected offline-test seam; normal trial uses global fetch. It imports the fixed policy/types above, forwards signals, bounds the entire response read, rejects redirects/refusals/incomplete or malformed outputs, and settles each reservation exactly once. Late results cannot refund uncertain charges after interruption. API key values never enter URLs, prompts, logs, reports or thrown errors.

Prompts, JSON schemas and prompt-version hashes live in the adapter subtree. Generators must not import evaluation expectations. Use only the canonical snapshot, selected confusion and source evidence plus generic instructions and a declared three-concept benchmark taxonomy (inner/outer, inner derivative, sine composition). Verifiers use separate calls/prompts, candidate and cited passages, and explicitly check every required claim. They do not trust generator confidence or see expected answers. The same pinned model may implement both roles; this is a separate verification call, not independent-model diversity.

For practice, the benchmark may specify the question being tested—composition/missing factor for `(2x+3)⁴`, and the inside derivative in `sin(x²)`—but never the expected answer or explanation. Record these prompts before any calls. Do not silently change model concept IDs, answers or evidence to fit the oracle.

## Exclusive ownership

Each implementation worktree starts at the independently approved contract revision. Only reviewed owned commits are integrated.

- **`m2_contract_review`**, backend implementing engineer: new `web/src/server/assistance/provider-trial/**` only. Four hooks, prompts, response schemas/transport and fully offline tests. No dispatcher/shared/client files.
- **`m3_extension`**, budget engineer for this phase: new `web/src/server/ai-evaluation/trial/{types.ts,policy.ts,budget.ts,budget.test.ts}` only. The private seam must land before adapter integration. No other evaluation files.
- **Coordinator**, `coord/TASK-103-ai-trial`: this contract; new ADR 0010; task board/README and Phase B evaluation documentation; `package.json` for `ai:trial` and inclusion of the new offline CLI guard test in `test`; `scripts/ai-trial.mjs`, its `.test.mjs`, `scripts/ai-trial-vitest.config.ts`; new `web/src/server/ai-evaluation/trial/{scenarios.ts,scenarios.test.ts,actual.run.tsx,report.ts,report.test.ts}`. No edits to frozen Phase A cases or tests.
- **`m3_review`**, read-only exact contract/source review and final independent promotion after green CI. No authored implementation.

## Runner and evidence

The CLI defaults to an offline plan/help. Execution requires explicit cap acknowledgement, an exact clean source-tree hash and a server-process `OPENAI_API_KEY`. It rejects CI execution. Neither ordinary test discovery nor demo launch may invoke the provider. The explicit trial uses a separate Vitest configuration and an `actual.run.tsx` file outside default test naming. Ordinary tests cover helpers and guard behavior with injected transports only.

The one durable approval ledger lives under the Git common directory, shared across task worktrees, under this fixed plan ID. A different cwd must not silently reset the cap. The CLI never creates a new allowance ID on restart. Existing environment files are not loaded. No key setup or key value is committed.

Run the four unchanged frozen cases through the actual dispatcher. Add actual extension/client/dispatcher checks at real-clock **1×** playback, requesting Help just before passage 004 or 007 arrives. Record whether a committed passage is truly accepted while a provider call is pending; a missed overlap is a failed measurement, not permission to inject a hidden provider delay or report success. Playback may take several real minutes. Time the complete button-to-usable-result and practice paths and each attempt, including any stale retry. Finish and source identity/citation linkage still apply. No browser or desktop surface is controlled.

The report records source tree/commit, fixture and prompt hashes, requested/reported model, request IDs, attempt kind/case/usage/cost, full response timings, observed ingestion overlap, returned synthetic explanations/practice, and failures without secrets or raw provider error bodies. Expected answers remain separate review material. Structural checks and model-verifier outcomes cannot automatically mark mathematical/human quality PASS. Flag `HUMAN_REVIEW_PENDING` and unmeasured browser/judge acceptance. No latency percentile claim from this small trial.

## Completion and approval

Before requesting paid-run authorization, finish the runnable adapter, persistent cap, runner, offline checks, exact independent review and full CI, and present the concrete model, $1 total cap and synthetic-data scope. Root cannot merge its own work. The original previews on 3000/3111, all original MeltingPot repositories, and all current dirty/unowned work remain preserved. If approval or credentials are absent, record the precise remaining step without claiming real AI evidence.
