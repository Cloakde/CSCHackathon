# Remaining roadmap implementation — TASK-308

Codex, 2026-09-15. Implementation and local verification complete; candidate packaging/paired evidence is recorded below and in the final handoff. Whole-milestone and live acceptance are not claimed.

Starting pair: LiveLecture `0c14d8c57b31c386d5f141308a721461fffa638b` / MeltingPot rework `9244a641e0639982d4eece09b2274a05ee355096`. Work uses the existing branches, preserves history and never edits original MeltingPot repositories/services.

## Delivered scope

- Gemini-aware MeltingPot handoff, validated assistance labels on success/failure, and source labels for completed live tests. Both provider labels use the same requested destination; no hidden redirect to the old prototype.
- Default-off live integration: single audible passthrough, bounded silent worklet tap, resampling/packetizing, offscreen transport, validated events, capture cleanup, explicit UI consent and panel-lifetime limit. See [ADR 0013](../../adr/0013-bounded-live-rehearsal.md).
- Source-mode-aware ingestion and lecture tools; application practice supports non-benchmark concepts without altering the frozen evaluation. All provider calls still need authorization and independent answer verification.
- Private source-linked notes, confusing-concept review links, page-local bookmarks and explicit plain-text download in MeltingPot. These are transcript excerpts, not invented AI notes.
- Prepared live-run launcher, package/checksum builder, [release/setup guide](RELEASE.md), [manual live test](LIVE_TEST.md), and [submission draft](SUBMISSION_DRAFT.md).

## Review and evidence boundaries

Sequential independent reviewer `remaining_milestone_review` inspected exact prior head `0c14d8c` and reported no new P1/P2 in TASK-101/102 corrections (`8336516..0c14d8c`) and relevant TASK-306 changes (`9d71125`). It did not run tests, call providers, approve new work, accept older unrelated tasks, or grant main promotion. Its key integration finding was the fixture-only lecture snapshot and benchmark-only practice taxonomy; this task adds explicit live paths for those boundaries.

Sequential independent reviewer `task308_review` requested three P2 fixes: establish capture ownership before media acquisition, recheck source after builds, and verify the owned server before announcing readiness. A defensive stale-owner callback issue was also identified. The follow-up review found those four issues resolved and no further P1/P2 within that scope. It did not rerun checks, accept Chrome/provider behavior, or approve the whole release. A subsequently corrected App source-mode type error was explicitly outside that review's approval.

The corrected integrated build starts its six-second panel lease before arming capture, so closing the panel during a delayed media request cannot leave capture running. The standalone capture spike retains its separate lifecycle. Launcher and packager refuse changed source, occupied ports do not silently succeed, and delayed callbacks cannot stop a replacement owner.

Current author checks and final source pair are recorded at completion below. Mock Gemini results establish contracts/status propagation, not model quality. No provider call, credential inspection, real recording, browser/desktop control, deployment or submission has occurred during this implementation.

## Local verification

- LiveLecture `npm run check`: PASS, including formatting, lint, secret scan, type checks, **547 tests (24 root + 73 shared + 288 web + 162 extension)**, production builds, ordinary extension-package verification and the production HTTP demo.
- Separate opt-in `live-test` extension build: PASS. Manifest has the separate LIVE TEST name and ElevenLabs socket policy; ordinary package retains its local-only connection policy. Actual installation and audio behavior remain untested.
- Isolated MeltingPot guarded check: PASS, lint, types, **343 tests in 25 files**, production build. Saved at `4534dba6bb490d3a4c95bce499656aee5b8f4c52`; remote-free and push-guarded.
- Paired component journey: PASS, **2 tests**, prewritten and mock-Gemini assistance through the extension, API, relay and MeltingPot with distinct practice topics.
- Paired production HTTP: PASS at LiveLecture `345850d9589f88dd9b4c245215e96f9b077b615b` / MeltingPot `4534dba6bb490d3a4c95bce499656aee5b8f4c52`. Both loopback servers were launched for the check, their owned listener processes were verified, and both were stopped afterward. Two confusion topics, distinct practice, citations, repeated Finish, private access guards, inherited-route rejection and deletion passed. The first run exposed obsolete disclosure assertions; the test now requires truthful sample/live and prewritten/Gemini labels. It does not turn fake Gemini into live evidence.
- Synthetic WAV/PCM format, duration, non-silence and hashes: PASS. No recording or playback was performed.
- Initial review failures and the later UI type-check failure were corrected before the successful full check. Paid/manual launchers were tested only with fake dependencies or no-argument offline plans.
- Source implementation is `aac4b9b`; the following disclosure-test and documentation checkpoints do not change application runtime. The local package manifest pins both final source commits/trees and artifact hashes. Final CI must match the shared branch head in PR #5 checks.

## Remaining acceptance

| Gate                                                                                                    | Status                                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| M1: actual Gemini quality/compatibility, Scribe paid smoke, Chrome capture matrix                       | PENDING                                                                          |
| M3: integrated Chrome audio/transcript/help/Finish/private practice                                     | PENDING; default-off candidate only                                              |
| M4: learner usefulness, subject review, accessibility/visual checks                                     | PENDING; notes/bookmarks implementation is narrower than all stretch study modes |
| M5/M6: independent release approval, judge access, recording, clean-machine rehearsal, final submission | PENDING; package and scripts are preparation                                     |
| Original MeltingPot repositories/services                                                               | Excluded and untouched                                                           |

Durable sessions, class sharing, rich flashcards/multiple quiz modes and a broader MeltingPot redesign remain outside the prioritized roadmap. Local sessions still expire after 30 minutes or server restart. Exported notes are user-created files and are not erased by deleting the local session.
