# LiveLecture AI — Milestone Execution Plan

**Status:** Proposed · **Companion to:** [`MULTI_AGENT_WORKFLOW.md`](MULTI_AGENT_WORKFLOW.md)

Read `MULTI_AGENT_WORKFLOW.md` for *how* work is coordinated. This document is *what* gets built, in what order, and what gets cut when time runs out.

---

## Assumptions

Stated so the plan can be rescaled: **48-hour hackathon**, one coordinator model, two implementer lanes running in parallel, TypeScript throughout, demo presented from a laptop rather than a public deployment. All timings are percentages of total budget, so a 24h or 72h event rescales the same table.

---

## Part 1 — Decisions Locked Before Any Code

These answer §16 of the workflow document. Locking them is the entire purpose of M0.

### Storage: SQLite + Prisma

Not Supabase. No auth is needed for a single-user demo, and SQLite is one file with zero network setup. Prisma gives typed queries and migrations, and a later public deployment is a `DATABASE_URL` swap to hosted Postgres rather than a rewrite. Supabase's real value is auth and hosting — and auth is deliberately out of scope.

### Retrieval: none — no embeddings, no vector store

A 50-minute lecture is roughly 9–10k tokens. Claude Opus 5 has a 1M-token context window: the entire transcript fits about 100 times over. Send all chunks with their IDs and have the model cite IDs directly.

This removes an indexing pipeline, a dependency, and the whole class of bugs where retrieval silently returns the wrong window. Revisit only if a real transcript ever overflows the budget.

### AI: Claude Opus 5 (`claude-opus-5`) everywhere

Split by **effort**, not by model. One model means one prompt-cache namespace and one prompt to tune.

| Use | Config | Rationale |
|---|---|---|
| Live — I'm Lost, Ask, Catch Me Up, Explain This | `output_config: { effort: "low" }`, streaming on | Cuts latency and cost while keeping adaptive thinking on |
| Post-class — notes, flashcards, quiz, weak areas | Default effort, streaming, Batch API where async is acceptable | Quality matters, latency does not. Batch is 50% cheaper |

Two specifics:

- **Do not disable thinking to go faster.** On Opus 5 thinking is on by default, and disabling it has a documented failure mode where the model writes a tool call into visible text instead of emitting a `tool_use` block — the turn succeeds, the call never runs, and no error is raised. Lower `effort` instead.
- **Fast mode is the latency escape hatch** if "I'm Lost" still feels slow: `speed: "fast"` with beta flag `fast-mode-2026-02-01` on `client.beta.messages.*`, up to ~2.5× output tokens/sec, priced at $10/$50 per MTok instead of $5/$25. Opus 5 only; not compatible with the Batch API.

### Prompt caching is core cost design, not an optimisation

Every live call re-sends the whole transcript. Put the transcript first as a stable cached prefix and the student's question last, after the final `cache_control` breakpoint. Verify `usage.cache_read_input_tokens` is non-zero — if it is zero, something volatile (a timestamp, unsorted JSON, a varying tool list) is invalidating the prefix.

### Structured output

`output_config: { format: ... }` plus `client.messages.parse()`, with Zod schemas shared between validation and generation.

Generate `StructuredNotes` **section by section**, never as one call — it has eight nested arrays, and one-shot generation is where truncation happens. Assistant prefill returns a 400 on Opus 5, so do not reach for it to force JSON shape.

### Remaining decisions

- **All AI and ElevenLabs calls originate from the backend.** The extension never holds a key.
- **No auth for the demo.** Documented as a known limitation in the submission.
- **Extension → web handoff:** session ends, extension opens the companion app at the session URL.
- **Raw audio retention:** none.

### Rough cost

A full end-to-end run on a real-length lecture is on the order of $2–3 uncached, materially less with caching working. Most development runs use the 10-chunk fixture (~500 tokens), so the whole hackathon should land in the tens of dollars.

---

## Part 2 — Milestones

| | Milestone | Budget | 48h | Exit gate |
|---|---|---|---|---|
| **M0** | Foundation | 0–10% | 0–5h | CI green on an empty but real monorepo |
| **M1** | Vertical slice | 10–25% | 5–12h | One grounded answer, end to end, on fake audio |
| **M2** | Real audio *(parallel)* | 25–55% | 12–26h | Real Meet audio → timestamped transcript |
| **M3** | Live assistance *(parallel)* | 25–55% | 12–26h | All four live features cite correctly |
| **M4** | Post-class suite | 55–80% | 26–38h | The demo callback works |
| **M5** | Hardening | 80–92% | 38–44h | Survives a 50-minute session |
| **M6** | Demo & submission | 92–100% | 44–48h | Rehearsed twice, cold |

---

### M0 — Foundation (0–10%)

**Goal:** make the repository real. `web/` and `extension/` do not currently exist, so three of the four documented Quick Start commands fail.

Coordinator does most of this alone — it is fast, and all of it is Tier 1.

- Scaffold `web/` (Next.js) and `extension/` (Vite + MV3) so the declared workspaces exist.
- Write `docs/DECISIONS.md` capturing Part 1 above.
- Convert `shared/types/index.ts` to Zod schemas with types inferred from them — one source of truth, not two. Freeze it.
- Prisma schema + SQLite: `Session`, `TranscriptChunk`, `ConfusionSignal`, `Bookmark`, `StudySet`.
- GitHub Actions running typecheck, lint, build, tests. Replace the placeholder `"test": "echo ..."`.
- Fix the two ownership overlaps (`TASK-304` vs `302`/`303`; `TASK-103` vs `104`).
- Protect `main`.

**Exit gate:** `npm run build` succeeds for both workspaces and CI is green. The apps do nothing yet — that is expected.

---

### M1 — Vertical Slice (10–25%)

**The most important milestone in this plan.**

Build the thinnest possible path through *every* layer, using the fixture instead of real audio:

```
simulation streamer → side panel renders timestamped transcript
→ chunks POST to backend → student asks "why did the inequality flip?"
→ Opus 5 answers citing chunk IDs → citation renders and jumps to the chunk
```

- **Lane 1:** side panel shell, transcript list, ask input, citation rendering and click-to-jump.
- **Lane 2:** simulation streamer replaying `calculus-lecture.json` on a timer; `POST /api/transcript`; `POST /api/ai/ask` using full-transcript-in-context; prompt caching wired and verified.
- **Coordinator:** the demo smoke test, running this exact path in CI from here onward.

**Exit gate:** the smoke test passes. The contract, the grounding, and citation resolution are all proven before a minute is spent on audio plumbing.

**Why this ordering matters:** it converts M2 from a blocking dependency into an optional upgrade. If ElevenLabs fights you, there is still a demo.

---

### M2 + M3 — Run in Parallel (25–55%)

The vertical slice froze the transcript contract, which is exactly what makes this parallelism safe.

#### M2 — Real Audio (Lane 1)

- MV3 offscreen document for tab capture.
- **Audio passthrough** — the student must still hear the lecture. This is the most commonly botched part of tab capture and is silently broken until someone actually listens.
- `POST /api/transcription/token` mints a short-lived ElevenLabs credential; the extension connects with that only.
- Scribe realtime WebSocket client producing finalized timestamped chunks in the same shape the simulator emits.
- Recording indicator, elapsed timer, Stop control.

**Spike first, in the first hour of M2:** confirm the exact ElevenLabs realtime API surface and whether ephemeral tokens are supported as assumed. If not, the design changes — find out at hour 12, not hour 24.

**Abort rule:** at the M2 timebox, stop wherever it stands. Simulation Mode becomes the demo path.

#### M3 — Live Assistance (Lane 2)

All of this runs against the simulator, not against M2:

- **I'm Lost** — last 3–5 minutes → the 4-part diagnosis, Zod-validated, plus a logged `ConfusionSignal` with the detected concept. *M4's finale depends on this log — concept extraction must be right here.*
- **Ask** — grounded answer, with an explicit "this wasn't discussed in today's lecture" path offering general knowledge as a separately labelled option.
- **Catch Me Up** — 2 / 5 / 10 minute windows.
- **Explain This** — the five prompt types against a selected chunk.
- Bookmarks.

**Exit gate for both:** M2 produces real transcript chunks from a real Meet; M3's four features return validated, correctly-cited responses. Independent review is mandatory on the grounding logic — a confident wrong citation is the one bug the product's positioning cannot survive.

---

### M4 — Post-Class Suite (55–80%)

Lane 2 moves to generation; the freed lane builds the web app.

- Session end → extension opens the companion app at the session URL.
- Dashboard and lecture page with the statistics the brief specifies.
- **Structured notes**, generated section by section.
- **Flashcards** and **quiz** (5/10/20, MC / short / mixed, three difficulties), grounded in transcript concepts rather than the general subject.
- **Practice My Weak Areas** — reads the `ConfusionSignal` rows M3 wrote and generates targeted explanations and problems.

**Exit gate — the real one:** click "I'm Lost" during the simulated quadratic-inequalities lecture, end the session, open the web app, click "Practice My Weak Areas," and watch it produce practice on *that specific concept*.

That callback is the entire differentiation. If it works, the demo wins; if it does not, nothing else in M4 matters.

---

### M5 — Hardening (80–92%)

Feature freeze on entry. No new features, no exceptions.

- 50-minute continuous session. The failure mode to hunt is the MV3 service worker terminating mid-lecture and taking the socket with it.
- Transcription dropout and reconnection.
- AI failure paths — what the UI shows on timeout or unparseable JSON.
- Automatic fallback to Simulation Mode if live transcription dies **during the demo**.
- Delete-a-lecture works.
- Keyboard navigation and contrast pass on the side panel.
- Permissions audit — remove anything the manifest does not need.
- Prompt-injection check: confirm nothing spoken in a lecture can redirect the assistant.

---

### M6 — Demo & Submission (92–100%)

- Rehearse the full flow twice, cold, on the actual demo machine and network.
- Rehearse the Simulation Mode fallback once, so switching to it looks intentional.
- README with setup steps that have actually been run.
- Package the unpacked extension; record a backup video in case live fails.

---

## Part 3 — Critical Path

Everything else is slack around this chain:

**M0 schemas → M1 grounded ask → M3 confusion logging → M4 weak-areas generation → M6 rehearsal.**

Note what is *not* on it: real audio capture. That is deliberate. The dependency everyone treats as foundational is the one made optional.

---

## Part 4 — Risk Register

| Risk | Trigger to watch | Fallback |
|---|---|---|
| ElevenLabs realtime auth does not support ephemeral tokens as assumed | Hour-1 spike in M2 | Backend proxies the audio stream; the extension never sees a key either way |
| Tab capture kills the student's own audio | First manual test | Passthrough via Web Audio — test by ear, not by code review |
| MV3 service worker dies mid-lecture | 50-minute test in M5 | Keepalive plus resume-from-last-chunk; offscreen document holds the socket |
| LLM returns unparseable JSON for `StructuredNotes` | Any M4 test run | Section-by-section generation, Zod repair-retry, degraded UI state |
| "I'm Lost" too slow to feel live | M3 latency check | Effort already `low` → enable fast mode → stream partial output so something appears immediately |
| Confusion concepts too vague for M4 to target | End of M3 | Constrain concept extraction to a closed list derived from the transcript |
| Coordinator becomes the bottleneck | Queue depth above 2 tasks awaiting merge | Drop Tier 3 review entirely; batch merges |

---

## Part 5 — Cut List, In Order

Decided now, while nobody is panicking. When behind, cut from the top:

1. Study Guide
2. Quiz difficulty and format options — ship 10 mixed questions, fixed
3. Explain This — the other three live features carry the pitch
4. Catch Me Up
5. Dashboard statistics — go straight to the lecture page
6. Real audio capture → Simulation Mode only

**Never cut:** grounded Ask with citations, I'm Lost, confusion logging, and the weak-areas callback. Those four *are* the product.
