# Rendered text contrast — 2026-09-18

**Measured corrections and independent review pass; refreshed packaging pending.** This closes a bounded technical gap in M5's contrast requirement. It does not establish full accessibility, human usefulness, native Chrome capture or release acceptance.

## Demonstrated defects and corrections

- The extension's question field inherited nearly white text over an explicitly white background: **1.12:1**. Its background now matches the ordinary dark controls (`#171b22`), and typed text measures **15.31:1**. Only `extension/src/styles.css` changes.
- The private companion's light-theme deletion confirmation measured **4.02:1**. Its lecture-only confirmation button now uses white text on a darker red: **6.33:1** at rest/focus, **8:1** on hover and **9.86:1** when pressed, in both themes. The same component handles closing imported study files. The shared button component, global theme, inherited screens and original repositories are unchanged.

Normal-size text needs at least 4.5:1; large text has a 3:1 minimum. The audit uses the rendered styles and preserves the exact results rather than rounding a failing ratio up. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Method and final measurements

The ordinary prewritten extension and guarded isolated companion ran in a disposable headless Chromium profile with synthetic data. Both local servers used their ordinary guarded launchers and a stripped environment. No key, paid launcher, provider grant, real audio, original service or native desktop input was used.

- Tool: locally pinned **axe-core 4.13.0**, `color-contrast` rule; its exact script hash and executed helper snapshots are saved with every run.
- **52 page-state/theme/width combinations:** eight extension states at 380/1280 pixels; nine companion states at both widths in light/dark themes. Coverage includes typed questions, Catch Me Up, Help/details, citations, Finish, overview, practice/feedback, flashcards, deletion, entry and imported study.
- **16 additional confirmation-button combinations:** default, hover, keyboard focus and pressed, at both widths in both themes. The recorded DOM states confirm actual focus/hover/pressed status. A separate controls-only probe also covers imported-file confirmation.
- **Zero axe violations** in the final sampled journey and confirmation checks. Axe leaves **450 repeated text observations inconclusive** because it cannot resolve the extension's background gradient. These were not silently counted as passes.
- All 450 gradient observations have a separate conservative bound PASS. The helper verifies the exact sole body gradient and absence of other ancestor gradients, filters or mix-blend effects. It temporarily renders the lower/upper background endpoints, preserves alpha overlays, and compares the lowest foreground luminance to the highest background luminance, with an outward RGB rounding allowance. The minimum bound is **6.09:1**, above the required 4.5:1. Original inline styles are restored afterward.
- Finite CSS transitions are finished only inside the disposable audit page before measurements. These are steady-color checks, not transition-timing or animation-accessibility acceptance. Original screenshots retain the real gradient; bound measurements are saved separately.
- Both fixes were visually inspected through saved rendered evidence. The synthetic session was deleted, all **11 owned processes** stopped, and ports 3000/3111 closed. No page errors, failed HTTP responses or external-origin attempts were recorded.

## Evidence and checks

Final external folder: `outputs/acceptance-20260918/contrast-run-1789736451591/` in the Codex task workspace. `contrast-result.json` SHA-256: `612afee3c2c3f719a609e510b31ca139e13c7dae76e481701cfcd9c033a3a4bb`. The folder includes source state, actual extension-file hashes, tool/helper snapshots, raw measurements, screenshots and cleanup evidence.

Execution started from primary `6710694d145f3e8ade55f74370ec83adad7d5230` with the scoped style/coordination edits, and isolated copy `d6bb1f9adac5a1ba2d61936033991de62f6e1376` with its scoped confirmation-style/handoff edits. Tested source hashes:

- `extension/src/styles.css`: `e4b5aa8f2efa1c060b516dcec53de143d8b732ff09c5f962e7023ccbbe4b9a52`.
- Copy `web/components/lectures/lecture-review.tsx`: `4a5229564d61013bf1332a098c64b988b3b818e315398267c1a93517d67e5c3c`.

The primary's full **702 tests**, formatting, lint, secret scan, types, builds, extension package and production HTTP check pass (`contrast-primary-full-check.txt`). The copy's guarded lint/types, **387 tests** and production build pass (`contrast-copy-check.txt`). No test was added merely to mirror the color values; rendered measurements exercise the actual built pages.

Sequential independent review found no actionable P1/P2. It confirmed both source hashes, result/helper hashes, recorded interaction states and all test/cleanup evidence, and independently recalculated all 450 gradient bounds without a mismatch. Packaging/current-human-guide source refresh follows the corrected commits and CI.

All earlier evidence remains preserved:

- `contrast-run-1789735240893`: initial audit; eight repeated observations of the white-on-white input and 294 unresolved gradient observations.
- `contrast-run-1789735491782`: helper stopped because its guard expected a different CSS serialization; no completed audit.
- `contrast-run-1789735541205`: measured theme switches before color transitions settled, producing transient observations; its stable light-theme confirmation finding is independently visible at 1280 pixels. Do not use this run as the final contrast result.
- `contrast-run-1789735883187`: 40 corrected page combinations had no violations, but waiting for animation completion stalled the extra button-state check. The controller deadline ended the run and cleaned its processes; this run is incomplete.
- `contrast-run-1789736287377`: bounded controls-only probe identified the same transition-wait problem and stopped.
- `contrast-run-1789736400465`: corrected controls-only probe; all 16 imported confirmation combinations pass. It is not the full-journey result.

The separate documentation-checkpoint CI failure `35345088804` remains preserved: one durable 32-attempt test exceeded its five-second harness timeout. The independently reviewed per-test timeout correction at `6710694` passed CI `35345564402`. Product deadlines and assertions did not change.
