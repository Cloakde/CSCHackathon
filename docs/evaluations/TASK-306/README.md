# TASK-306 correction and review evidence

The user requested the five fixes after Codex independently reviewed Gemini's `d659ebbaa4a4e1dbf9bfe79f11ef692ffda63d8d`. The original submission is CHANGES REQUESTED. Codex's correction requires another AI's independent review; nothing here approves the correction or earlier Codex work for main.

## Changes

1. **Shared spending controls:** Application calls now use the same metered Gemini transport and durable ledger as the bounded trial. Every generation and verification reserves before sending, settles validated usage, and retains the full reservation for unknown or interrupted usage. The fixed plan/directory, policy identity, dollar ceiling and attempt ceiling are unchanged. Locks prevent concurrent runtimes spending against the same reservation; restarts do not reset the allowance. Source changes, dirty source, CI, missing approval and mismatched policy stop provider use.
2. **Answer verification:** Ask and Catch Me Up receive a separate claim/evidence review. Valid citation IDs alone no longer release an answer. Invalid or refused candidates are discarded; unsupported answers become a fixed safe response. Malformed verifier responses and transport/budget failures return a clear failure. One deadline covers both generation and verification, including signal-ignoring late replies.
3. **Exact recap evidence:** Server and client share the validated synthetic snapshot/window selector. Recaps can cite only passages overlapping the requested final two minutes; Ask retains the committed prefix. Unknown, altered, duplicate, future and cross-session evidence is rejected.
4. **Consistent length:** Gemini's requested JSON Schema, parsed result and shared response use the same 2,000-character bound. Accepted answers are not truncated. Oversized results fail safely.
5. **Truthful state:** Response headers carry prewritten, selected-but-unverified, verified, failed or blocked assistance status to the extension and LiveLecture companion. Missing metadata remains unknown. Selection/key presence does not claim a working connection. Failed requests clear generated results. Live-audio health reporting is separate from text assistance.

Normal `dev:demo` and `start:demo` launches explicitly clear inherited provider activation. Merely setting a key or selector cannot enable the app provider. The old duplicate unmetered transport and arbitrary endpoint/model override were removed; the frozen evaluation prompts, questions, answers and ledger contents were not edited.

## MeltingPot boundary

The isolated `MeltingPot-rework` source still labels all help/practice prewritten. Its source remains read-only, as do the original repositories. Prewritten extension sessions continue opening the existing private MeltingPot review. Gemini-mode sessions deliberately open the corrected LiveLecture companion, with a truthful link and explanation, until a separately scoped copy update supports assistance-mode metadata. This is a bounded compatibility fallback, not completion of Gemini-to-MeltingPot acceptance or a change to the long-term extension-during-class/MeltingPot-afterward direction. Do not copy an older preparation project over current source.

## Offline regressions

- `web/src/server/assistance/gemini-app-regressions.test.ts` exercises actual production activation/routing with a fake network and isolated durable ledgers: missing authorization, changed/dirty source, CI, budget and attempt exhaustion, restart, competing runtimes, cancellation, total deadlines, Help → confusion → independently verified practice, unsupported claims, invalid/old citations, refusals and message-length boundaries.
- Existing transport tests cover reserved/settled accounting, corrupt replies, credential echo, redacted errors, cancellation and late response bodies. The application uses that exact transport now.
- Shared tests cover recent-window/client validation and fixed fallback content.
- Component tests cover unknown/prewritten/selected/blocked/verified/failed labels, the real client/header path and the Gemini companion boundary.
- Launcher tests cover default-off behavior despite inherited settings and the explicit clean-source/cap requirements.

Application correction: `9d7112591e1cad0608780cf775f5d3264e29ef50`.

- **Full `npm run check`: PASS.** Formatting, lint, secret scanning, all workspace type checks, 380 tests (9 root, 64 shared, 258 web, 49 extension), production builds, packaged-extension verification and the actual production HTTP demo all passed.
- **Guarded MeltingPot component journey: PASS, 1 test.** It exercises the actual extension, local lecture API, MeltingPot relay and private review for two confusing concepts. The copy remains clean at `9244a641e0639982d4eece09b2274a05ee355096`.
- **CI:** inspect [PR #5 checks](https://github.com/Cloakde/CSCHackathon/pull/5/checks) for the final shared head, including the full-history secret scan. A local pass is not a substitute for that exact-head check or independent review.
- **Provider/human limits:** no real Gemini or ElevenLabs requests, credential inspection, API spending, desktop/browser control or human acceptance testing. All provider-shaped responses in these tests are fabricated test data. No original MeltingPot source, copy source, frozen benchmark answers, allowance ledger, main branch or deployment was changed.

## Future authorized run — prepared, not authorized or executed

After independent review, explicit user permission for the synthetic data/paid-provider test, and agreement on the existing capped allowance, the reviewed clean source can be launched with `npm run dev:demo -- --gemini --approve-usd=1 --source-tree=EXACT_REVIEWED_TREE`. Production adds `--production` and requires a fresh build of that same reviewed source. The key belongs only in that server process. No actual key value belongs in documentation, URLs or the extension.

The launcher derives the ledger directory from Git's common directory; there is no alternate-ledger option. It prepares app-specific execution/tree/policy fields, and the server rechecks authorization and clean source before every reservation. Existing source/policy mismatches, exhausted/finished allowances or orphaned locks are blockers for explicit review, never reasons to delete, rename or recreate the ledger. Restart the server after changing credentials. Running this command has not been approved; the current authorization remains $0 and no API testing.
