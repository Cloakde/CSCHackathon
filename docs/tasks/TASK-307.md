# TASK-307 — Connect Capture and Transcription to the Lecture Screen

**Tier:** 1

**State:** DRAFT — written during offline preparation (2026-09-06/07), not yet started. **The number 307 is provisional.** It was chosen because this preparation's source snapshot (`4a4f52f6295851d58be1dcce5f878606a3002bcd`) had no task past TASK-305, and TASK-306 was already known to be in progress elsewhere. **Before starting this task, check the live `docs/TASK_BOARD.md` and renumber if 307 (or higher) has since been claimed.**

**Assigned engineer:** Unassigned

**Independent reviewer:** Unassigned; must differ from the engineer

**Dependencies:** TASK-101 (Chrome capture) PASS or explicit CUT-with-Simulation-fallback decision; TASK-102 (ElevenLabs transport) PASS or explicit CUT-with-Simulation-fallback decision; the live checkout's current `TranscriptSource` interface and `App.tsx` (verify these still match what this contract assumes — they may have changed since this was written).

## Objective

Connect TASK-101's capture and TASK-102's transcription transport into one `LiveTranscriptSource` that implements the existing `TranscriptSource` interface (`shared/src/simulation.ts`), so a real captured lecture can flow through the exact same downstream path — transcript display, "I'm Lost", confusion logging, and the MeltingPot handoff — that `SimulationTranscriptSource` already drives. This task does not re-implement any of that downstream path; it only makes Live a second, interface-compatible source.

Live must remain **off by default**. Simulation Mode is the only currently proven demo path, and nothing in this task may make Live activate silently, automatically, or in place of Simulation without an explicit, visible user choice each time.

## Why this task exists separately from TASK-101/102

TASK-101 proves capture feasibility in isolation (no transcription). TASK-102 proves transcription feasibility against already-normalized PCM (no real capture). Neither may depend on the other's files. This task is the **only** one allowed to import from both `extension/src/capture-*` and `extension/src/transcription/**`, and the only one that touches the lecture screen (`App.tsx`) to add a Live option.

## The gap this task must close

TASK-101's offscreen document establishes an audible passthrough connection (`MediaStreamAudioSourceNode → AudioContext.destination`) but does **not** currently tap the stream for PCM data anywhere. TASK-102's transport requires mono PCM16LE at a fixed 16,000 Hz with absolute sample offsets — a format captured tab audio does not arrive in (Web Audio typically runs at 48,000 or 44,100 Hz, as `Float32Array` samples).

This preparation phase built one piece of that bridge in advance: `extension/src/transcription/resample.ts`, a tested streaming linear-interpolation resampler that converts native-rate `Float32Array` audio into 16 kHz PCM16LE chunks with contiguous absolute offsets. **It has not been wired to a real audio tap.** This task must:

1. Add an `AudioWorkletNode` (or, if Chrome 116's worklet behavior in an offscreen document proves unsuitable during implementation, a documented fallback) in `extension/src/offscreen.ts` that reads frames from the existing passthrough source without disturbing the audible connection already there.
2. Feed those frames through `createStreamResampler` (already built) to produce PCM chunks.
3. Deliver those chunks to wherever `ScribeRealtimeTransport` runs (see the open question below) — most likely by keeping the transport inside the offscreen document itself, avoiding a cross-context message hop for raw audio.
4. Verify none of this disturbs TASK-101's existing acceptance criteria — the audible passthrough, single connection, and generation-tagged cleanup must all continue to hold exactly as ADR 0004 describes.

## Owned Files

- `extension/src/live-transcript-source.ts` — new; implements `TranscriptSource`
- `extension/src/offscreen.ts` — the audio tap and resampler wiring described above (TASK-101's existing capture/passthrough logic must not regress)
- `extension/src/App.tsx` — an explicit, visibly labeled way to choose Live instead of Simulation (never a silent default)
- `extension/test/live-transcript-source.test.ts` — new
- `extension/test/offscreen.test.ts` — extended for the audio tap
- `extension/test/App.test.tsx` — extended for the Live-selection UI
- `docs/adr/0006-*.md` or the next unused ADR number — new; records the final design, in particular where the transport actually runs

## Forbidden Paths and Lane Boundary

Do not modify `extension/src/capture-*.ts`, `extension/src/transcription/pcm.ts`, `extension/src/transcription/wire-events.ts`, or `extension/src/transcription/scribe-transport.ts` beyond what wiring genuinely requires — those are TASK-101/102's proven, tested boundary. If a real integration reveals that one of them needs to change, that is itself a finding: document it and get it reviewed as a scoped amendment, not a silent edit. Do not touch `shared/src/schemas/transcript.ts` (the canonical `TranscriptEvent` union is frozen; `LiveTranscriptSource` must produce values that already validate against it, not new ones). Do not touch MeltingPot, the assistance/grounding pipeline, or any other milestone's files.

## Contracts Consumed

- `TranscriptSource` / `ReplayableTranscriptSource` (`shared/src/simulation.ts`) — `LiveTranscriptSource` implements the plain `TranscriptSource` shape only; Live has no pause/resume/speed concept, so it must **not** claim `replayControls`.
- The capture protocol's `CaptureClient` (`extension/src/capture-client.ts`) and its `CaptureStatusSnapshot` states.
- `ScribeRealtimeTransport`'s constructor options and its `TranscriptEvent`/`onWarning`/`onDiscardedGap` outputs (`extension/src/transcription/scribe-transport.ts`).
- `createStreamResampler` (`extension/src/transcription/resample.ts`).
- `App.tsx`'s existing `source`/`client` injection pattern — `LiveTranscriptSource` must be swappable in exactly the way `SimulationTranscriptSource` already is, per the existing `AppProps.source` seam.

## Contracts Produced

- `LiveTranscriptSource implements TranscriptSource`: `subscribe`/`start`/`stop`/`getSnapshot` (`mode: "live"`), translating capture-controller state and transport events into the canonical `TranscriptEvent` union. `start()` begins by driving the capture consent flow (TASK-101's `CaptureClient`) rather than assuming consent already happened; `stop()` tears down both capture and the transport, in that order, so the transport is never left listening to a socket with no audio arriving.

## Required Behavior

- **State mapping.** Capture states before `active` (`idle`, `awaiting_consent`, `armed`, `starting`) map to `TranscriptSource` status `idle`/`starting`; capture `active` plus a live transport connection maps to `active`; a capture `error`, or a transport-side terminal `source.error`, maps to `error` and stops the other half too — a capture failure must not leave the transport running with no audio, and a transport failure must not leave capture running with nowhere for its audio to go.
- **No invented timing.** Every `TranscriptEvent` this source emits must trace back to either the transport's own output (already timing-correct per ADR 0005) or a `source.state`/`session.started`/`session.ended` envelope this source constructs itself — never a chunk with guessed timing.
- **Explicit source selection, not a silent default.** The UI addition in `App.tsx` must make it obvious which source is active (the existing `SIMULATION` banner pattern is the model to extend, not replace) and must require an explicit user action to select Live. A capture or transport failure while Live is active must surface as a visible error, never a silent fallback to Simulation content while still labeled Live.
- **Passthrough survives.** The audio tap added to `extension/src/offscreen.ts` must not alter the single `MediaStreamAudioSourceNode → AudioContext.destination` connection TASK-101 already established; it reads from the same source node, it does not replace or duplicate it.

## Required Automated Verification

- `LiveTranscriptSource` emits a plausible, schema-valid sequence of `TranscriptEvent`s for: a full happy path (consent → active → several transcript chunks → stop), a capture failure while transcription would otherwise be healthy, a transport failure while capture is otherwise healthy, and an explicit `stop()` mid-session cleaning up both halves.
- The offscreen audio tap: verify the existing passthrough connection is unchanged (same test intent as TASK-101's own "exactly one connection" assertion) and that resampled PCM chunks reach the transport with contiguous offsets across multiple worklet frames.
- `App.tsx`: selecting Live requests capture consent through the same UI TASK-101 already built; Simulation remains selectable and remains the default; a Live failure shows a visible error without silently reverting to Simulation content under the Live label.

Run and report the same command set TASK-101 and TASK-102 each required (`test`, `typecheck`, `build`, `verify:extension-package`, `check`), plus a targeted run of every new/changed test file.

## PASS / CUT Decision

**PASS** requires TASK-101 and TASK-102 to have already reached PASS (or an explicit, recorded CUT with Simulation preserved as the fallback — in which case this task's Live-specific work is itself CUT, and only its defensive "never invent timing / never silently fall back" properties matter for whatever remains enabled), all automated verification above green on the exact reviewed commit, independent Tier-1 review, and — because this task touches real audio end-to-end — the same category of human Chrome verification TASK-101 required, repeated against the integrated path.

**CUT** at the timebox if the audio tap cannot be added without disturbing TASK-101's proven passthrough behavior, if real transcription quality/latency (once the paid smoke in TASK-102 actually runs) makes Live impractical for a lecture, or if either upstream task itself was CUT. A CUT here does not affect TASK-101 or TASK-102's own standing — Simulation Mode remains the committed demo path regardless.
