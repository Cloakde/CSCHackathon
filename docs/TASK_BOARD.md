# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                                         | Tier | State       | Owner             | Dependency                                                                                                   | Owned scope                                                                                                                                                |
| -------------------------------------------- | ---: | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-000 Canonical bootstrap                 |    1 | MERGED      | Codex Lead        | none                                                                                                         | baseline `e4641e29`; CI run `33868115745`                                                                                                                  |
| TASK-001 Windows line-ending reproducibility |    1 | MERGED      | Codex Lead        | TASK-000                                                                                                     | fix `d98343dd`; CI run `33869364979`                                                                                                                       |
| TASK-002 Prioritize the learning demo        |    1 | MERGED      | Codex Coordinator | Product Owner approved plan changes                                                                          | `docs/tasks/TASK-002.md`; reviewed/integrated `9df8479733fccddac7bd0c3a2d8c1ae1c6c20a31`; branch `coord/TASK-002-learning-first-plan`                      |
| TASK-003 Align MeltingPot milestones         |    1 | MERGED      | Codex Coordinator | Product Owner Execute on the proposed milestone revision                                                     | `docs/tasks/TASK-003.md`; branch `coord/TASK-003-meltingpot-milestones`; candidate `046ddb263649190df1e20b5454ee635e65419d56`; integration condition below |
| TASK-101 Chrome capture spike                |    1 | BLOCKED     | unassigned        | TASK-001 + schedule activation                                                                               | `docs/tasks/TASK-101.md`                                                                                                                                   |
| TASK-102 Scribe transport spike              |    1 | BLOCKED     | unassigned        | TASK-001 + schedule; spend for PASS                                                                          | `docs/tasks/TASK-102.md`                                                                                                                                   |
| TASK-103 Actual AI help evaluation           |    1 | IN PROGRESS | Codex Coordinator | Phase A merged; Phase B contract approved; real-model evidence needs separate capped authorization           | Inactive trial preparation; `docs/tasks/TASK-103B.md`; `coord/TASK-103-ai-trial`; exclusive provider/budget/evaluation lanes                               |
| TASK-104 Judge requirements and access route |    3 | BLOCKED     | Coordinator       | Source check complete; deadline conflict and chosen submission route remain unresolved                       | Read-only findings below; no hosting/storage implementation authorized                                                                                     |
| TASK-201 Local learning demo                 |    1 | MERGED      | Codex Coordinator | Product Owner Execute; existing contracts frozen                                                             | `docs/tasks/TASK-201.md`; branch `coord/TASK-201-learning-demo`                                                                                            |
| TASK-202 Local learning service              |    1 | MERGED      | m2_backend        | TASK-201 frozen contracts                                                                                    | `web/src/server/**`, session API routes/tests; branch `task/TASK-202-local-learning-service`                                                               |
| TASK-203 Lecture help screen                 |    1 | MERGED      | m2_extension      | TASK-201 frozen contracts                                                                                    | Extension App, demo client/styles/tests, manifest/package verifier; branch `task/TASK-203-lecture-help`                                                    |
| TASK-204 Companion and rehearsal             |    1 | MERGED      | Codex Coordinator | TASK-201 frozen contracts                                                                                    | Companion UI, launcher, integration tests, coordinator docs; integration branch                                                                            |
| TASK-301 Private MeltingPot lecture review   |    1 | MERGED      | m3_meltingpot     | Independent approval of `9244a641e0639982d4eece09b2274a05ee355096`; integration condition below              | Private review in the isolated local MeltingPot copy; exact ownership in `docs/tasks/TASK-301.md`                                                          |
| TASK-302 Extension-to-MeltingPot handoff     |    1 | MERGED      | m3_extension      | Independent extension approval `e9954ca6e67411a0b99b09261fed3f4724199ab3`; final integration condition below | Validated Finish link in five owned extension files                                                                                                        |
| TASK-303 Connected journey acceptance        |    1 | IN REVIEW   | Codex Coordinator | Automated component/production checks PASS; human Chrome/learner and actual AI/judge evidence PENDING        | Implemented checks and launchers are integrated with TASK-301/302; whole-milestone acceptance remains open                                                 |

## Current Milestone Position

- **M0:** complete; no bootstrap restart.
- **M2:** prototype implementation merged. Preserve its functional checks and keep the human, actual AI, and judge-access evidence below pending until each receives its own proof.
- **M3:** **MeltingPot connection and resilience**, synthetic engineering implemented and automatically verified under TASK-301–303. The integration transaction below governs promotion; whole-milestone PASS remains pending. The Product Owner authorized execution and `m3_review` approved the handoff/access contract at `5427e097ec73234e886f63049189cf136fcc7378`. Pending M2 and repeated M3 human/AI/judge evidence is not waived.
- **M4:** deferred until the connected M3 journey and learner/privacy checks pass. Broader MeltingPot redesign and unrelated screens are outside the first journey. Reuse suitable study components instead of rebuilding equivalents.
- **M1/M5/M6:** actual AI proof, conditional live work, and release rehearsals retain their existing gates. No new calendar dates or spending permissions are set.

The approved destination is the isolated sibling `MeltingPot-rework` copy at preparation commit `89a15ffa95aa227648a3aac81382eed558ebfa81`, sourced from `Rayrayyh/Melting-Pot` at `843ebeea1a9cf041355abc0dca167a5c2a1b281b`. Its 257 local tests and build are preparation evidence, not proof of the connection. Neither original MeltingPot repository, original checkout, nor live service is in scope. [ADR 0007](adr/0007-meltingpot-rework-direction.md) records this boundary. The existing M2 companion remains a working prototype until the replacement passes; an M2-only final submission requires an explicit scope decision.

TASK-003 changes the five owned planning documents only. Independent reviewer `milestone_rework_review` and temporary integrator `milestone_rework_integrator` must verify the exact revision and green pull-request CI before it reaches main. The full check runs in CI to preserve the user's running local demo on port 3000. Review and integration evidence belongs to this task's handoff; no feature readiness is implied by merging the plan.

TASK-003 integration transaction: planning candidate `046ddb263649190df1e20b5454ee635e65419d56` is based on `a7dc31e6aef64143486b170247b9d6dc5da930ba`. The accompanying coordination revision records this transaction. The MERGED state takes effect only when the independently approved, fully checked final revision reaches main; it remains IN REVIEW on the task branch until then. The integration handoff records the exact reviewed head, resulting main revision, and CI evidence. No M2 or M3 acceptance state changes with this transaction.

TASK-201–204 integration record:

See the separate TASK-301–303 integration record below for the newer MeltingPot connection. The following M2 evidence remains historical and does not substitute for acceptance on the new destination.

- Implementation candidate: `e78852dd61be569a1120bd9a71d70b9e7986f0df`, based on reviewed main `426bfda6f14172b3d5b3c9bd1c3cf2104ed6861f`. The accompanying coordination commit records this integration transaction; its MERGED states take effect only when the independently approved, fully checked commit reaches `main`.
- TASK-203 source `9fa310092f3a4e25169e5688c9e6aa31f5f11ff7` was independently approved by `m2_contract_review`. TASK-202 source `6ab3fd7ec74eb95c9a77fc5cb7a2dda4790f27f0` was independently approved by `m2_extension`; its production compatibility fix `eb9b75ed9b5a00fe90de459d96bf06decb8d6014` was independently approved by `m2_contract_review`. The Coordinator owns TASK-204 and requires final combined approval plus temporary integrator `m2_integrator` before updating main.
- The implemented flow connects the actual lecture component, local service, stored confusion events, and companion exercises for two distinct concepts. It includes safe insufficient-evidence handling, citation focus, answer explanations, request cancellation, deletion, fixed local access checks, and bounded transient state. Help and practice are explicitly prewritten; no provider was called.
- `npm run check` now includes the complete component/API callback and a production HTTP walkthrough after builds. The production check caught and fixed Next's internal loopback URL normalization and empty DELETE streams; regression tests cover both. The command requires port 3000 to be free and stops its own temporary server without opening a browser.
- Engineering review has checked both practice questions and answers. This is not the required human content/learner acceptance. Whole-milestone readiness remains separate below; implementation MERGED does not mean M2 or the AI product is ready.

| M2 readiness area                                   | Status after this implementation                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Functional automated callback                       | Implemented and protected by the full required check; exact integration must pass it              |
| Independent grounding/code review                   | Source lanes approved as above; final combined commit requires approval before integration        |
| Chrome installation and visual/manual behavior      | PENDING — no laptop/browser control was authorized or used                                        |
| Uncoached learner and human review of both concepts | PENDING — participant/window not assigned                                                         |
| Actual AI quality, latency, and continued ingestion | PENDING — TASK-103 has no authorized provider run; queued scripted uploads do not prove this gate |
| Judge access route and rehearsal                    | PENDING — selection still required                                                                |
| Scripted-help final submission scope                | NOT APPROVED — implementation authorization is not submission-scope acceptance                    |

Next concrete work after Phase B's integration transaction below: obtain the concrete $1 trial approval and local server-process credential setup, then run and review the synthetic real-model trial. TASK-303 human checks remain separate. Human Chrome inspection still requires session-specific permission. Judge access and submission scope remain unresolved. The last-known preview used the older M2 backend; the fresh Phase B service observation is recorded below. Live audio remains conditional and M4 breadth stays deferred until its gates pass.

### TASK-103 bounded preparation

- Base main was freshly verified clean at `49ae3f88e7fc9b286e77449aea188c2acc8d2c5c`, matching the remote. The preceding M3 merge passed main CI run `33938587463`. The isolated MeltingPot rework remains clean at `9244a641e0639982d4eece09b2274a05ee355096` with no remote.
- The Product Owner's **Execute next** authorizes Phase A's reversible synthetic preparation despite unresolved administrative calendar activation. It does not waive real-model, human, judge-access or M4 gates. Contract `48929fa71ee258851dfb7df1704de14bdd7173b8` was independently approved by `m3_review` before implementation; shared cancellation seam `dd8fd6c3467483f7accec1a4e3c985ab0ea98eb9` also passed independent review and 52 shared tests.
- `m3_extension` owns the continuous uploader/App lane; `m2_contract_review` is the backend implementing engineer for this task; Codex Coordinator owns shared cancellation, frozen evaluations, cross-component checks and coordination. Exact exclusive paths are in `docs/tasks/TASK-103.md`. `m3_review` has no implementation ownership and is the final independent reviewer and temporary integrator.
- The preparation keeps committed passages flowing during Help, allows one bounded fresh-snapshot retry, cancels late writes, and independently verifies asynchronous practice. Four frozen synthetic cases and actual extension/dispatcher overlap tests remain distinct from real-model quality and latency evidence. Runtime help/practice remain prewritten; no provider calls or cost are authorized.
- The preserved lecture server on port 3000 has an older backend. Previous paired production HTTP evidence below remains historical after this backend change. The new dispatcher must pass the zero-network MeltingPot relay/component test and ordinary production CI; a new paired production HTTP run remains PENDING until a deliberate later server update. No existing service is switched in this task.
- Phase A implementation candidate `0acf4dd04edf9c71f590175db0441d33804f1aec` passed all 187 ordinary tests, the seven dedicated readiness checks, type checking, lint, formatting, local secret scanning, and the separate MeltingPot component/relay journey. `m3_review` independently approved extension source `11cdd5f1005d5ee5c547df3744019c1c70d8e8b3` and backend source `73beb420050d9134eb1e3f16113bcd06d08707f6`, then reviewed the combined implementation with no new findings. The Coordinator's cases also received a separate review and stronger verifier assertions.
- Phase A is MERGED at `0b80cb902c9db3edec3fb1266fa440e3d0e70e84`, freshly verified clean on local/remote main. Independent integration is recorded in [PR 3](https://github.com/Cloakde/CSCHackathon/pull/3); PR CI `33939972829` and main CI `33940073734` passed. TASK-103 remains IN PROGRESS because actual-model evaluation stays open; no milestone acceptance is implied. See `docs/evaluations/TASK-103/README.md` for frozen cases and remaining trial requirements.

### TASK-103 Phase B inactive trial integration

- Base main was freshly verified clean at `0b80cb902c9db3edec3fb1266fa440e3d0e70e84`, matching the remote. The later **Execute** authorizes preparing the trial, without paid requests or laptop control. `m3_review` independently approved contract `7cd0ccb7b143cf20c8f5f4e9e3197d9d5363d4a6` and the probe ownership amendment `6f11e96673b71b4b356da3af10285b1b894a3798` before implementation in those paths.
- Independently approved owned sources: budget `68fd57c68063be4306ab6d179a71c7ba73df4280`, provider `3931a20de7a1d854261550a90268e41461672389`, component probes `2d2264c5fddc305f931a3146a749d3c131ed249b`, runner/report correction `c4e40f6b3e41252f0da79baea47d43085b64a8ee` and real-ledger regression `284d56a92fec20c024ff27eddcc6bab4b5a86acf`. Review found and resolved an encoded credential-echo gap and interrupted-report preservation/final-accounting gaps.
- Combined implementation candidate `284d56a92fec20c024ff27eddcc6bab4b5a86acf` passes 303 ordinary tests (7 launcher, 52 shared, 197 web, 47 extension), types, lint, formatting, local secret scanning, all builds/package verification, and the production HTTP demo walkthrough. The separate zero-network MeltingPot component/relay journey also passes against unchanged isolated copy `9244a641e0639982d4eece09b2274a05ee355096`.
- The ordinary HTTP check started and stopped only its own temporary verification server. Immediately before it, neither port 3000/3111 nor historical preview PIDs 44020/15688 were running; no existing process was stopped or switched. The older preserved-preview records above remain historical. A new paired production HTTP result with MeltingPot is still PENDING; this task did not start a MeltingPot service. Original MeltingPot repositories remain outside scope.
- Normal app behavior is unchanged. The new `ai:trial` command defaults to an offline plan; only an explicitly authorized, clean-source invocation can use the inactive provider connection. The proposed allowance is **$1 total / 32 attempts** on pinned `gpt-4.1-mini-2025-04-14`, shared durably across worktrees. The user has authorized **$0**; no provider calls or credits were used. See [the Phase B runbook](evaluations/TASK-103/PHASE-B.md) for setup, immutable report checkpoints, retention and remaining acceptance.
- This accompanying coordination revision records the integration transaction. Phase B preparation becomes MERGED only after `m3_review` approves the exact final head, full clean-install PR CI and history secret scanning pass, and the independent integrator promotes that reviewed tree to main. Until then preparation is IN REVIEW. Record the exact reviewed head, resulting main and CI in the integration handoff. Actual-model evaluation, human mathematical/learner review, Chrome behavior, judge access and whole-milestone acceptance remain PENDING; TASK-103 stays IN PROGRESS.

### TASK-301–303 integration transaction

- LiveLecture implementation candidate: `8c92570fc6e7a12ca685f5c7944498855445e524`, based on reviewed main `2d8a9adf44f782d93e4d84b9838411025f63ad09`. The accompanying coordination-only revision records this transaction. TASK-301/302 MERGED states take effect only after the final exact approved, fully checked LiveLecture revision reaches main and the approved MeltingPot revision reaches its local rework branch. Until then they remain IN REVIEW. TASK-303 human acceptance stays open after code integration.
- MeltingPot candidate: `9244a641e0639982d4eece09b2274a05ee355096`, independently approved by `m3_review`, based on `89a15ffa95aa227648a3aac81382eed558ebfa81`. No remote is configured; promotion is local only. Temporary independent integrator `m2_contract_review` is assigned for both promotions and did not author or review this M3 implementation.
- MeltingPot's complete guarded lint/type/unit/build command passed on the exact candidate: 334 tests in 24 files. The additional 19 offline environment/fingerprint tests and canonical schema parity checks passed. The local secret scan passed. The first production build exposed the required contract-package transpilation; independent review caught a quota split across separately bundled API routes. Both were fixed and regression-checked before final approval.
- The paired component test passed using the actual extension component, LiveLecture dispatcher, MeltingPot relay, and private review. It checks two distinct confusing concepts, correct answers, citation focus/return with answer retention, and deletion. Only Next's router link is represented as a plain anchor in this non-browser test.
- Paired production HTTP passed on LiveLecture candidate `8c92570` and exact MeltingPot candidate `9244a64`. It proved byte parity before reusing the existing LiveLecture backend at `a7dc31e6aef64143486b170247b9d6dc5da930ba`; backend fingerprint `5834b7488ed6f502394cec9d6279e75c707e977410b9d7589477c23993ede712`. MeltingPot runtime build fingerprint: `ccabc1f8eb4c5d099ea3874dca3fcdfa951bc5f3720c06afb2f92c1513cfec93`. The check covered both concepts, evidence identity, repeated Finish, private headers/origins, blocked inherited routes including suffix/encoded variants, and deletion of only its own new session. Both servers were left running.
- LiveLecture local lint/types and all 119 ordinary tests passed. [PR 2](https://github.com/Cloakde/CSCHackathon/pull/2) carries the full clean-install CI, including production builds, existing HTTP walkthrough and full-history secret scanning. Preliminary candidate `f9bb645` passed [run 33938362737](https://github.com/Cloakde/CSCHackathon/actions/runs/33938362737); final exact-head CI is still required before the independent merge and is recorded in the handoff. The paired local check remains a separate required integration gate because the MeltingPot copy is intentionally unpublished.
- No original MeltingPot repository/service, provider, credential, recording, production database, browser, or desktop control was used. The old LiveLecture server on port 3000 remains at its original revision. Its `/demo` is still the prototype; the new `/demo/meltingpot` route becomes available only after a deliberate future server update. Do not infer extension installation or browser acceptance from source/build checks.

| Connected milestone acceptance                                   | Status                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| Two-concept component/API and production HTTP journey            | PASS on the exact sources recorded above               |
| Isolation, privacy data flow, recovery and source linkage checks | PASS in reviewed automated coverage                    |
| Chrome installation, appearance and actual link behavior         | PENDING; no session permission or browser control used |
| Uncoached learner and human content review on MeltingPot         | PENDING                                                |
| Actual AI quality, latency and advancing transcript              | PENDING; help/practice remain prewritten               |
| Judge access rehearsal and approved submission scope             | PENDING                                                |
| Full M3 PASS / broader M4 features                               | NOT YET AUTHORIZED BY ACCEPTANCE                       |

TASK-000 integration record:

- Clean lockfile installation and the complete repository check passed (56 tests plus all builds).
- Three independent reviews approved exact head `e4641e29c804905576ef095cb340c6b26e82fa76` with no P1/P2 findings.
- A temporary independent integrator fast-forwarded the identical reviewed commit to `main`.
- [GitHub Actions run 33868115745](https://github.com/Cloakde/CSCHackathon/actions/runs/33868115745) passed repository verification and full-history secret scanning on the integrated commit.

TASK-001 integration record:

- A fresh Windows checkout reproduced a false Prettier failure because Git converted LF blobs to CRLF while the formatter requires LF.
- The exact `.gitattributes` fix passed a clean-install full check in a newly created Windows worktree, including all 56 tests and builds.
- Three independent reviewers approved exact commit `d98343dd6f7b11bd0f0d5eebb6affc8ebae0882b`, and an independent integrator fast-forwarded it to `main`.
- [GitHub Actions run 33869364979](https://github.com/Cloakde/CSCHackathon/actions/runs/33869364979) passed both required jobs on the integrated commit.

TASK-002 integration record:

- Base: `ec8401bfcf3c512a4d3f5df94a163e302ddbe13c`; task branch: `coord/TASK-002-learning-first-plan`.
- Independent reviewer `plan_consistency_review` approved exact head `9df8479733fccddac7bd0c3a2d8c1ae1c6c20a31` with no findings across the four owned documentation files.
- Clean locked installation and the full repository check passed on that exact head: formatting, lint, local secret scanning, typechecks, all 56 tests, production builds, and packaged-extension verification. The worktree remained clean.
- Temporary independent integrator `plan_integrator` fast-forwarded the identical reviewed head onto local and remote `main`; the reviewed and integrated changes match. Existing worktrees were preserved.
- Integrated-head CI: [GitHub Actions run 33924868794](https://github.com/Cloakde/CSCHackathon/actions/runs/33924868794).
- This changes the plan and coordination records only. Calendar activation, feature assignments, actual AI evidence, and provider-spend authorization remain unresolved as recorded below.

## Approved Delivery Priorities

- M2's prototype implementation is preserved; M3's private extension-to-MeltingPot journey is the next build milestone after its own task gates. It does not wait for live-audio PASS/CUT decisions. Keep outstanding M2 acceptance visible and repeat learner/judge checks on the connected destination before release.
- Establish the private review area with synthetic lectures, then connect Finish, concept-specific practice, and resolving citations. Preserve lecture and confusion identities. Personal data must not automatically enter shared Pots or teacher reports.
- The Coordinator must assign core engineers and reviewers first. TASK-101/TASK-102 are optional parallel work only with available capacity and exclusive ownership. TASK-101 currently overlaps core extension UI files, and TASK-102's shared export is a serialized hotspot; sequence or amend these boundaries before assignment.
- TASK-103 receives an owner, reviewer, synthetic evaluation set, expected evidence/answers, response-time targets, and capped-run contract early. Test actual help and practice while the transcript keeps advancing. $0 preparation uses injected providers; actual provider evidence requires separate authorization.
- TASK-104 records official requirements/source/date, judging criteria, demo length, required artifacts, allowed simulation/AI disclosures, and how judges will access the project. Resolve relevant requirements before hosting/storage/distribution choices and rehearse the chosen route at the first complete demonstration.
- The M2 learner check remains pending; a non-builder must complete the help-to-practice journey without coaching. Repeat it for the M3 destination with two distinct confusion concepts, correct questions/answers/explanations, citation return, and the confirmed judge access route. Day numbers are provisional, not evidence that a window was booked or passed.
- Track functional checks, learner demonstration, actual AI quality, and judge access separately. Scripted assistance must be disclosed separately from simulated transcripts; a scripted submission scope requires explicit Product Owner acceptance.

New task contracts must record an exact current reviewed base and exclusive paths before assignment. TASK-101/TASK-102 retain their existing recorded base until the Coordinator explicitly refreshes their contracts; do not silently branch from a different commit or use a pre-revision plan to restore the old sequencing.

## Schedule Activation Gate

M0 is complete. The Product Owner's subsequent **“Execute”** authorizes TASK-201–204 local synthetic implementation and automated verification now, without waiting for administrative calendar fields. The assigned lanes and exclusive paths are frozen in `docs/tasks/TASK-201.md` at base `426bfda6f14172b3d5b3c9bd1c3cf2104ed6861f`; `m2_contract_review` is the independent reviewer and a temporary independent integrator is required for Coordinator-authored changes. This scoped override does not set dates, waive human/AI/judge acceptance, authorize provider spending, or permit laptop/browser control. Other feature work remains subject to its existing gates. No contributor may infer dates from relative day numbers.

The later **“Execute”** on the proposed milestone revision authorizes TASK-003's documentation update and verification. It records the approved MeltingPot direction and next work sequence. TASK-301–303 remain unassigned TODO work with contracts and applicable execution gates pending; this planning task does not start feature implementation or waive any human, provider, deployment, or access decision.

The subsequent **“Execute the next milestones”** authorizes TASK-301–303's synthetic implementation and automated checks now. Exclusive lanes and exact bases are in `docs/tasks/TASK-301.md`; contract approval is recorded above. This later scoped override supersedes the earlier unassigned TODO statement for these three tasks only. It sets no calendar dates and does not authorize laptop control, providers, live audio, original MeltingPot changes/services, a new MeltingPot remote, deployment, or full M3/M4 acceptance.

| Required value                           | Current authoritative value                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual project Day 1 and timezone        | **UNSET — Product Owner required**                                                                                                                                                       |
| Submission deadline and timezone         | **CONFLICT — October 5, 2026: schedule says 12:00am PDT; rules text says 12:00pm Pacific. Final confirmation pending; do not rely on the later time.**                                   |
| End-of-Day-5 live CONTINUE/CUT decision  | **UNSET — derive after Day 1 is fixed**                                                                                                                                                  |
| Day-10 integrated demonstration          | **UNSET — derive and book after Day 1 is fixed**                                                                                                                                         |
| End-of-Day-15 feature freeze             | **UNSET — derive after Day 1 is fixed**                                                                                                                                                  |
| End-of-Day-18 release candidate          | **UNSET — derive after Day 1 is fixed**                                                                                                                                                  |
| Day-18 clean-environment rehearsal       | **UNSET — human window required**                                                                                                                                                        |
| Day-19 final rehearsal and packaging     | **UNSET — human window required**                                                                                                                                                        |
| Live capture/audio verification windows  | **UNSET — required for scheduled live work; NOT APPLICABLE only after an explicit Live CUT**                                                                                             |
| Learner demonstration participant/window | **UNSET — participant who did not build the app required**                                                                                                                               |
| Available engineering lanes              | **TASK-103B: m2_contract_review implements provider hooks, m3_extension implements the budget ledger, Coordinator owns runner/evidence, m3_review reviews and integrates independently** |
| Live feature classification              | **CONDITIONAL** under the accepted workflow; not promoted to Must Ship                                                                                                                   |
| Provider-spend authorization             | **$0 authorized for automated work; explicit capped smoke approval required**                                                                                                            |

## Evidence and Submission Decisions

| Required value                                                        | Current authoritative value                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Competition rules/source, checked date, judging criteria              | **CHECKED 2026-09-04 — official Devpost overview, rules, and schedule; findings below**                                                     |
| Submission artifacts, demo length, allowed disclosures                | **CHECKED — multiple evidence formats allowed; 1–2 minute video optional; AI-use disclosure required**                                      |
| Judge access route and related network/access constraints             | **SELECTION PENDING — website, demo, repository, screenshots, or video accepted; hosted app/extension installation not stated as required** |
| Actual AI evaluation owner/reviewer and frozen cases                  | **ASSIGNED — Coordinator owns four frozen cases; m3_review independently reviews; TASK-103B records exclusive lanes**                       |
| Actual AI response-time targets and capped provider-run authorization | **10s total Help / 4s total practice; proposed $1 / 32 attempts for pinned gpt-4.1-mini; $0 currently authorized**                          |
| Actual AI quality evidence                                            | **PENDING — no actual AI success established by bootstrap tests**                                                                           |
| Learner demonstration and two-concept practice evidence               | **PENDING — M2; repeat on the connected MeltingPot journey for M3**                                                                         |
| Judge access rehearsal                                                | **PENDING — first complete demonstration**                                                                                                  |
| Scripted-assistance submission scope acceptance                       | **NOT APPROVED — would require explicit Product Owner decision**                                                                            |

### TASK-104 Source Check — 2026-09-04

The Product Owner supplied the [CSC Back-to-School Devpost page](https://csc-back-to-school.devpost.com/). Its overview lists Learning, Design, Creativity, Functionality, and Impact as judging criteria. Submit a project title, problem and solution description, evidence showing the project, tools/resources used, AI-use disclosure, team names, and source/build/design files when available. A 1–2 minute video is optional; repository links, demos, screenshots, and websites are also accepted evidence. The posted requirements do not mandate a hosted app or judge-installed extension. The team still needs to select and rehearse its submission route; there is no reason to add hosting solely on an assumed requirement.

The [rules](https://csc-back-to-school.devpost.com/rules) require disclosure of pre-existing work and major outside resources, including AI contributions; teams must be able to explain their work. Award consideration involves a separate opt-in and a public/viewable project link; this source check does not opt the team in or accept promotional terms.

The [schedule](https://csc-back-to-school.devpost.com/details/dates) closes submissions at **October 5, 2026, 12:00am PDT**, also shown in the rules-page banner. The rules body instead states **12:00pm Pacific** that day. Record this as an unresolved official-source conflict, not a confirmed deadline or permission to use the later time. No rehearsal dates or working-day mapping have been inferred from it.

Until schedule activation is complete:

- TASK-101 and TASK-102 may be reviewed and assigned, but implementation may not start until the schedule gate is complete. TASK-102's fully stubbed implementation may proceed without spend after that point; only its provider smoke and PASS decision require separate spend authorization.
- The later scoped Execute requests authorize TASK-103 Phase A and Phase B preparation under their independently approved contracts and exclusive assignments. They do not authorize paid calls, human/laptop checks, release, or optional feature breadth. TASK-104's read-only requirements check may proceed.
- No ElevenLabs or generation-provider request, real audio transmission, credential use, or credit spend is authorized by this plan revision.
- Synthetic fixtures and fully stubbed tests remain the only permitted data/provider inputs.
- Simulation Mode remains the guaranteed product path and may never be silently presented as Live.

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
