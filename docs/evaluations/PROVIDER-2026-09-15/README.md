# Bounded provider test — 2026-09-15 Pacific

**Result: Gemini BLOCKED before provider use; Scribe FAIL after real provider use.** Neither result establishes live extension readiness. The user saved credentials privately and authorized testing for this session. Synthetic text/audio only; no browser capture, real classroom data, account changes, main merge or original/isolated MeltingPot edits.

## Gemini

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

The production transport explicitly selects VAD and sends `commit: false`; finalization therefore depends on speech/silence segmentation. The smoke generator simply crops the first 30 seconds of the longer speech fixture. Offline measurement found a longest exact-zero interval of 745.125 ms; even at absolute PCM amplitude 512, the longest continuous quiet interval was 954.25 ms. The final drain waits without sending silence. This supports **insufficient silence as a likely cause**, but does not prove how the provider classified the audio or rule out other issues.

The current [ElevenLabs commit guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies) describes VAD commits after silence and illustrates a 1.5-second threshold. The [realtime reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) defines delayed timestamps after commits and says a retention warning means zero retention was not applied. References checked September 15 Pacific. The implementation does not explicitly set a silence threshold, so the example is not evidence of the session's exact threshold.

Before another paid Scribe run, prepare and offline-check a fixture with deliberate speech/pause boundaries within the same audio cap, including a final transmitted silence, and make safe failure summaries retain counters. Do not turn drafts into finalized transcript chunks or weaken timing/reconnect checks to obtain a pass. Retention remains a separate acceptance blocker; no real lecture content should be used based on this result.

After the user replaces Gemini's entry, continue the existing source/policy-bound $1/32-attempt service check; preserve any created ledger. Human model-quality, real Chrome capture, live timestamp/reconnect behavior, provider retention and final release acceptance remain open. Default builds remain Simulation Mode.
