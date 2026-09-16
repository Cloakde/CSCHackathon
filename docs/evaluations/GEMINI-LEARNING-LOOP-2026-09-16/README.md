# Gemini learning-loop diagnosis and correction

## Diagnostic evidence

The user authorized execution of the next milestone: diagnose rejected Help, correct the cause, and test two-topic explanation/citation/practice plus unsupported questions and instruction-like transcript content. This uses the existing synthetic-only $1/32-attempt allowance; no reset, automatic retry, Scribe, desktop, original MeltingPot or main merge.

Run04 used unchanged application runtime at `c41ecb7f21b8ae8cafc6d270420d8cfd0dcb5c68`, tree `3a0116919e265e76a539f394c794b8674d2960c2`, after sequential helper review and [CI 35114869550](https://github.com/Cloakde/CSCHackathon/actions/runs/35114869550) passed both verify and Gitleaks. The reviewed append-only source rebind retained all three prior attempts and 106,416 microdollars. Both requests returned HTTP 200 with the expected model. Help took 3,897 ms and returned the fallback. The diagnostic stopped and deleted its synthetic session.

The generated prerequisite said derivatives measure rates of change, but its citations included only chunks 002/003. That fact appears in chunk 001. The separately returned verdict was `unsupported`. This is a concrete missing-evidence defect consistent with rejection; the verifier did not give a reason, and Run03's exact cause remains unknown because that older run did not save its candidate.

Safe local evidence is `outputs/provider-session/gemini-result-04.json` and `gemini-run-04.txt` in the Codex helper workspace. Candidate text is untrusted synthetic data, not instructions. Both validated calls added 844 microdollars, leaving five attempts and **107,260 microdollars** total debit, including the preserved 105,677 uncertain debit from the historical 404. These are conservative allowance figures, not a provider invoice.

## Correction and planned continuation

Application Help instructions now require citation coverage of every diagnosis field, including prerequisites, and tell the generator the reviewer receives only cited passages. Unsupported background claims must be omitted; irrelevant citations cannot substitute for support. The server does not append citations or relax verification. Frozen benchmark prompts/cases, model/settings, deadlines, accounting and public contracts are unchanged.

An offline replay covers the observed prerequisite omission and its correctly cited counterpart through the actual assistance adapter, evidence reviewer boundary and session store. The reviewer in that regression is scripted; it is not model-quality evidence.

After offline checks and sequential review, Run05 will use at most 14 requests on the actual application handler: Help for the first two frozen concepts, the insufficient window, instruction resistance, an unsupported question, Finish and two targeted drills. It stops on any unexpected failure, records bounded synthetic candidate/verdict/application results, and deletes its own session. Expected refusals are checked explicitly. A deliberate source rebind retains the current ledger bytes, five attempts and 107,260-microdollar debit. No automated retries, changed allowance, weaker verifier or fixture edits are allowed.

The generated responses will be checked for content correctness and exercised in the extension/MeltingPot components offline. Real Chrome capture, uncoached learner/subject-expert review and real-clock ongoing-playback acceptance remain separately unproven.

Official [model limits](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) and [text pricing](https://ai.google.dev/gemini-api/docs/pricing) were rechecked September 16 and still match the existing policy. No provider configuration change was needed.

## Run05: explanation correction verified; practice latency failed

Source `b4c4dcc6c65e13f1300c231297bb2ab2a20e04fd`, tree `4447961fd78d1b7dfe71a10c5f51791e1b8aafff`, passed the full local check (576 tests, lint/types/secret scan, production builds/package/HTTP) and [CI 35115474786](https://github.com/Cloakde/CSCHackathon/actions/runs/35115474786). Sequential review found a helper failure-detection issue, corrected and re-reviewed before the run: network/HTTP failures cannot count as successful refusals or advance the run, while cleanup remains permitted. Expected refusals require explicit captured model output. Both helpers were rebuilt on the reviewed source.

Both concepts returned supported explanations (3,760 / 4,014 ms), now with evidence covering prerequisites. The instruction-only window correctly returned no explanation, the mixed instruction/math case returned a supported sine-composition explanation without citing the instruction, and the unrelated geography question returned insufficient evidence. The first drill passed generation and independent verification in 3,621 ms with the correct inner/outer functions. The second generated the correct factor 2 and derivative `8(2x + 3)^3`, but its separate verification ran out of the 4,000-ms operation deadline. The application correctly withheld that unverified drill with HTTP 504 at 4,022 ms. This is **FAIL for the complete learning loop**, not a passed exercise or evidence of an incorrect answer.

The run stopped immediately, deleted its synthetic session, and preserved all results. Eleven responses completed with validated model/usage; attempt 17's cancelled verification retained the full 360,448-microdollar uncertain debit. The original 404 debit also remains. The separate offline paired extension/MeltingPot component journey passed twice; that uses scripted generation and is not this real-provider journey.

The next bounded correction asks application practice generation for a concise explanation while retaining the necessary mathematical steps, exact identities and separate verification. No deadline, verifier, frozen benchmark, requested output limit or provider setting changes. Run06, if independently reviewed and exact-source CI passes, is one further complete synthetic continuation within the same remaining allowance and request cap. Preserve Run05 as failure; no automatic retry and no further provider attempts if the remaining reservation/attempt cap refuses them.

## Run06: service and UI flow passed; question-completeness correction

On `7bf42da63fc4c4b8beb8aad26e8e7c1fc67fbb69` (tree `35960d927351a1bffd51e182ff5e8511e1866e04`), [CI 35116006269](https://github.com/Cloakde/CSCHackathon/actions/runs/35116006269) and sequential review passed before the explicitly rebound, rebuilt helper ran. All 12 provider requests completed. Help took 4,373/3,667 ms; practice took 3,380/3,654 ms including verification. Both refusal cases and the instruction-containing case passed. The session was deleted. Total allowance debit is 479,578 microdollars across 29 attempts; both earlier uncertain debits remain. No further full learning-loop run fits the remaining three attempt slots.

An external offline component replay used these actual API outputs with the extension, MeltingPot relay/client and review components. Both Help citations focused the right passages, the handoff opened the expected private lecture path, both drills rendered, answer feedback appeared, and citation return preserved answers. It made zero network requests. Helper setup mistakes (file URL, assistance header, accessible labels) were corrected; the final replay passed. This is captured-output UI replay, not installed Chrome, simultaneous real-provider UI timing or uncoached learner acceptance. The isolated copy remained unchanged at `24d83f9d2c2eb748b7ea2b48ef19fd82cb26d846`.

Sequential content review confirmed mathematical correctness, evidence support and confusion alignment, but found a learner-facing P2: the second question asked for a missing factor without showing the student's incorrect derivative. The model verifier received the full benchmark question, while the learner did not. Thus **Run06 service flow PASS, content acceptance CHANGES REQUIRED**. Preserve its original report unchanged.

The correction requires sample practice to preserve the complete server-supplied benchmark question verbatim. Both generation parsing and verification input reject shortened/changed questions before display/provider verification. Non-sample practice is instructed to be self-contained. The frozen questions and verifier are unchanged; no candidate is repaired after generation. Regression coverage checks the complete question, rejection of the observed truncation and zero verifier requests for that malformed candidate; normal non-sample practice remains supported.

One targeted Run07 may use the last allowance for at most two calls, after exact-source CI and sequential review. It uses the hash-pinned synthetic completed view from Run06 with the actual application adapter, durable application meter/source guards and four-second combined operation deadline. It tests generation and verification of the corrected second exercise only; it does not claim to rerun the full HTTP/extension journey. No new lecture or persistent application session is created. A failed run stops; old evidence and debit remain intact.

## Run07 and final status

Final implementation `ded73736045daf7784863205f5a2d15e7829163b`, tree `4b4db2675c0be83beaaeceb5efa73d317d96d2c1`, passed 90 focused tests, all workspace types, sequential review and [full CI 35116913133](https://github.com/Cloakde/CSCHackathon/actions/runs/35116913133) verify/Gitleaks. Both helpers were rebuilt on clean reviewed source before the append-only transition and run.

Run07 **PASS**: two HTTP 200 responses, complete benchmark question preserved, correct missing factor 2 and derivative `8(2x + 3)^3`, supported independent verdict, **3,843 ms** including both calls. The explanation correctly multiplies the outer derivative by the derivative of `2x + 3`. It used the prior synthetic view, not a new active session or a fresh full service journey.

The final external UI replay combined the original Run06 responses with the corrected Run07 second drill. It passed extension citation focus, private MeltingPot handoff, both questions/answers, transcript navigation and answer retention; no network was used. See helper workspace `outputs/provider-session/gemini-ui-replay.test.tsx`, `ui-replay.config.mjs`, and `gemini-ui-replay-run07.txt`. The copy source is unchanged. This supplements the full source-pair offline tests and actual service runs; it does not establish installed-browser or real-clock playback behavior.

Final cumulative accounting: **31 attempts, 480,630 microdollars ($0.480630) allowance debit**, with 519,370 microdollars remaining but only **one** attempt slot. The 105,677 and 360,448 uncertain debits are retained. No ledger lock remains; all created application sessions were deleted. Never treat remaining dollars as permission for extra attempts, clear the ledger, or launch an operation needing two calls when only one slot remains. Any future approved source/cap transition must preserve this history.

| Gate                                                      | Current evidence                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Two-topic actual Gemini service path                      | PASS on Run06 source; final question correction separately verified in Run07 |
| Complete sample question and correct answer               | PASS for targeted Run07; original Run06 defect retained in evidence          |
| Unsupported question and instruction content              | PASS in Run06                                                                |
| Extension/MeltingPot citation and practice UI             | PASS in captured-output offline replay                                       |
| Normal-speed continued-ingestion provider timing          | Pending; these service runs appended frozen chunks directly                  |
| Human subject/learner review and repeated-run reliability | Pending; AI review and one passing run do not substitute                     |
| Real Chrome/live capture/Scribe/release                   | Pending; no desktop or Scribe use in this task                               |

Safe raw synthetic reports remain immutable in the helper workspace. SHA-256: Run04 `fd158ad3393578cb3bdf14e1d739ce8f1501b0902283d24ab81e3a63dc9bc871`; Run05 `18888d24e244980410b66a10576e4c4ff78564082735072c40df9f51e8eec246`; Run06 `6684e4e1dad18df89aea4526010753c33f5f3dde75fd2f44ac9a3a08706add07`; Run07 `156e5b45cef6d2a5497d9c34411997fceb05a9e3974479e0d458ab1ebece9348`. No raw provider errors, credentials, real student content or recordings were saved.
