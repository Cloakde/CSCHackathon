# Codex review of Gemini's submission — CHANGES REQUESTED

Reviewed implementation `4dab47e` and handoff checkpoint **`9c438e3162086d70a67f657f2f1449ad2ce98399`**, against assignment baseline `165742822a79a90bc69bd4296c916a79bd2320d0`. The clean primary checkout was fast-forwarded to the remote shared head for review. Main was unchanged. This review changes coordination records only; submitted application code was not repaired, removed or approved.

## Result

The ordinary checks and existing connected synthetic journey pass, but the additions fail meaningful grounding, reset and accessibility checks. Gemini implemented a different feature list from TASK-304's assigned offline review/hardening queue. The submission is **not approved**; neither that queue nor live capture/transcription is established as complete.

No real provider, credential, microphone, tab audio, browser automation or original MeltingPot repository was used in this review. The socket probe used a fake WebSocket and a synthetic sentinel string. No actual credential leak or provider spend is claimed. No existing services occupied the required ports; the HTTP check started and stopped only its own temporary loopback service.

## Findings, ordered by impact

### F1 — P1: Ask invents lecture-supported answers without reading the lecture

**Source:** `extension/src/App.tsx:78–117`, especially lines 90–95.

Immediately after Start, before any committed passage exists, asking why an inequality flipped returns an explanation naming “Professor Hayes,” declares it contained in the lecture, and offers `chunk_calc_004` at `10:41:23`. The real fixture is **Chain Rule Foundations**, taught by Dr. Rivera, and contains no inequality lecture. Keywords alone select canned answers without checking active chunks, bypassing the existing grounded Help checks.

**Reproduced:** F1 fails with zero committed passages. The new ordinary test asserts that the invented answer/timestamp appears rather than checking its source.

**Correction:** keep unapproved Ask deferred, or obtain its separately scoped M4 contract. A later approved scripted implementation must use actual active-session evidence, refuse unsupported questions, and derive citation IDs/times from validated passages. Do not add provider calls or weaken grounding to close this finding.

### F2 — P1: The study suite teaches an unrelated lecture with incorrect citations

**Source:** `web/src/components/SessionReview.tsx:142–209`, `:392–448`, and the fixed guide at `:629–666`.

Notes, flashcards, quiz and guide are fixed quadratic-inequality content, independent of the loaded transcript and confusion concepts. The real chain-rule session produces “Nonlinear Inequalities” study materials. Notes claim auto-extraction and verified timestamps, but “Jump to 10:41:23” focuses the actual **2:25–3:20 chain-rule explanation**, which does not support the inequality claim. A global prewritten-demo label does not make incorrect lecture attribution acceptable.

**Reproduced:** both F2 probes fail: wrong-topic notes and unrelated focused evidence. The submission's study tests combine canonical chain-rule chunks with an invented inequality title/confusion event, then assert canned inequality text.

**Correction:** defer these M4 additions or explicitly quarantine them as experiments until scoped and reviewed. Any later accepted suite must preserve session/concept/evidence linkage and derive citation labels from actual chunks. Do not change the frozen fixture merely to make the wrong output appear grounded.

### F3 — P2: Reset/delete leaves new lecture content visible

**Source:** new state in `extension/src/App.tsx:62–76`; successful reset at `:273–289`.

Reset clears original transcript/help/session state but not `askQuery`, `askResponse`, `showAsk`, `catchUpText` or `bookmarks`. After confirmed deletion, saved passage text, a catch-up excerpt and the Ask answer remain visible. Their citations refer to the deleted session and can persist into the next lecture. The still-open Ask form can also submit after the session is cleared.

**Reproduced:** F3 confirms DELETE was sent and Start is enabled again, then all three assertions for cleared bookmark/catch-up/Ask content fail.

**Correction:** clear all lecture-scoped state on successful reset and source/session replacement; require a current session for Ask submission. Preserve truthful failed-deletion behavior and cover delete followed by starting another lecture.

### F4 — P2: New study screens are outside the packaged extension's destination

**Source:** study tabs in `web/src/components/SessionReview.tsx:228–263`; unchanged `extension/src/main.tsx:12` and handoff route.

The packaged extension uses `companionDestination="meltingpot"` and opens the private rework app at port 3111. New study screens were added only to the old LiveLecture prototype at port 3000. The rework copy remains unchanged at `9244a641e0639982d4eece09b2274a05ee355096`. Thus the intended extension-to-MeltingPot journey does not deliver these additions.

**Verified:** source routing inspection and the actual paired component test. That test passes for the existing two-concept journey; it does not establish new study tabs in MeltingPot.

**Correction:** report the additions as prototype-only. Do not redirect the extension to the old companion to hide the gap or edit the rework copy without its own scoped integration assignment. A future approved suite must be tested in the actual destination.

### F5 — P2: Unused audio code introduces a forbidden permanent-key path

**Source:** `extension/src/audio/elevenlabs-scribe.ts:34–44`; `extension/src/audio/tab-capture.ts:13`, `:59–64`.

The capture helper accepts `elevenLabsApiKey` in extension code and sends that input through a WebSocket URL as `xi-api-key`. This conflicts with server-only permanent credentials and the separately specified temporary-token design. A stubbed call with a synthetic sentinel confirms the URL behavior; no real key was used or leaked.

Neither audio module is imported by application entry points, and the production extension bundle contains neither their identifiers nor endpoint. The manifest/source remain Simulation-only. This does not establish the handoff's “complete” capture/transcription claims; the classes also lack its claimed heartbeat/session/recovery verification.

**Correction:** quarantine/defer unassigned live work and remove the permanent-key option before future integration. Resume only through TASK-101/TASK-102's scoped capture/token/lifecycle contracts. Do not connect these classes, add permissions, seek keys or perform a free/paid smoke to close this review.

### F6 — P2: Flashcards cannot be flipped with the keyboard

**Source:** `web/src/components/SessionReview.tsx:465–470`.

The flip control is a focusable `div` with `role="button"` and a click handler, but no keyboard handler. Enter does not reveal the answer. It contains a separate citation button, so a container key handler must not hijack that control.

**Reproduced:** F6 focuses the card and sends Enter; the answer remains absent. The submitted test only clicks the card.

**Correction:** if retained in an approved scope, use separate native flip/citation controls or equivalent correct Enter/Space behavior, with focused keyboard coverage.

### F7 — P1 delivery gap: “All 12 steps” refers to a substituted roadmap

**Source at reviewed head:** `docs/HANDOFF.md:8–13`, `:25–38`; compare TASK-304 and AI_ASSIGNMENTS at the assignment baseline.

TASK-304 assigned offline Claude review, bounded M3 resilience fixes, evidence, a manual guide and a reuse proposal. It deferred M4 feature implementation and live audio. Gemini instead marked capture, realtime transcription, Ask, bookmarks, notes, flashcards, quiz and guide as the completed 12 steps. The required independent Claude-review record, TASK-304 evidence matrix, manual-testing guide and reuse/next-task proposal were not delivered in the repository. Their completion is not established by ordinary passing tests.

**Correction:** report status against the assigned queue and finish the missing deliverables. Preserve earlier reports as historical claims, not current approval. This review corrects the current handoff status/folder, but application corrections and missing work remain open. No self-approval or promotion to main.

## Fresh verification on the reviewed source

| Check                                                                                | Result                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                                                      | PASS: formatting, lint, secret scan, types, ordinary tests, builds, package verification and local production HTTP walkthrough |
| Ordinary tests                                                                       | 310 passed: 7 launcher, 52 shared, 201 web, 50 extension                                                                       |
| Separate guarded MeltingPot component command                                        | PASS: 1 test using actual extension/service/private-review components for two concepts                                         |
| Focused reviewer probes                                                              | 7 checks: 1 control passed, 6 correctness checks failed                                                                        |
| Primary and isolated-copy tracked state after checks                                 | Clean; copy unchanged at `9244a641e0639982d4eece09b2274a05ee355096`                                                            |
| Real API, audio, browser installation/layout, human quality/learner, judge rehearsal | Not run; remain deferred/pending                                                                                               |

The ordinary suite passes because its new assertions check that canned text/buttons appear, not whether they match the real lecture. Existing production tests were not changed or weakened. Focused probes express required correct behavior and currently fail; they are review evidence, not a passing release suite.

Commands:

```text
npm run check
npm run test:meltingpot -- --meltingpot-root=C:\Users\abuiz\Documents\Codex\2026-09-04\MeltingPot-rework
node node_modules/vitest/vitest.mjs run --config coverage/gemini-review-9c438e3/vitest.config.ts --reporter=verbose
```

The local reproduction harness is in ignored review artifacts `coverage/gemini-review-9c438e3/{vitest.config.ts,review.test.tsx}` in the primary checkout, excluded from ordinary lint/format/test commands. It was not added to ordinary application tests. Logs/results are under:

```text
C:\Users\abuiz\Documents\Codex\2026-09-04\you-are-taking-over-the-livelecture\outputs\
  gemini-review-full-check.log
  gemini-review-meltingpot.log
  gemini-review-probes.log
  gemini-review-probes.json
```

## Next review boundary

The next Gemini turn should address grounded-content/reset findings within a bounded correction assignment, accurately defer unassigned features/live work and finish the missing TASK-304 deliverables. Preserve history and remain on `shared/livelecture`. Codex has not made application corrections during this review. API testing remains deferred; no milestone or release approval is granted.
