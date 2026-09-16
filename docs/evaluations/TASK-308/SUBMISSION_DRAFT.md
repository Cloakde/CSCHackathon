# LiveLecture AI — submission draft, not submitted

## Problem

When a student loses track during a lecture, a generic summary afterward does not show the exact idea they missed or help them practice it.

## What we built

LiveLecture AI is a Chrome extension with a private MeltingPot study companion. The extension displays a timestamped lecture transcript, explains a confusing moment with clickable source passages, and remembers that difficulty. After class, the student opens practice chosen for those recorded moments, checks the supporting lecture evidence, and keeps source notes and bookmarks.

The differentiator is the connection between confusion during class and targeted practice afterward. The current working demonstration uses a clearly labeled sample transcript and prewritten assistance. Gemini assistance and a separate bounded ElevenLabs live-transcription build are implemented candidates; their real-service and human acceptance tests are pending. Do not remove that qualification until evidence exists.

## Tools and prior work to disclose

TypeScript, React, Next.js, Chrome extension APIs, Zod, Vite/Vitest and local automated checks. Gemini is the selected text-assistance provider; ElevenLabs Scribe is the conditional audio-transcription provider. A local synthetic speech fixture was generated using Windows speech synthesis, not recorded from a class.

The MeltingPot companion starts from a pre-existing project, copied from `Rayrayyh/Melting-Pot` at `843ebeea1a9cf041355abc0dca167a5c2a1b281b`; its history/license are preserved. LiveLecture changes were made only in the separate rework copy. The original submitted repositories/services were not modified. Codex, Claude and Gemini assisted with planning, code, tests and reviews; team members must describe their own decisions and explain the final code. Do not invent an individual contribution or claim that AI wrote nothing.

## Evidence and fields still needed

- Final approved project/source or demo link; the current development repository is [Cloakde/CSCHackathon](https://github.com/Cloakde/CSCHackathon). The local rework ZIP is not automatically public.
- Team/member names and user-reviewed contribution wording.
- Actual screenshots and optional one-to-two-minute recording following the release guide; none is represented as recorded yet.
- Final tested feature list and limitations; provider/human evidence if those features are advertised.
- Product Owner choice about award consideration/promotional terms. This draft does not opt the team in.

Official [rules](https://csc-back-to-school.devpost.com/rules) and [schedule](https://csc-back-to-school.devpost.com/details/dates) rechecked 2026-09-15: AI and substantial pre-existing work must be disclosed; the team must understand the project. The deadline conflict remains: schedule/banner say October 5, 2026 at midnight PDT, rules body says noon Pacific. Do not rely on the later time. No calendar promise or submission is made by preparing this draft.
