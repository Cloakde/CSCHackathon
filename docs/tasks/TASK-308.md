# TASK-308 — Execute the remaining milestone implementation

**Assigned:** Codex, 2026-09-15, following the user's “Execute them all” on the five-step roadmap.
**State:** IN REVIEW. Implementation and offline checks complete; real-service, human and release acceptance remain pending. One AI, existing shared branch. No automatic main promotion or submission.

## Scope and sequencing

1. Recheck the exact source and acceptance gaps. Preserve prior review findings. Codex can perform author checks but cannot approve its own corrections; independent review remains a later sequential reviewer turn.
2. Complete Gemini-aware private review in the isolated MeltingPot copy, including truthful assistance labels on success/failure and confirmed destination handling.
3. Implement TASK-307's bounded live source/PCM bridge and its offline integration tests. Keep live mode unavailable in ordinary builds until the existing capture/provider and integrated human tests pass. Amend only the necessary controller/runtime/package/server seams, retaining the frozen transcript event schema.
4. Add the roadmap's bookmarks and source-linked structured notes; preserve grounded Ask/Catch Me Up and targeted practice. Reuse existing study components where suitable. No new database, class sharing, inherited production service or unrelated MeltingPot redesign.
5. Run applicable local, paired and CI checks. Prepare a reproducible extension package, source/version manifest, setup/rehearsal guide, submission draft and remaining acceptance checklist. No unverified demo recording, learner result, API quality result or release claim.

The user’s latest assignment supersedes the earlier implementation hold and copy-read-only scope. It does not turn unperformed acceptance tests into PASS. The original M1/M3/M4/M5/M6 evidence requirements remain visible in the final handoff; preparation and whole-milestone acceptance are distinct.

## Ownership

- LiveLecture: extension source/tests/build packaging; local session/API integration and its tests only as required by the live source; shared helper exports without changing frozen canonical transcript schemas; study UI and tests; scripts for offline checks, release packaging and bounded provider preparation; current task board, handoff, relevant ADRs and evidence.
- Isolated `MeltingPot-rework`: lecture UI/client/relay/contracts/tests and rework documentation; source-vendoring helpers only if required for canonical parity. Keep its existing local branch and push guard; no new remote.
- Original MeltingPot repositories, production accounts/services, inherited database/browser suites and unrelated pages are excluded.

## Verification and remaining decisions

Use fake transports/synthetic fixtures and credential-free check runners for development. Run LiveLecture's full checks, the guarded MeltingPot checks, paired journey, source-linked package checks and CI. Test delayed/error/cancel paths, citation/session identity, truthful source/provider labels and simulation preservation.

Before a real paid run, make the exact reviewed source, synthetic fixture, request/audio/dollar caps and cleanup procedure concrete. Browser/desktop control still requires permission for that session. Never expose permanent credentials or silently select live capture.

Keep unresolved independent review, live provider/Chrome checks, learner/content review, judge access, actual recording and final submission listed as pending. Calendar dates are not inferred from the plan's historical working-day ranges.
