# Scribe smoke correction — offline preparation, 2026-09-17

**State:** implemented and checked at `0e8608551e2e12b3eca2741359b01d2bcd99930c`. Sequential independent review found no actionable P1/P2 and independently repeated all 21 focused tests. The full credential-free repository check passed: formatting, lint, secret scan, types, **582 tests (30 root + 73 shared + 317 web + 162 extension)**, production builds, default-off extension package and production HTTP demo. [CI 35197423864](https://github.com/Cloakde/CSCHackathon/actions/runs/35197423864) also passed on documentation checkpoint `cac2be7e2bd8ed87c9ce856b872e84eaefddc6d4`. No provider call, browser control, ledger change or live acceptance occurred.

The previous real smoke produced 31 drafts and no committed text. Its 30-second crop lacked a long speech pause, and its final local wait transmitted no audio. Insufficient silence is a plausible cause, not a confirmed provider diagnosis. That failed run and its spent allowance remain preserved in [the provider record](../PROVIDER-2026-09-15/README.md).

## Correction

- `verify-live-fixture.mjs --smoke-pcm-output=ABSOLUTE_PATH` now builds two copies of the existing synthetic introduction, each followed by transmitted silence, within the unchanged 30-second bound. The first 8.5 seconds end inside a measured quiet interval; the second copy starts at 15 seconds. This is a transport/reconnect probe, not a distinct-topic or accuracy benchmark. The 54.16-second browser fixture remains unchanged.
- Before creating a transport or minting a token, the smoke rejects fixtures missing two nonsilent sections followed by at least three seconds of exact PCM silence, including the end. Byte inspection establishes pause structure, not genuine speech or the provider's VAD classification.
- Every started smoke emits one safe final result on success or failure, after cleanup. It records token attempts/successes, socket creation attempts/successes, partial/commit counts, post-reconnect commits, offered/sent audio duration, discarded-gap count and retention warning status. No transcript, warning text, provider error, URL or credential is included. Sent duration means accepted by the transport's socket send, not independently confirmed provider receipt. Before-transport fixture/config rejection remains a local failure without a provider result.
- A late commit from the closing first socket cannot satisfy the requirement for a commit on the second connection. Canonical event validation, timestamp monotonicity, dropped-gap evidence and the 30-second/90-second/two-token/two-connection/one-reconnect limits remain intact. The production transport and default Simulation Mode are unchanged.

## Evidence

Credential-free manual launcher/rehearsal suite: **21 tests passed**. This includes the bundled production transport with scripted wire events; it is not a real service result. Regressions cover missing pauses before transport creation, failed token/connection counters, invalid-event redaction and rejection of first-socket commits as recovery evidence. Lint passed.

Deterministic preparation against the checked-in WAV:

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Existing WAV, unchanged  | `434e16108b89c86d840235cf9ce52ffdc6945f12b33439e2bc2085bd15538a35` |
| Full PCM, unchanged      | `c51b1eba24fcdc97e5212b436dbb70f83525e57716bcf4a7e2257eec3d20140e` |
| New paused 30-second PCM | `0dd2604c156933444bf362c59d82d84096d58ea28ab6d13e244f46a65df4869f` |

The new fixture has two qualifying pauses and 6.8101875 seconds of exact trailing silence. A prepared copy and timestamped check logs are outside Git in the helper workspace's `outputs/scribe-offline-20260917` directory. The old `outputs/provider-session/synthetic-30s.pcm` and its failed evidence are untouched. Exports refuse overwriting an existing file.

## Remaining acceptance

A future paid attempt requires fresh explicit capped authorization, exact-source review/CI, this fixture hash, preserved prior reservations and owned-process cleanup. Do not rerun the old exclusive continuation or remove its record. No automatic retry is approved. Actual commits, timestamps, recovery, account cost and retention still need real evidence. The earlier `RETENTION_ACTIVE` warning remains unresolved; this correction does not authorize real classroom content or live activation.

Official documentation checked on September 17: the [commit guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies) says VAD finalizes after silence, while the [realtime API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) defines configurable silence duration and delayed committed timestamps. The documented example's 1.5-second setting is not proof of the old session's default. A retention warning means the requested zero-retention mode was not applied. No production parameter or account setting was changed.
