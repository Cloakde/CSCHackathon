# TASK-309 — Private study continuity evidence

## Result and source

The user's autonomous MeltingPot continuation implements three bounded study milestones in the isolated copy: retained per-topic exercises/answers, exact-source flashcards and personal review queue, and explicit portable study-file download/import. See [the study guide](STUDY_GUIDE.md) and [ADR 0014](../../adr/0014-private-study-files.md).

Starting source: LiveLecture `f35d475bdcebd39e3b1d763a2cd7ac798df40d9c`; isolated copy `4534dba6bb490d3a4c95bce499656aee5b8f4c52`. Delivered copy: **`24d83f9d2c2eb748b7ea2b48ef19fd82cb26d846`**, clean local branch with no remote. Primary runtime is unchanged; its only code change is the extended paired test. No main merge or original MeltingPot changes.

## Automated checks

- Guarded copy lint, types, **383 unit/component tests in 27 files**, and production build: PASS.
- LiveLecture full check: PASS — formatting, lint, secret scan, types, **547 tests** (24 root, 73 shared, 288 web, 162 extension), production builds, ordinary extension verifier and production demo HTTP check.
- Extended paired component journey: **2 PASS**, using prewritten and mock-Gemini status. Actual extension/service/relay/review components cover two different concepts, answers retained across switches without new requests, export of generated exercises, deletion, import and study with zero new service calls.
- File checks cover round-trip evidence and progress, unknown versions, forged verification metadata, wrong session/concept/evidence links, duplicate IDs, invalid bookmarks/ratings, answer bounds, UTF-8 byte limit, every raw collection limit, safe text rendering and stale/cancelled file reads. Imported files never generate missing practice or delete service sessions.
- Exact paired production HTTP check and final GitHub CI: pending checkpoint below.

The first new test run had one failing Unicode-length expectation; adjusted the test to the schema's character semantics and added a structurally valid multi-byte file that exceeds the byte cap. Final checks above pass. Existing toolchain warnings about future Vite configuration loading and shell argument deprecation remain; they are not runtime failures.

## Sequential independent review

`task309_review` reviewed the diffs and new files while author edits were paused. It found one P2: schema validation visited malformed array children before collection bounds were applied, allowing excessive memory allocation within a small import. Added shallow preflight limits for all eleven collections before canonical validation, without editing frozen schemas. Regression tests prove oversized collections are rejected before their children are inspected.

Follow-up found the P2 resolved and no additional P1/P2 in the correction. Its diagnostic actual-module probe of a 90,974-byte malformed file improved from roughly 385 ms to 3 ms; these are one-machine diagnostic observations, not a performance guarantee. No source review substitutes for browser/human acceptance.

## Limits and remaining acceptance

No API calls, credential inspection, real lecture data, recorded audio, browser/desktop control, inherited service/database tests, deployment, main merge or submission occurred. The original MeltingPot repositories/services remain excluded. The copy retains its existing branch, no remote and its push guard. No automatic browser or server persistence was added.

Study-file contents are editable and untrusted. Structure/link checks do not prove text accuracy or AI provenance. Download is explicit; files remain private user-managed copies, unaffected by deletion of the original session. Imported study needs the local MeltingPot app but not the LiveLecture service. Missing exercises cannot be generated while imported.

Next acceptance tasks remain the permitted clean-profile Chrome/keyboard/visual journey, uncoached learner and subject review, capped real Scribe/Gemini checks, judge access and submission review. This task completes implementation of its three scoped milestones; it does not mark all of M4/M5/M6 PASS.
