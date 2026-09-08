export const ASSISTANCE_STATUS_HEADER = "X-LiveLecture-Assistance";
export const ASSISTANCE_STATUS_LABELS = {
  unknown: "Assistance mode has not been confirmed.",
  prewritten: "Prewritten sample help · no AI provider used.",
  gemini_pending: "Gemini selected · no verified answer yet.",
  gemini_ready: "Gemini assistance · latest answer checked against the lecture.",
  gemini_failed: "Gemini could not provide a verified answer for the latest request.",
  gemini_blocked: "Gemini is disabled until an authorized, capped run is prepared.",
} as const;
export type AssistanceStatus = keyof typeof ASSISTANCE_STATUS_LABELS;
export function readAssistanceStatus(headers: Headers): AssistanceStatus {
  const value = headers.get(ASSISTANCE_STATUS_HEADER);
  return value && Object.hasOwn(ASSISTANCE_STATUS_LABELS, value)
    ? (value as AssistanceStatus)
    : "unknown";
}
