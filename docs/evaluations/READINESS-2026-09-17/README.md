# Remaining readiness checkpoint — 2026-09-17

Two meaningful offline corrections are complete: [Scribe fixture/failure reporting](../SCRIBE-OFFLINE-2026-09-17/README.md) and [the Gemini last-attempt guard](../GEMINI-ALLOWANCE-2026-09-17/README.md). Each received a separate sequential review. The final implementation passed the full 585-test/build/package/HTTP check; [CI 35198034262](https://github.com/Cloakde/CSCHackathon/actions/runs/35198034262) passed on checkpoint `bb39713efc57522d444888315674a2328342f097`.

## Refreshed paired candidate

- LiveLecture: `bb39713efc57522d444888315674a2328342f097`, tree `fa1d7ba7e1a885ad2080c93f77762d22991523dd`.
- Isolated MeltingPot: unchanged, clean `24d83f9d2c2eb748b7ea2b48ef19fd82cb26d846`, tree `ea64b0052a3d72b2a87de28761ede61e2af450ba`, no remote.
- Both paired component journeys passed with fake providers. The production HTTP journey passed with actual local servers: both concepts/practice, evidence, repeated Finish, isolation/access guards and deletion. Its launcher stopped only its two owned servers; no listeners remained on 3000/3111. The inner check's “servers left running” line describes its own reuse policy; the outer launcher performed cleanup.
- Candidate: `release/bb39713efc57/`, containing the ordinary extension ZIP, both exact source ZIPs and SHA-256 manifest. Extension ZIP hash: `bec1fcc94319d2b669ed38a5811f5feb3fb45ea9b59761497915a86f2dffaa63`. Manifest hash: `05239928c202e92a4b8b2d595bc27efe3a9371da16f964423dfa13ac3dfa7159`.

This package defaults to prewritten Simulation Mode with live capture off. It has not been installed in Chrome or accepted by a learner in this session. No original repository/service, browser, account or provider was used. Later coordination-only commits do not change the packaged source pair.

## Fresh source-archive installation

Both exact source ZIPs were extracted into separate disposable folders and installed from their lockfiles, with empty project dependency/build folders, an empty user npm configuration and no inherited provider credentials. The normal package-manager cache was available; this was not a fresh operating-system installation. Original checkouts were not used as dependency sources.

The first deeply nested extraction failed when Vitest tried to load `#module-evaluator`. A standalone synthetic package reproduced the same error on this Windows host with Node 24.14.0: a `package.json` path of 259 characters worked, while 260 and 274 failed. The installed Vitest manifest already declared that import correctly. The failed extraction and logs remain preserved; dependency versions were not changed.

A fresh extraction into a shorter local path passed both locked installs, the LiveLecture production build and HTTP demo, and guarded MeltingPot lint/types, **383 tests in 27 files**, and production build. Both paired component journeys also passed with fake providers. The two fresh production servers then passed the paired HTTP journey: both concepts and distinct practice, evidence, repeated Finish, access guards, inherited-route rejection and deletion. The wrapper stopped its owned servers, and no listeners remained on 3000/3111. The [setup guide](../TASK-308/RELEASE.md) now gives short-path guidance and explicit local Git/push-guard initialization for source archives. These documentation improvements postdate the immutable candidate ZIPs above.

Local evidence is outside the repositories in the task workspace: `outputs/gemini-allowance-20260917/fresh-archive-1789633537511/` preserves the failed attempt; `outputs/gemini-allowance-20260917/path-probe-1789633866800/result.json` records the isolated path diagnosis; `pkg-1789633809182/result.json`, separate step logs and `paired-production.txt` record the successful install/checks. Disposable archive repositories have no original remotes; the rework push guard was restored. These checks used synthetic data and no browser or provider, and do not establish human installation or release acceptance.

Sequential independent review checked these logs, the setup instructions and the stopped-server state, with no actionable P1/P2 finding. Formatting and diff checks pass. The application code and locked dependency versions remain unchanged by this documentation checkpoint.

## Prepared next provider step — unapproved

The next Scribe proposal is **one** 30-second synthetic headless test, with a new allowance of at most $1, 90 seconds of transport time, two token issuances/two connections and one forced reconnect. It uses the paused fixture hash `0dd2604c156933444bf362c59d82d84096d58ea28ab6d13e244f46a65df4869f`. This is additional permission, not a reset or silent continuation of the spent earlier reservation.

The external `outputs/provider-session/scribe-paused-plan.json` binds the exact reviewed clean source/tree and prior reservation hashes. The accompanying runner requires an explicit new approval, reserves once exclusively before any provider launch, retains the reservation on failure, refuses replays and changed source/fixture/history, and saves only safe results. The existing credential helper's separately selected `ScribePaused` mode requires its new explicit approval switch before decrypting a key. Old Scribe/Gemini run paths and prior logs remain preserved. Six injected offline runner tests and PowerShell syntax parsing passed; no key was read. Sequential independent helper review found no P1/P2, repeated the six tests and checked the then-current `25f64a1` source binding. Renewed paid-test permission is pending. Recheck the final clean-source binding and matching CI after later documentation changes before any approved run.

The [current official API pricing page](https://elevenlabs.io/pricing/api) lists Scribe v2 Realtime at $0.39/hour; a 30-second audio calculation is about $0.00325 before account-specific details. The proposed $1 is a conservative authorization ceiling, not a measured charge or a changed account budget. No billing setting is changed, and actual account usage remains unmeasured.

The run must demonstrate genuine finalized timestamps before and after reconnecting. It does not replace Chrome capture, human review or retention acceptance. The earlier retention warning remains unresolved; use only the synthetic fixture. Stop on failure and diagnose it before proposing any retry. No Gemini request, model switch, account change, real lecture or automatic live activation is included.

## Still open

Normal-speed Chrome installation/callback, human content and uncoached learner checks, real Scribe finalization/recovery/retention, judge access, recording and accepted release/submission remain pending. Browser session permission and renewed paid-test permission are separate. Gemini's existing ledger remains 31 attempts with one unused slot; do not use it for a new half-operation, reset it or increase it silently.
