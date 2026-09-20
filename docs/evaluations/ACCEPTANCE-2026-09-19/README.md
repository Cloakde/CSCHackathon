# Fresh candidate rehearsal — September 19, 2026

**PASS for fresh installation, checks and the paired production HTTP journey.** This verifies the current packaged source pair in new short-path folders. It does not establish Chrome installation, live capture, provider-account retention, human usefulness or final release approval. The run took place on September 19 Pacific / September 20 UTC.

## Exact delivered source

| Item                              | Identity                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Candidate                         | `release/c97792142b8b/`                                                                 |
| LiveLecture commit / tree         | `c97792142b8b3bf2401faa623b9feeb8cd59bf31` / `38b9d407c7c92965f93786e6f43942c9c6408dea` |
| Isolated MeltingPot commit / tree | `d03f99b14895c392355bcfa3c0c2985ad7073d31` / `c96e837423fa3e5b01c228a3cfb45edd6e34b153` |
| Package manifest SHA-256          | `ae3eb724ac823bfbdc91a8811c1f214044ab87f1e38af16be971ab51c7fff70d`                      |

All four packaged artifact hashes were checked before extraction. Both source ZIPs were unpacked into the new `C:\ll-check-1789869992384` folder, with no dependency folders, build output, local environment files or Git history copied from the development checkouts. Locked dependencies were installed afresh with Node 24.14.0, npm 11.9.0 and pnpm 10.33.0; the package manager reused its download cache. The environment allowlist excluded provider keys and inherited service configuration, and npm received an empty user configuration file. Only the ordinary prewritten Simulation path was enabled.

The archive folders have disposable, remote-free Git repositories solely for existing source/build checks. Their local fixture commits (`f911c8e914463b3e1b7ee792ecbd3dfa0b06d756` and `f8f4514f9f00bcca36edc33b518e4f11121c0392`) are **not** release commits. The package identities above remain authoritative. Copy push guards were configured; neither fixture is a development branch or worktree.

## Executed checks

- Primary `npm ci` and `npm run check`: formatting, lint, secret scan, types, **702 tests** (32 script + 73 shared + 426 web + 171 extension), all builds, packaged-worker verification and production HTTP smoke passed.
- Isolated copy's frozen-lockfile install and guarded `rework-check.mjs`: lint, types, **387 tests in 27 files** and production build passed. No inherited database/browser suite was run.
- Paired component checks: **2/2 passed** against the freshly built copy.
- Every one of the **ten freshly rebuilt extension files** matched the immutable package manifest byte for byte.
- The paired production check passed against both fresh local servers: backend source parity, isolated companion build, two distinct confusion concepts/practice questions, source evidence, repeated Finish, local access controls, inherited-route rejection and synthetic-session deletion.
- The first controller verified cleanup of 18 owned processes; the paired follow-up verified eight. Ports 3000 and 3111 were closed after each phase. No browser/desktop, provider call, original MeltingPot service or account change occurred.

This is a source-archive rehearsal using the installed Node/Git tools and package caches, not a clean operating-system or Chrome-profile test. No new runtime change or replacement release package was needed.

## Preserved evidence and helper review

External evidence is under `C:\Users\abuiz\Documents\Codex\2026-09-04\you-are-taking-over-the-livelecture\outputs\acceptance-20260919\fresh-1789869992384`. It contains each command's log, original executed helper snapshots, fixture identities, terminal results and process cleanup.

| Artifact                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `result.json`                | `0b4f8f069237af2ef69ad839c4983e3782925256af5c6ab01a948bc08f2f11ba` |
| `paired-result.json`         | `8569c8c99b45d7d8eabd8818ba77f874547f1cd65a4699509471db1e1a2df410` |
| `executed-helper.mjs`        | `2e5ef48a1fc459c2c0fc606e5b60c69b116c5d1c9f10a261107d46cdf444fdb8` |
| `paired-executed-helper.mjs` | `a2c66dcbcab80b91e2e2a01a3be0f8db90db65b78616c3c77a746b385e7fe337` |

Sequential independent helper review identified two evidence weaknesses: closing command logs on process exit before their pipes necessarily drain, and failing to recheck both saved fixture identities before the paired follow-up. The paired helper was corrected and reviewed before execution: both exact fixture HEADs, clean trees and absent remotes are required before starting servers. Its command output is drained before logging ends.

The first run had already completed using the original helper. The reviewer inspected the actual saved logs and confirmed every test total, the complete production HTTP success line, the copy's full build footer and the paired-component footer. Its original executed bytes and result are preserved; no reinstall/retest was needed to replace missing evidence. The reusable first helper now drains successful output and has an independent timeout rejection so a Windows descendant holding a pipe cannot prevent outer owned-process cleanup. That revised helper was not used to relabel the preserved run.

Final sequential paired-result/document review passed with no remaining actionable findings. The reviewer matched all four evidence hashes, source/fixture identities, complete HTTP output and cleanup, and confirmed the reusable helper's independent timeout recovery. Human and provider acceptance remain separate from that review.

## Next action

The user has been asked for Chrome control permission for the current session because the earlier overnight session ended. Once authorized, refresh the supported desktop tool and try the actual extension installation using the package above. The tool has updated since the previous folder-picker failure, but successful targeting has not yet been established. Do not treat these HTTP/component checks as that installation check.

Use the [existing learner and saved-answer review guide](../ACCEPTANCE-2026-09-18/HUMAN_REVIEW.md) afterward. Preserve closed provider-test allowances and the [recorded retention limitations](../ACCEPTANCE-2026-09-18/PROVIDER_RETENTION.md). Account-specific retention, human review, judge access and final release/submission remain open.
