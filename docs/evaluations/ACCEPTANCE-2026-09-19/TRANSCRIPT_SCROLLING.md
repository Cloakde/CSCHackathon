# Native transcript scrolling correction

September 19 Pacific / September 20 UTC. This is a narrow correction found during normal-speed native Chrome use, not a new feature or whole-milestone acceptance.

## Reproduced defect

Starting from primary `0809927d8ab78405790ef15a116ca6b9f52b7902` (ordinary runtime `c977921`), incoming partial and committed transcript text repeatedly moved the entire side panel to the transcript. This displaced **I’m Lost** during 1× playback and caused an attempted help click to land on the transcript instead. That attempt is incomplete, with no successful first help or two-topic PASS claimed.

The source used `scrollIntoView` on an end-of-transcript element. That API can scroll ancestor containers as well as the transcript. Automatic updates now use `scrollTo` on the transcript container itself. Explicit citation navigation still brings its passage into view and focuses it; selected citations suspend following until **Follow latest** is chosen. Reduced-motion preference is preserved.

The interrupted attempt's external evidence is in `outputs/acceptance-20260919/native-1789885496055/` under the task workspace. `interrupted-ui-evidence.json` preserves native observations; `cleanup.json` confirms all six owned processes stopped and ports 3000/3111 closed. The panel was closed. That session was cleared by server shutdown, not by a successful UI deletion.

## Automated verification

- The focused extension component suite passes 32 tests, including two new normal/reduced-motion regressions for partial and committed updates, citation focus/freeze, and resuming transcript-only following.
- The first test attempt sampled 400 ms, before the fixture's first partial at 28 seconds / 60×. That test timing was corrected to 500 ms; production timing and the fixture were unchanged.
- The first full run exposed missing `scrollTo` mocks in five web test files that also render the extension. Their existing scroll mocks, and the paired component harness, now cover both browser methods. The failure is preserved in external `scrolling-check-1789886095894/check.log`; no product workaround or assertion was disabled.
- The corrected credential-free `npm run check` passes formatting, lint, secret scanning, types, **704 tests** (32 script, 73 shared, 426 web, 173 extension), all builds, packaged-extension validation and the production HTTP demo. Result/log: external `scrolling-check-1789886206875/`, exit 0. Two guarded extension/API/MeltingPot component tests also pass against the unchanged copy.

## Corrected native journey

Chrome reloaded the built ordinary extension, retaining ID `alpdibjjhlhlhbhjkoeblmlfcgoocclk`. Its manifest remains limited to the local demo origin, with no live-provider activation. The ordinary no-key previews started on loopback 3000/3111; the isolated copy stayed clean at `d03f99b14895c392355bcfa3c0c2985ad7073d31`.

1. Selected visible **1×**, started at `2026-09-20T06:39:40.107Z`, and never paused or changed speed. Partial and committed updates no longer scrolled the whole panel; help stayed visible.
2. At `06:42:12.931Z`, with committed progress 2:25, I’m Lost returned **Identifying inner and outer functions** while playback continued. Its 0:45 citation highlighted the correct passage. Selection survived the next committed passage; Follow latest resumed scrolling inside the transcript without moving the outer page.
3. At `06:44:55.357Z`, with committed progress 5:00, the second request returned **Remembering the inner derivative**. Both concepts appeared under Saved for practice. These timestamps record UI actions, not precise response-latency measurements.
4. Finish stopped the replay after the second help request and handed session `session_57722d1c7c2e4e5286347c10d5de7a07` to the isolated companion. This was not a complete eight-minute replay.
5. Both saved difficulties produced matching exercises for `(2x + 3)⁴`. The first answer identified `g(x) = 2x + 3` and `f(u) = u⁴`; the second identified the missing factor 2 and derivative `8(2x + 3)³`. Revealed answers agreed. Both 0:45 and 4:10 source passages highlighted correctly; return preserved typed answers and explanations. The second return was keyboard-operated; switching back to the first topic also preserved its answer.
6. Delete sample lecture and Confirm deletion displayed **Sample lecture deleted**. The test-created review tab was closed and the panel stayed closed. The corrected extension remains enabled/pinned. All six owned preview processes stopped, the controller exited successfully, and ports 3000/3111 closed. No study file was downloaded.

The unrelated security promotion partially covered the window; only unobscured Chrome controls were used, and that promotion/settings were left untouched. Refreshed snapshots were used after smooth scrolling settled. This is actual existing-profile native operator evidence, not a clean-profile, unaided learner or human subject review.

## Evidence identity

External task workspace: `C:\Users\abuiz\Documents\Codex\2026-09-04\you-are-taking-over-the-livelecture`.

Corrected run directory: `outputs/acceptance-20260919/native-1789886331972/`.

- `ui-evidence.json`: observed accessibility states, action timestamps and limitations; SHA-256 `61b978f23030e157c45fbe10248b6402fbf804971a66815ff42c3cfda547c0d9`.
- `tested-changes.patch`: tracked changes on base `0809927` at test start; SHA-256 `6f1c64f1d7276fae78f1972fa8cec61e4d7fb6b7b0b76e149ad81b1987600eba`. Later evidence-only edits are not part of this snapshot.
- `tested-build.json` and `extension-files.json`: source and all ten built-extension hashes. Tested `extension/src/App.tsx` SHA-256 `e6359e095e8a763fadd460fccb10f342a026031856f5b9c37c997068c8abab7c`; `sidepanel.js` SHA-256 `2151742b99888c4859256c337d9dff6284cbde2ecdb3c24b246ee0a226058ffa`.
- `started.json`, launcher logs and `cleanup.json`: ordinary local launch and successful owned-process/port cleanup.

## Remaining gates

Only the primary extension source/tests and coordination/evidence change. The isolated companion stays at `d03f99b`; original MeltingPot remains untouched. There is no provider request, credential access or audio capture. The existing `release/c97792142b8b/` package is preserved and does not include this fix; no new package parity, independent approval, main merge or publication is claimed.
