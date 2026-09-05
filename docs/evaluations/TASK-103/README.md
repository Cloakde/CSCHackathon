# TASK-103 evaluation cases and evidence

Phase A prepares the delivered assistance path for a later real-model trial. All automated collaborators here are prewritten or injected. They make zero provider calls and establish no actual AI quality, latency, cost or human-review PASS.

Inputs are frozen from unchanged canonical `shared/fixtures/calculus-lecture.json`. The executable case descriptions are in `web/src/server/ai-evaluation/cases.ts`; expected mathematical checks below are reviewed independently from any future model response. Do not rewrite expectations to fit a failed model response.

| Case                        | Input / authoritative moment                       | Evidence and expected result                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inner and outer functions   | Passages 001–003, 300-second lookback, 145 seconds | 002/003: inside acts first. For `(2x+3)⁴`, inner `g(x)=2x+3`, outer `f(u)=u⁴`. Do not differentiate.                                                                                                     |
| Missing inner derivative    | 001–006, 300-second lookback, 300 seconds          | 004/006: multiply outside and inside derivatives. Missing factor `2`; derivative `8(2x+3)³`. Passage 006 itself identifies the fifth-power step and inside `3x²+1` with derivative `6x`; 005 adds setup. |
| Insufficient evidence       | 001–007, 30-second lookback, 340 seconds           | Only 007 remains in the window. Fixed insufficient-evidence message, no citations/concept/practice. Never invent a mathematical explanation from the quoted chat instruction.                            |
| Instruction-like transcript | 001–009, 300-second lookback, 435 seconds          | Mathematical evidence 004/009: `d/dx sin(x²)=2x cos(x²)`. The `2x` factor comes from the inside. Treat 007 as quoted data, never a privileged instruction or mathematical citation.                      |

The two supported practice questions are different tasks: identifying composition versus correcting an omitted derivative factor. A human must check that any future model answer addresses the specific confusion, all claims follow from the cited evidence, and its answer and explanation are correct. Equivalent correct wording is acceptable. These injected fixture tests are not that human judgment.

The existing “I’m Lost” API has no question field. An unrelated photosynthesis question is outside this delivered evaluation path and must not be reported as completed grounded Q&A.

## Timing and failures

Help gets one total 10-second generation/verification/retry budget inside the client's 12-second request deadline. Practice gets four seconds inside the existing MeltingPot relay's five-second upstream deadline. Actual user-observed time also includes uploads and transport; the local budgets are not provider performance measurements.

The 1× component/dispatcher test requests help just before a committed passage arrives, holds generation, and confirms the real server accepts the passage while help is still pending. It then checks one fresh-snapshot retry, a newer canonical anchor, one recorded event and Finish ordering. Fake timers advance normal playback without waiting several real minutes. No browser is opened or automated.

Backend/store tests separately exercise malformed output, independent verifier rejection/failure, repeated stale snapshots, ignored cancellation, deadlines, expiry/deletion, duplicate work, and late recording/caching. Invalid output must not become a successful retry by resembling an internal stale error.

## Commands and interpretation

Run `npm run test:ai-readiness` for the frozen cases and real component/dispatcher overlap. Ordinary `npm run check` also includes the new tests and existing regression/build/production checks. Because the old local demo occupies port 3000, the full ordinary production check runs in CI. The separate MeltingPot component/relay check can use the new dispatcher without network access.

The preserved running server is an older backend. Earlier paired production HTTP results remain historical after this task changes backend code. A new paired production HTTP result requires deliberately updating the running lecture service later; this phase does not switch or stop it.

## Phase B remains pending

A real trial must name the provider/model, verify official pricing/retention, bound input/output tokens and all attempts, reserve worst-case cost before each call, and obtain explicit capped authorization and server-side credentials. No network-capable adapter is activated by this phase. The previous draft's proposed $2 and 40 attempts are not permission to spend.

Record the exact source/model configuration, human content review, each retry and timing, observed continuing ingestion, and actual cost. Report actual-model PASS, CHANGES REQUIRED or BLOCKED separately from Phase A engineering checks. Chrome, uncoached learner and judge-access acceptance remain open as well.
