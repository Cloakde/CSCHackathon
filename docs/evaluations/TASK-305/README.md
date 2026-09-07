# TASK-305 — Offline lecture questions and recap evidence

Starting source: clean shared `367aab29d7dd3f1a6866799f8934a60473a2f032`. Codex owns this user-authorized turn on `shared/livelecture`; no concurrent agents or main promotion. See [the task contract](../../tasks/TASK-305.md) for the narrow amendment allowing these two simulation features before the earlier M4 hold.

## Implemented behavior

- Ask exposes four supported questions covering inner/outer functions, the chain-rule statement, the worked power example and the missing inner derivative. It returns exact canonical lecture quotes only after all supporting passages arrive. Capitalization, spacing and trailing punctuation can vary; keyword matches and other questions do not manufacture an answer.
- Catch Me Up returns complete passages overlapping the two minutes ending at the requested last committed passage. A boundary passage can start earlier than that window; its exact timestamp is preserved. This is explicitly an extractive recap, not an AI-generated summary.
- Both use the existing private local request guards. The extension flushes uploads, records the acknowledged sequence, and validates the reply against that snapshot. Later uploads do not add future content to an older response. Reset, Finish, source replacement and unmount cancel/discard pending tools. Transcript ingestion and Help remain independent.
- Neither tool creates a confusion event, writes question history, records audio or calls a provider. The seven paired vendor schemas and the MeltingPot copy are unchanged. Existing Finish routing and the two-concept practice journey are retained.

## Checks

| Evidence                                             | Result                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh locked install at starting `367aab2`           | PASS, [CI run 34076675764](https://github.com/Cloakde/CSCHackathon/actions/runs/34076675764): repository verification and full-history secret scan                                                                                               |
| New shared source/evidence tests                     | PASS, 10 tests: all four questions, early/missing evidence, unsupported/instruction-like questions, recap windows, noncanonical/cross-session inputs and edited replies                                                                          |
| New local service and actual lecture-component tests | PASS, 12 tests: local access, invalid/oversized requests, active-session/rate/expiry guards, no provider/confusion side effects, delayed uploads/replies, continued transcript ingestion, Reset/Finish/source/unmount, altered replies and retry |
| Native keyboard/blocked-tool component tests         | PASS, 2 tests: Enter submission, tab/Enter citation activation, disabled tools during transcript-save failure                                                                                                                                    |
| Type checks                                          | PASS, all three workspaces                                                                                                                                                                                                                       |
| Full repository checks and production HTTP           | PASS: format, lint, source secret scan, types, 336 tests (7 launcher + 62 shared + 218 web + 49 extension), production builds, extension package and actual local HTTP Ask/recap/Help/practice/deletion/access guards                            |
| Guarded existing MeltingPot component journey        | PASS: 1 additional test. Copy remained clean at `9244a641e0639982d4eece09b2274a05ee355096`; both local ports free after checks. Existing Vite future-config warning is unchanged.                                                                |
| Final PR CI                                          | Pending new source; [PR #5 checks](https://github.com/Cloakde/CSCHackathon/pull/5/checks)                                                                                                                                                        |

Initial test-authoring failures used the wrong Reset button label and expected HTTP 400 instead of the existing 413 oversized-body response. Those assertions were corrected without changing product behavior. Focused tests then passed. Logs are in the local task workspace's `outputs/task305-*.log`; they contain only synthetic test data.

Local extension package SHA-256 checksums after the passing build:

- `manifest.json`: `af7746940cade7087e537659d729ef9063dc6696e4cfb601ed9a0af3bd75358c`
- `sidepanel.js`: `7fd3bf359208fe22471a549d6037bb98b67a194b9c0c4f2e78cfd111ddb8ced5`
- `assets/sidepanel-bBonyoya.css`: `d140f12893db92f6b521edc7ce712d4d8ca62316ed9bff2b4bbad94f89ef836a`

Existing recovery coverage includes delayed Start, failed/retried deletion, pending upload/Help/Finish, service errors, wrong-session practice, retained answers on citation return and deletion. No additional core defect was demonstrated in this pass, so no unrelated recovery refactor was made. Full existing coverage is rerun with the new tools.

## Limits and next review

This proves deterministic offline behavior, not general semantic Q&A, real Gemini output quality, live audio, Chrome lifecycle/layout, accessibility in an actual browser, uncoached learner success, production privacy or judge access. No browser/laptop control or provider request was used. The separate paired HTTP/browser check remains pending because it needs the rework service/session permission; the guarded component test alone does not establish it.

Independent review must check the exact shared head, the new source and evidence tests, and the still-unapproved TASK-304 corrections. Do not restore Gemini's old feature commit wholesale, activate the provider or self-merge. The user chooses when another AI takes the turn.
