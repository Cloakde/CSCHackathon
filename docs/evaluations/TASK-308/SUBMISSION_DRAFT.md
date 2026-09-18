# LiveLecture AI — submission draft, not submitted

## Problem

When a student loses track during a lecture, a generic summary afterward does not show the exact idea they missed or help them practice it.

## What we built

LiveLecture AI is a Chrome extension with a private MeltingPot study companion. The extension displays a timestamped lecture transcript, explains a confusing moment with clickable source passages, and remembers that difficulty. After class, the student opens practice chosen for those recorded moments, checks the supporting lecture evidence, and keeps source notes and bookmarks.

The differentiator is the connection between confusion during class and targeted practice afterward. The ordinary working demonstration uses a clearly labeled sample transcript and prewritten assistance. A separate bounded test passed the actual Gemini explanation-to-practice journey for two synthetic topics, followed by AI content review. This limited result is not human acceptance or evidence of broad reliability. ElevenLabs transport produced finalized text across a reconnect, but live audio remains conditional because provider retention and native Chrome capture are unresolved. [Exact September 18 evidence and limits](../ACCEPTANCE-2026-09-18/README.md).

## Tools and prior work to disclose

TypeScript, React, Next.js, Chrome extension APIs, Zod, Vite/Vitest and local automated checks. Gemini is the selected text-assistance provider; ElevenLabs Scribe is the conditional audio-transcription provider. A local synthetic speech fixture was generated using Windows speech synthesis, not recorded from a class.

The MeltingPot companion starts from a pre-existing project, copied from `Rayrayyh/Melting-Pot` at `843ebeea1a9cf041355abc0dca167a5c2a1b281b`; its history/license are preserved. LiveLecture changes were made only in the separate rework copy. The original submitted repositories/services were not modified. Codex, Claude and Gemini assisted with planning, code, tests and reviews; team members must describe their own decisions and explain the final code. Do not invent an individual contribution or claim that AI wrote nothing.

## Evidence and fields still needed

- Final approved project/source or demo link; the current development repository is [Cloakde/CSCHackathon](https://github.com/Cloakde/CSCHackathon). The local rework ZIP is not automatically public.
- Team/member names and user-reviewed contribution wording.
- Approve/select public screenshots and recording. Actual local screenshots and two silent clips totaling 93.84 seconds are prepared, clearly labeled Simulation Mode/prewritten help. They remain unpublished drafts; optional narration is not recorded.
- Final tested feature list and limitations; provider/human evidence if those features are advertised.
- Product Owner choice about award consideration/promotional terms. This draft does not opt the team in.

Official [rules](https://csc-back-to-school.devpost.com/rules) and [schedule](https://csc-back-to-school.devpost.com/details/dates) rechecked 2026-09-15: AI and substantial pre-existing work must be disclosed; the team must understand the project. The deadline conflict remains: schedule/banner say October 5, 2026 at midnight PDT, rules body says noon Pacific. Do not rely on the later time. No calendar promise or submission is made by preparing this draft.
