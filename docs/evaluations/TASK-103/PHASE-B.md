# TASK-103 Phase B trial runbook

**Gemini runbook, IN REVIEW.** Claude implemented this under [TASK-103C](../../tasks/TASK-103C.md) on 2026-09-06, replacing the earlier prepared-but-never-executed OpenAI trial (kept below as history). No independent review, credentials or spending approval have been recorded yet. **No real-model run is authorized.**

The trial connection is prepared for independent review and integration. **No real-model run, spending approval or human acceptance is recorded.** The normal extension and companion continue using clearly labelled prewritten help and practice. This trial does not enable live audio or change the transcription provider.

## What the trial measures

Run the four frozen synthetic cases from [the evaluation record](README.md), then two actual extension-component/client/dispatcher probes during unchanged 1× transcript playback. The latter take roughly nine minutes together. Each requests Help just before a new passage arrives, checks whether ingestion really overlaps a pending provider call, and follows the resulting confusion through Finish to targeted practice. A missed overlap is a finding, not a passing measurement. No Chrome or desktop control is involved.

Generation and verification use four separate prompts/calls: Help generation, Help verification, practice generation and practice verification. They use the same pinned model, so separate verification does not establish independent-model agreement. Expected answers and evidence checks remain outside provider prompts and appear separately in the report for review.

Keep the existing total deadlines: ten seconds for Help, including verification and any stale-snapshot retry, and four seconds for practice. The paid path uses actual wall-clock time without an injected provider delay. Offline regressions inject time and explicitly label those results; they do not establish real-model speed or quality.

## Fixed proposal and data scope

- Provider/model: Google Gemini API, `gemini-2.5-flash-lite`, via `generateContent` (direct Gemini API, `v1beta`; not Vertex AI, not the newer Interactions API — see [ADR 0012](../../adr/0012-gemini-assistance-direction.md) for why).
- Proposed allowance: **$1 total**, at most **32 attempts**, one active client request at a time. No spending approval has been recorded.
- Each response permits at most 2,048 output tokens; serialized request/response limits are 32/128 KiB.
- Before sending, reserve 105,677 microdollars using the model's full documented context (1,048,576 input tokens) and the configured maximum output (2,048 tokens). Reconcile only validated usage at paid-tier text prices. Unknown failures retain the full reservation, so the trial may stop before all cases finish. At this per-attempt reservation, roughly 9 full-context reservations fit under the $1 cap before `BUDGET_EXHAUSTED`; actual settled charges on these short synthetic prompts should be far smaller in practice.
- The fixed ledger is shared across Git worktrees, survives restarts and seals after a completed trial. Do not delete it, remove stale locks automatically, or start a replacement allowance to bypass the cap. A stale lock or malformed record needs review. This trial uses a new plan ID (`TASK-103C-gemini-synthetic-model-trial-v1`) because its endpoint, model and pricing are entirely different from the prior OpenAI proposal — no ledger directory existed under either plan ID before this implementation, so nothing is being reset; see the implementation record in [TASK-103C](../../tasks/TASK-103C.md).
- Only the committed synthetic calculus transcript and generated synthetic responses are sent. No classroom audio, recordings, student data or MeltingPot accounts are involved.

The model's paid-tier text pricing is $0.10/M input and $0.40/M output tokens in the checked official documentation. Requests use `store:false`, `application/json` structured output via `responseJsonSchema`, thinking left off (this model's documented default), no explicit `cachedContent`, and no tools or automatic network/repair retries. Implicit cache counts are validated within the full prompt and charged conservatively at the uncached rate; nonzero thinking/tool-use counts retain the full reservation. The corrected policy hash uses the existing plan/ledger ID: an older ledger must stop on policy mismatch, never be deleted to reset the allowance. See [the offline correction review](../../GEMINI_OFFLINE_REVIEW.md). Paid-tier API content is not used to improve or train Google's products, but Google still logs prompts and responses for a limited, undisclosed period for Prohibited-Use-Policy abuse monitoring, regardless of tier. This is not a zero-retention claim. Local cancellation does not prove provider billing stopped. [Model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [terms](https://ai.google.dev/gemini-api/terms), checked 2026-09-06. Exact settings and the reservation calculation are frozen in [TASK-103C](../../tasks/TASK-103C.md) and [ADR 0012](../../adr/0012-gemini-assistance-direction.md).

## Offline commands

```text
npm run ai:trial
npm run test
npm run test:meltingpot -- --meltingpot-root=PATH_TO_ISOLATED_MELTINGPOT_COPY
```

The first command only prints the plan (now the Gemini plan). Ordinary test discovery excludes `actual.run.tsx`; provider tests inject their transport. Full `npm run check` includes builds and production HTTP verification and requires port 3000 to be free. Preserve any existing local preview and use CI if that port is occupied. The MeltingPot component check is separate and uses no network; a fresh paired production HTTP run remains pending until both intended revisions are deliberately served.

## Authorized execution only

First obtain the user's explicit approval of this model, synthetic-data scope and $1 total ceiling after exact independent review and green CI. Configure `GEMINI_API_KEY` only in the local server process. Never paste a key into a conversation, write it into the command arguments, commit it, or put it in the extension. The launcher does not read environment files and refuses CI, dirty source, mismatched source identity or missing credentials.

From the clean, reviewed checkout, record the exact commit and `git rev-parse 'HEAD^{tree}'`. Supply that reviewed tree value explicitly:

```text
npm run ai:trial -- --execute --approve-usd=1 --source-tree=REVIEWED_40_CHARACTER_TREE_HASH
```

This command is documentation, not authorization to run it. Do not replace the placeholder with an unreviewed tree just to satisfy the guard. No additional provider/account budget is created by the launcher. It does not switch, start or stop the existing app previews.

## Evidence and interpretation

The ledger and local `report.json` live under the Git common directory in `livelecture-ai-trial/TASK-103C-gemini-synthetic-model-trial-v1`. The report records source commit/tree, fixture and prompt hashes, model/settings identity, attempt timing/usage/cost, returned explanations/practice, overlap observations and findings. Key values are redacted; raw provider error bodies are excluded.

Each invocation also saves immutable `report-INVOCATION-SEQUENCE.json` checkpoints before and after attempts and after cases; `report.json` is only the latest convenience copy. Earlier invocation outputs and timing stay in their checkpoints. After an interruption, an explicitly resumed invocation reruns the frozen cases using the same remaining allowance, records the previous attempt count, and labels its timings separately from historical ledger attempts. It does not claim that interrupted measurements completed. Final accounting is closed conservatively before the final snapshot; a pre-seal checkpoint preserves observations if the final write fails. Preserve every checkpoint and the journal when any recording or accounting error occurs.

`OBSERVED_FOR_REVIEW` means the planned observations completed. It never means mathematical correctness, learner acceptance, Chrome behavior or judge readiness passed. Human content review remains `HUMAN_REVIEW_PENDING`, and this small trial cannot establish latency reliability. Review each explanation, cited support, question, answer and explanation for relevance and correctness before considering product activation. If the trial fails, preserve its report and accounting, fix the cause under a reviewed task, and obtain any necessary new trial authorization.

---

## Historical: the prior OpenAI proposal (superseded, never executed)

The Product Owner selected Gemini on 2026-09-06 after learning this trial had been prepared against OpenAI; that proposal was never approved, funded or executed — $0 was ever spent. It is kept here only as a record of the earlier preparation.

- Provider/model: OpenAI Responses, `gpt-4.1-mini-2025-04-14`, endpoint `https://api.openai.com/v1/responses`.
- Pricing: $0.40/M input and $1.60/M output tokens, 1,047,576-token documented context.
- Reservation: 422,308 microdollars per attempt (`ceil((1,047,576 × 2 + 2,048 × 8) / 5)`).
- Requests used `store:false`, `background:false`, the default service tier, in-memory prompt-cache retention, disabled truncation, `text.format.json_schema` with `strict:true`, and no tools or automatic retries.
- [Model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [data controls](https://developers.openai.com/api/docs/guides/your-data), checked 2026-09-04 PDT / 2026-09-05 UTC.
- Exact settings and ownership were frozen in [TASK-103B](../../tasks/TASK-103B.md); the combined engineering record (303 ordinary tests, types/lint/format/secret checks, all builds, extension package verification) is at candidate `284d56a92fec20c024ff27eddcc6bab4b5a86acf`. No actual-model call was ever made against this configuration.
