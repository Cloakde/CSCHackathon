# TASK-306 — Offline Gemini application connection

- **Current correction:** User assigned Codex to fix the five independently reproduced defects at `d659ebb` on 2026-09-07. Correction scope includes shared spending/run guards, separate Ask/recap verification and safe rejection, exact recent-window evidence, consistent message limits, truthful extension/companion status and regression tests. The original Gemini submission is CHANGES REQUESTED; its evidence below is historical. No API traffic or MeltingPot-copy changes are authorized.
- **Correction result:** application commit `9d7112591e1cad0608780cf775f5d3264e29ef50`, implemented by Codex and IN REVIEW. Full local checks passed 380 tests, builds, extension packaging and production HTTP; guarded MeltingPot component test passed separately. See [current evidence and the temporary Gemini companion boundary](../evaluations/TASK-306/README.md). Independent review and real-provider/human acceptance remain pending.

- **Tier:** 1
- **State:** IN REVIEW — Gemini Lead implementation complete; fully verified with offline fake transports and full quality gates; ready for Codex review.
- **Implementer:** Gemini Lead, 2026-09-07
- **Senior lead:** Codex
- **Branch/folder:** `shared/livelecture` in `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon`
- **Starting commit:** `4a4f52f6295851d58be1dcce5f878606a3002bcd`

## Scope and Intent

Connect the actual LiveLecture AI application to Google Gemini (`gemini-2.5-flash-lite`), supporting four server-side features:

1. “I’m Lost” explanation generation and independent verification
2. Targeted practice generation and independent verification tied to saved confusion moments
3. “Ask the Lecture” contextual Q&A grounded in active committed lecture chunks
4. “Catch Me Up” recent lecture recap grounded in active committed lecture chunks

Keep provider use **disabled by default**. Normal launches, builds, tests, and Simulation Mode make zero provider requests. Having `GEMINI_API_KEY` present must not enable provider traffic automatically; an explicit provider selector (`LIVELECTURE_ASSISTANCE_PROVIDER="gemini"`) is required.

All testing is strictly offline using injected fake network transports and deterministic test cases. No real API calls, live network requests, token counting, model-list probes, credential searches, or spending are permitted.

## Owned Paths

- `web/src/server/assistance/gemini-app-assistance.ts`: Core Gemini application assistance adapter (schemas, prompts, request building, response parsing, and independent verification for help, practice, ask, and catch_up).
- `web/src/server/assistance/gemini-app-assistance.test.ts`: Offline unit and integration tests for the Gemini application adapter with injected fake transports.
- `web/src/server/demo-api.ts`: Dispatcher options for `handleLectureTool`, provider hook wiring in `createDemoDispatcher`, and gated activation in `handleDemoRequest`.
- `web/src/server/demo-api.test.ts`: Real application request path tests verifying help, practice, ask, and catch_up through the dispatcher with injected fake transports, testing disabled-by-default behavior, grounding failures, cancellation, and stale responses.
- `shared/src/lecture-tools.ts`: Add `"gemini"` to `LectureToolResponseSchema` mode enum (`"prewritten" | "gemini"`), and add grounded response validation for Gemini tool responses.
- `shared/test/lecture-tools.test.ts`: Schema and validation tests for both prewritten and Gemini lecture tool responses.
- `extension/src/LectureTools.tsx`: Truthful UI labels reflecting mode (`response.mode === "gemini"` vs `"prewritten"`), keeping prewritten label and "Gemini is not connected" when disabled.
- `docs/tasks/TASK-306.md`: This task contract.
- `docs/HANDOFF.md`: Active turn recording, evidence, and next steps.
- `docs/TASK_BOARD.md`: Task tracker updates.

## Boundaries and Safeguards

1. **Explicit opt-in required:** In default configuration, all assistance remains prewritten. No provider calls occur without both `LIVELECTURE_ASSISTANCE_PROVIDER="gemini"` and valid `GEMINI_API_KEY`.
2. **Untrusted data boundary:** All lecture transcript text, user questions, and model outputs are treated as untrusted data.
3. **Citations strictly grounded:** Citations must reference actual committed transcript chunks from the current session snapshot with matching chunk IDs, offsets, and text. Invented chunk IDs, timestamps, or out-of-snapshot passages are rejected.
4. **Independent verification:** Help generation is verified by independent `help_verify` claims checking; practice generation is verified by independent `practice_verify` checks.
5. **No credential exposure:** Server-only credentials; keys never enter URLs, logs, client bundles, error responses, or git commits.
6. **No state regression:** Existing trial ledgers, frozen benchmark cases, and historical evaluations remain intact and unchanged.
7. **Read-only external copies:** `MeltingPot-rework` remains read-only. Original MeltingPot repositories/services are not touched.
8. **Truthful UI:** Distinguish prewritten sample mode from Gemini assistance. Do not claim Gemini is connected when it is not, and never silently mask a failed Gemini call with prewritten output labeled as Gemini.

## Verification Gates

1. Unit tests for `gemini-app-assistance` with injected fake fetcher covering:
   - Help generation and verification (supported and unsupported cases)
   - Practice generation and verification (linked to confusion event)
   - Ask the Lecture grounded answers and out-of-scope/insufficient-evidence handling
   - Catch Me Up recap with timestamped citations
   - Cancellation and timeout handling
   - Malformed/refused/oversized responses and credential echo rejection
2. Real application request path tests through `createDemoDispatcher` / `handleDemoRequest` with injected fake network transport.
3. Disabled-by-default tests confirming zero network calls when `GEMINI_API_KEY` is present but `LIVELECTURE_ASSISTANCE_PROVIDER` is not set to `"gemini"`.
4. Full monorepo check: `npm run check` (format, lint, secret scan, typecheck, tests, builds, demo verification).
5. Guarded MeltingPot component test: `npm run test:meltingpot -- --meltingpot-root=...`.

## Evidence

1. **Unit tests (`gemini-app-assistance.test.ts`):** 10/10 tests passed covering Help, Practice, Ask, Catch Me Up, credential echo rejection, nonexistent chunk rejection, invalid key rejection, and abort handling.
2. **Real request path tests (`demo-api.test.ts`):** 57/57 tests passed including disabled-by-default verification (zero fetch calls when `LIVELECTURE_ASSISTANCE_PROVIDER` unset), full Gemini routing (help, practice, ask, catch_up), and cancellation on session DELETE.
3. **Full workspace test suites:**
   - Shared: 6/6 test files, 63/63 tests passed.
   - Web: 16/16 test files, 231/231 tests passed.
   - Extension: 6/6 test files, 49/49 tests passed.
   - Root node tests: 7/7 tests passed.
4. **Monorepo quality check (`npm run check`):** All stages passed cleanly:
   - `format:check`: Prettier check clean.
   - `lint`: ESLint passed with 0 errors and 0 warnings.
   - `secret:scan`: Passed (0 credentials found).
   - `typecheck`: Passed across `@livelecture/shared`, `@livelecture/web`, and `@livelecture/extension`.
   - `test`: All unit, component, and integration suites passed.
   - `build`: Production builds passed (`shared`, Next.js 16 app with Turbopack, extension Vite build, and `verify:extension-package`).
   - `verify:demo`: Production HTTP demo passed (Ask, recent excerpts, both concepts, practice, deletion, and access guards).
5. **MeltingPot component verification:** `npm run test:meltingpot -- --meltingpot-root=...` passed cleanly (1/1 test passed). No external repositories or services modified. Zero provider calls made ($0 spend).
