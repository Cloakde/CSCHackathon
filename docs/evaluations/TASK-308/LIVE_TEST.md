# Prepared live test — not yet run

Keep the normal demo on Simulation Mode. This card is for a later authorized test session, after independent source review and the TASK-101 Chrome checks / TASK-102 Scribe smoke. Coding permission does not grant control of the user's desktop. No actual provider result or Chrome PASS is recorded here.

## Concrete proposed run

- Data: only the supplied 54.16-second synthetic calculus speech, generated locally with Windows speech synthesis. No classroom recording, microphone or student data. Source: `scripts/manual/live-test-lecture.txt`; player: `http://127.0.0.1:3000/live-test-lecture.html`.
- Transcription: ElevenLabs Scribe v2 Realtime, PCM16/16 kHz, VAD, logging disabled in the socket configuration. At most two issued tokens/connections, 90 seconds per source and five minutes for the test server. Across two starts the client can send at most 180 seconds. Stop after the first useful complete test; do not consume the second slot casually.
- Proposed Scribe allowance: $1 total for this one local run; currently **not authorized or consumed**. The launcher reserves the whole allowance durably before starting. Restarting cannot grant another allowance. Do not delete/rename its `.git/livelecture-live-test-allowance-v1.json` to retry.
- Optional Gemini: uses the existing source-bound shared $1/32-attempt ledger, not a new budget. Generation and independent verification each count as provider calls. A prior reservation is not reset by this task. Without separate Gemini authorization, live questions/practice can be unavailable; recent excerpts still work.
- Permanent keys remain in the local server's environment. The extension gets a temporary run code and short-lived Scribe tokens only. Never paste provider keys into the extension, chat, tracked files or a command argument.

Public [ElevenLabs API pricing](https://elevenlabs.io/pricing/api), checked 2026-09-15, lists Scribe Realtime at $0.39/hour in the API rate summary. That suggests roughly $0.02 for 180 seconds, before account-specific billing effects. Verify the account's actual terms before execution; the $1 proposal is an allowance ceiling, not a claim of zero cost or a purchased subscription. [Realtime API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) describes the selected socket.

## Setup after permission

1. Match both repositories to the exact reviewed commits in the handoff/package manifest. Preserve dirty files. Run the offline checks first. Confirm ports 3000 and 3111 are unused; do not stop unrelated processes.
2. Run `node scripts/manual/verify-live-fixture.mjs`. Expected WAV SHA-256: `434e16108b89c86d840235cf9ce52ffdc6945f12b33439e2bc2085bd15538a35`. The fixture is mono PCM16 at 16 kHz, 54.16 seconds. For TASK-102's existing smoke, use `--smoke-pcm-output=ABSOLUTE_PATH`: this exports only the first 30 seconds to match that harness's stricter limit and prints the short-file hash. For the full fixture, `--pcm-output=ABSOLUTE_PATH` exports all 54.16 seconds; its expected PCM hash is `c51b1eba24fcdc97e5212b436dbb70f83525e57716bcf4a7e2257eec3d20140e`. Both options refuse overwriting. Do not give the longer file to the 30-second smoke harness.
3. Build the separate extension: `npm run build --workspace=@livelecture/extension -- --mode live-test`. Load `extension/dist-live-test` yourself in Chrome. Its displayed name ends in **LIVE TEST**. This build is not the ordinary release ZIP. Record its exact extension ID. Do not include a key in build environment variables or local `.env` files.
4. Set up server-only credentials using the existing TASK-306 / TASK-101-102 runbooks. In a newly approved operator session, use the actual clean source tree and extension ID:

   ```powershell
   $reviewedTree = git rev-parse 'HEAD^{tree}'
   node scripts/manual/live-rehearsal.mjs --execute --synthetic-only --approve-scribe-usd=1 --approve-audio-seconds=90 --source-tree=$reviewedTree --extension-id=YOUR_32_LETTER_ID
   ```

   Add `--gemini --approve-usd=1` only when the shared Gemini allowance and data use were separately approved. No-argument invocation is always an offline plan. The launcher builds without credentials, checks source/flags, starts only loopback port 3000 and never opens a browser. It gives the location of a temporary code file, not its value. Read that file locally and paste its contents into the extension's **Temporary live-test code** field. That code is not an API key. The file is removed on normal shutdown; an abrupt OS termination may require deleting that exact temporary code file after stopping the owned server. Preserve the allowance record.

5. Start the isolated MeltingPot copy with its guarded preview command from the release guide. Open the synthetic player yourself. Click the extension toolbar icon on that tab, select **Live test**, enter the temporary code, consent, and click the toolbar icon again. Wait for live readiness, then play the audio.

## Evidence to record

Record source/package hashes, Chrome version, explicit consent and data/allowance approval, test start/end, and actual provider usage without keys/tokens, raw response dumps or real lecture data. Keep transcripts synthetic. Use PASS/FAIL/PENDING for each check:

| Check                             | Expected                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary installation             | Simulation only; no capture/token/socket calls                                                                                                        |
| Consent and same-tab second click | Capture starts only on the disclosed tab; visible REC badge and Stop                                                                                  |
| Sound                             | The lecture remains audible once, without echo                                                                                                        |
| Transcript                        | Real words arrive with defensible offsets; no fixture text substituted; final incomplete passage may be omitted                                       |
| Help and two topics               | Gemini answers are checked and cited; inner/outer versus inner derivative produces different practice targets                                         |
| Errors                            | Refused key, network loss, transport warning, tab close/navigation, worker restart and expired budget have visible outcomes and stop their owned work |
| Panel close                       | Integrated test audio/socket end within six seconds; reopening does not pretend to restore the lost panel session                                     |
| Finish                            | Validated live session opens in MeltingPot with a Live test label; practice uses that session's confusion evidence                                    |
| Notes/delete                      | Bookmarks/source export work; delete clears local lecture/practice; downloaded files remain explicitly user-managed                                   |
| Shutdown                          | Owned processes/code file cleaned; permanent credentials and raw audio absent from extension/storage/logs                                             |

A failed or unperformed check is not PASS. Long lectures, background continuity, production authentication and durable storage are outside this 90-second feasibility candidate. Do not remove the ordinary Simulation fallback or lift its live gate based on automated tests alone.
