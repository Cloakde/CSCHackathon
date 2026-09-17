# Bounded provider test — 2026-09-15 Pacific

**Latest result: Gemini key/model connectivity verified; grounded Help smoke FAIL. Scribe FAIL after real provider use.** Neither result establishes live extension readiness. The user saved credentials privately and authorized testing for this session. Synthetic text/audio only; no browser capture, real classroom data, account changes, main merge or original/isolated MeltingPot edits.

## Gemini model update and real RunId 03

At commit `64ec615898b6f7ffc88587b0a4e9442cd1dcc320`, tree `8e499c2aa83f476aca27fc1588d87c8993bea607`, the direct model became stable `gemini-3.1-flash-lite` with explicit minimal thinking. [ADR 0012](../../adr/0012-gemini-assistance-direction.md) records current documentation, prices and conservative bounds. Full checks passed **574 tests**, production builds/package/HTTP verification; sequential review found no P1/P2. Exact-source [CI 35055011077](https://github.com/Cloakde/CSCHackathon/actions/runs/35055011077) passed verification and Gitleaks before provider use.

The credential-free maintenance helper appended a source/policy transition to the same authoritative ledger after checking its previous full hash. All original bytes, attempt 1 and its 105,677-microdollar uncertain charge were preserved, with an exclusive backup. Current policy hash: `cc7fb0ee225cc251eaf850215ddd0ce3b3da15eb5ae2d59f637dd365b6ee2f1c`. It granted no additional dollar or attempts.

From **2026-09-16 04:18:41.165Z to 04:18:44.914Z**, the production service made two real Google requests using only the canonical synthetic first topic. Both returned **HTTP 200** with matching model identity and independently validated usage:

| Cumulative attempt | Call              | Input tokens | Billed output tokens, including thinking | Accounting debit, microdollars |
| ------------------ | ----------------- | ------------ | ---------------------------------------- | ------------------------------ |
| 2                  | Help generation   | 602          | 275                                      | 563                            |
| 3                  | Help verification | 636          | 11                                       | 176                            |

The Help route returned HTTP 200 with its safe insufficient-evidence fallback and `gemini_failed` after **3,095 ms**. Therefore the complete smoke is **FAIL**: it stopped before the second topic, Finish and practice. Its own synthetic session was deleted; no retry followed. The key and model connection work, but that does not establish a supported answer or successful learning journey. Raw candidate/verifier content was deliberately not persisted, so the exact reason for rejecting the answer is not established by these logs; do not assert a specific bad claim or weaken the verifier based on this result.

Total ledger debit is **106,416 microdollars**: the prior uncertain 105,677 plus the new validated 739. Three attempts count against the original $1/32 ceiling; no lock remains. Accounting is not a measured invoice delta. No Scribe call, desktop action, real lecture data or MeltingPot change occurred.

Safe local artifacts: `outputs/provider-session/gemini-migration-03.txt`, `gemini-run-03.txt` and `gemini-result-03.json` under the helper workspace. Result SHA-256: `780cf53bc5b1bd86aa407ac83918e38e88c99ba7d8480baaefafc1661cca0367`. Next is a reviewed, bounded synthetic diagnostic/quality run that retains enough safe candidate/verdict evidence to explain the fallback, preserves the remaining allowance and makes no automatic retries. Default builds remain simulation; no new key entry is required.

## Gemini key-format diagnosis corrected

The user's follow-up exposed a local validator bug. Google's [current key documentation](https://ai.google.dev/gemini-api/docs/api-key) describes authorization keys as the default for new AI Studio keys. A secret-safe local boolean check confirmed the existing saved entry uses that format, includes a dot, fits the existing bounded ASCII length and has no surrounding whitespace. The helper and shared transport incorrectly excluded dots. The earlier instruction to replace the key was unnecessary; this local rejection never proved that Google would reject it.

The correction permits dots while retaining length, whitespace/control-character and unsafe-header rejection. The helper now reports a precise input instruction instead of asserting that the value is not a key. Both saved credentials were preserved unchanged. Offline evidence: **90 focused transport/application tests**, full type checking and **six fake helper-input checks** passed. A sequential read-only review found no P1/P2 and approved resuming the previously authorized bounded Gemini RunId 02 after a successful full offline check, clean checkpoint and fresh bundle. Model/settings/limits and all prior records remain unchanged; no Scribe retry is authorized by this correction.

The full offline `npm run check` subsequently passed: formatting, lint, secret scan, types, **559 tests (24 root + 73 shared + 300 web + 162 extension)**, production builds, ordinary extension-package verification and production HTTP demo. These checks made no provider calls.

## Gemini corrected-source real attempt

Commit `467d12cfda0ca11434a20e311b33e053d1252e76`, tree `bac06573df39d121682343989ce4b08e09c0ccfe`, passed [CI verification and Gitleaks](https://github.com/Cloakde/CSCHackathon/actions/runs/35054244389). The exact-source external bundle was rebuilt without credentials before using the already-saved key for RunId 02.

From **2026-09-16 04:06:50.142Z to 04:06:51.645Z**, the real production service created a synthetic session, appended its first topic, and made **one Google request**. Google returned **HTTP 404**, classified by the bounded diagnostic reader as `model_unavailable`, for the pinned `gemini-2.5-flash-lite` endpoint. The help route returned HTTP 503 / `gemini_failed`; the runner stopped and deleted its session. No verification/practice call, generated output, automatic model fallback or retry followed. This proves the key-format gate is fixed and the request reached Google; it does not establish full authentication, model quality or live extension acceptance.

The existing shared ledger now contains open/reserve/settle records for attempt 1. Because the provider returned no validated usage, **105,677 microdollars ($0.105677)** remain counted as uncertain cost under the original $1/32-attempt cap. This is a conservative budget debit, not a measured account charge. No ledger lock remains. Preserve the ledger and its source/policy identity; a future model/settings update needs reviewed accounting continuity, never a new allowance obtained by deleting the old ledger.

Safe artifacts outside Git: `outputs/provider-session/gemini-result-02.json` (SHA-256 `159ee80cc7d4be0cb927552f14869d70981d5de4c8a2671c6f8f25828c5e3274`) and `gemini-run-02.txt` under the helper workspace named below. No key replacement is required by this result. Next is a reviewed model/configuration compatibility update with current official pricing/settings and carried-forward prior spending. Scribe was not retried.

## Gemini initial attempt — historical local rejection

The production application service was exercised at commit `e1a942838e246618371b38c2958fb4f97094fe34`, tree `5f6fb20197f2f8e12eae68a0af3eb9ba90273a15`. Session creation, synthetic transcript append and cleanup succeeded. Help returned HTTP 503 with `gemini_blocked`: the saved Gemini entry failed the existing credential syntax validation. The diagnostic fetcher recorded **zero provider requests**, and the shared trial ledger did not exist after this attempt. No AI output or quality evidence was obtained.

An earlier external runner bundle failed locally; it also made no provider request. Both failed records were preserved. The private `Update-GeminiKey.ps1` helper replaces only the encrypted Gemini entry, preserves ElevenLabs and backs up the encrypted file. The user was asked to run it; replacement remains pending. Never paste credentials into chat or store them in the repository.

## Scribe

The first launch stopped before the provider harness because Windows listener verification exceeded five seconds. A credential-free reproduction confirmed the timeout. Commit `c73a501c16c5235d7fcf08b6ede9f11ff2710080` increases that one lookup to 15 seconds, retaining exact loopback address/PID verification and the overall smoke deadline. All **15 manual-launcher/rehearsal tests passed**; a real Windows preflight then passed without credentials, tokens or provider traffic. A sequential read-only review found no P1/P2 in this change or the single continuation that preserved the original allowance.

The real continuation ran at that commit, tree `5e1eaf431f3197c1144ee2061a30ad094da6bf3c`, from **2026-09-16 03:40:25.060Z to 03:41:19.675Z** (20:40–20:41 Pacific on September 15), including local build/startup. It used the actual bundled production transport and a synthetic headless client origin, not an installed extension identity.

| Observation                           | Result                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Listener and transport artifact       | Verified before the provider harness started                                         |
| Synthetic mono PCM16 at 16 kHz        | 30 seconds, paced in 100 ms chunks                                                   |
| Canonical draft transcript events     | 31, sequences 2–32                                                                   |
| Canonical finalized transcript events | 0                                                                                    |
| Forced reconnect                      | Not reached; requires a finalized segment first                                      |
| Retention                             | `RETENTION_ACTIVE` warning received                                                  |
| Stop                                  | Gap samples 0–480000 reported; owned server stopped; no port-3100 listener afterward |
| Account charge                        | Not independently measured; no claim of zero cost                                    |

The success-only counters were not emitted because the harness failed, so exact token/connection totals are not an independently recorded result. The configured hard bounds were 30 audio seconds, 90 transport seconds, two token issuances, two connections and one planned reconnect. The original **$1 Scribe reservation** and exclusive zero-additional-allowance continuation record remain under the Git common directory. No further provider attempt followed this failure. Do not delete/reset either record to retry.

Artifact SHA-256 values:

- Actual transport: `982f5e5fb881ce43b05a934d7158ad15769fa5e2211859f5ab13696bd53aefc6`
- Input PCM: `713a5ae25363320631fdb99bd3334a7147d6aa66ff540fda6fdefc4abae26dc4`
- Safe Scribe run log: `be1e8457e98e07189150576203235fce226f4bd88337d81b261ba1553a1c3a8a`
- Scribe result JSON: `10bcc4da840ce82237bdeee9c1d8cfafcced879dd67fef2777663644341a33a9`

Local raw-safe artifacts remain outside Git in `C:\Users\abuiz\Documents\Codex\2026-09-04\you-are-taking-over-the-livelecture\outputs\provider-session`: `scribe-run-01.txt`, `scribe-run-02.txt`, `scribe-result.json`, `scribe-result-02.json`, `gemini-run-01.txt`, and `gemini-result.json`. They contain safe status/event metadata, not credentials, token URLs or transcript text.

## Diagnosis and next attempt

**Offline follow-up, September 17:** the paused fixture, failure counters and stricter recovery check are now implemented; see [correction evidence and remaining gates](../SCRIBE-OFFLINE-2026-09-17/README.md). No new provider attempt occurred, and the original fixture/reservation/failure record remain unchanged. The historical diagnosis below explains why this work was needed.

The production transport explicitly selects VAD and sends `commit: false`; finalization therefore depends on speech/silence segmentation. The smoke generator simply crops the first 30 seconds of the longer speech fixture. Offline measurement found a longest exact-zero interval of 745.125 ms; even at absolute PCM amplitude 512, the longest continuous quiet interval was 954.25 ms. The final drain waits without sending silence. This supports **insufficient silence as a likely cause**, but does not prove how the provider classified the audio or rule out other issues.

The current [ElevenLabs commit guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies) describes VAD commits after silence and illustrates a 1.5-second threshold. The [realtime reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) defines delayed timestamps after commits and says a retention warning means zero retention was not applied. References checked September 15 Pacific. The implementation does not explicitly set a silence threshold, so the example is not evidence of the session's exact threshold.

Before another paid Scribe run, prepare and offline-check a fixture with deliberate speech/pause boundaries within the same audio cap, including a final transmitted silence, and make safe failure summaries retain counters. Do not turn drafts into finalized transcript chunks or weaken timing/reconnect checks to obtain a pass. Retention remains a separate acceptance blocker; no real lecture content should be used based on this result.

The corrected-source Gemini attempt above supersedes the initial request to replace its key. Preserve its now-existing ledger when preparing the model/settings update. Human model-quality, real Chrome capture, live timestamp/reconnect behavior, provider retention and final release acceptance remain open. Default builds remain Simulation Mode.
