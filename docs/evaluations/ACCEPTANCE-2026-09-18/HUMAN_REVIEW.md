# Human review: the next acceptance step

**Not yet performed.** This guide replaces the September 6 setup assumptions in the older manual card. No API key, paid test or audio recording is needed. There are two separate checks: a learner tries the product, and someone comfortable with calculus checks the saved actual Gemini answers.

## 1. Try the learning experience

An operator prepares the extension and private MeltingPot companion using [the current release guide](../TASK-308/RELEASE.md). The tested package is `release/c97792142b8b/`, paired with isolated MeltingPot `d03f99b14895c392355bcfa3c0c2985ad7073d31`; this pair includes the reviewed [text-contrast corrections](CONTRAST.md). Later documentation-only commits do not change those tested runtime files. Use the package manifest/current handoff to check the pair; do not use the obsolete `9244a64` copy named in the historical card.

On this laptop, the prepared extension files are in `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon\extension\dist`. Chrome installation still needs an operator: the automation tool could not reliably target its folder picker. Once the extension is loaded, copy the extension ID shown by Chrome. Keep these two local previews running:

```powershell
# LiveLecture terminal, in the CSCHackathon folder after its checked build:
npm run start:demo -- --extension-id=YOUR_32_LETTER_EXTENSION_ID
```

```powershell
# Separate terminal, only in the isolated MeltingPot-rework folder:
node scripts/rework-preview.mjs
```

If the isolated preview reports a missing/stale build, follow its `REWORK.md` and run `node scripts/rework-check.mjs build` there first. These are operator setup instructions, not tasks to give an unaided learner. Do not start an original MeltingPot app or reuse a paid-test launcher/allowance.

Open the extension's Chrome side panel. Confirm **SIMULATION**, **Prewritten sample help · no AI provider used**, and **1×** speed before handing it to the learner. The sample lasts eight minutes and contains text, not captured audio. The ordinary demonstration uses prewritten answers; it is separate from the recorded real-Gemini examples below.

Give the learner only this task:

> Use the sample lecture. Ask for help at two different ideas you find confusing. Finish the lecture and find your practice in MeltingPot. Try both questions, check their explanations, visit the lecture passage behind one answer, and return to your unfinished answer. Delete the sample lecture when you are done. Tell us what felt unclear and whether the practice matched the help you requested.

Do not give the learner the answer packet, tell them when to click, or guide them through the buttons. If help is necessary, give it and record where; do not count that step as unaided. If they reach only one concept, record a partial result. The operator may handle setup and any tool failure separately.

Record these observations:

| Observation                                                             | Result and notes — leave unfilled until performed |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| Learner/date; exact source pair and Chrome version                      |                                                   |
| Understood that this is a sample with prewritten help                   |                                                   |
| Requested help at two distinct concepts without coaching                |                                                   |
| Followed a timestamp to the supporting passage                          |                                                   |
| Found matching practice in the private companion                        |                                                   |
| Understood both questions and their feedback                            |                                                   |
| Returned from a source passage without losing their answer              |                                                   |
| Deleted the sample and saw that it was unavailable                      |                                                   |
| Could explain how the later practice relates to their earlier confusion |                                                   |
| Any clipping, confusing words, lost focus, errors or operator help      |                                                   |
| Overall: passed / changes needed / incomplete; reasons                  |                                                   |

Only observe and record; do not invent a learner or fill this from automated results. Notes are enough—recording a person is not necessary. Stop only previews that the operator started. Downloads, if used, are separate files and are not removed by session deletion.

## 2. Check the actual Gemini answers

Give a calculus reviewer [the recorded-answer packet](RECORDED_ANSWERS.md). It contains the two explanations and their matching practice questions from the completed actual-Gemini application test, plus the explanation from the transcript-overlap test. Each is copied from the preserved output and linked to its exact synthetic lecture passages. No request will run by opening it.

For each example, ask the reviewer to record:

- Is the mathematics correct, including the expected practice answer?
- Does the cited lecture support every material explanation and prerequisite?
- Does the question target the specific difficulty described, and provide enough information to solve it?
- Would the explanation help a student at this point, or is the wording confusing?

Record reviewer/date, example number, passed / changes needed, and specific corrections. The existing independent AI review passed; **human subject review remains pending**. The older service tests separately cover unsupported/adversarial input; these three saved examples are not a broad reliability study.

## What this can and cannot approve

The learner check evaluates the ordinary prewritten learning flow. The subject check evaluates saved actual Gemini content. Neither alone proves every other gate. Native audio capture/passthrough, account-specific [provider retention](PROVIDER_RETENTION.md), final judge access, public source/assets, presentation approval and submission are separate decisions. All completed paid-test allowances are closed; this packet does not authorize another call or publish anything.
