// Offline preparation only. This edits the checked-in synthetic fixture, never
// a captured lecture. A pause must be sent as PCM; waiting locally sends none.
export const SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
const PAUSE_SAMPLES = 3 * SAMPLE_RATE;

export function validateFixture(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 3200 ||
    bytes.length > 30 * BYTES_PER_SECOND ||
    bytes.length % 3200 !== 0 ||
    !bytes.some((value) => value !== 0)
  )
    throw new Error(
      "Use non-silent synthetic mono PCM16LE, 16 kHz, in 0.1-second units, at most 30 seconds.",
    );
}

export function validateVadFixture(bytes) {
  validateFixture(bytes);
  let silence = 0,
    speechSincePause = false,
    boundaries = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    if (bytes[i] === 0 && bytes[i + 1] === 0) {
      silence++;
      if (silence === PAUSE_SAMPLES && speechSincePause) {
        boundaries++;
        speechSincePause = false;
      }
    } else {
      silence = 0;
      speechSincePause = true;
    }
  }
  if (boundaries < 2 || silence < PAUSE_SAMPLES)
    throw new Error(
      "The VAD smoke needs two speech sections each followed by at least 3 seconds of transmitted silence, including the end.",
    );
  return { pauseBoundaries: boundaries, trailingSilenceSeconds: silence / SAMPLE_RATE };
}

export function buildSmokeFixture(pcm) {
  // In live-test-lecture.wav the introductory two sentences end before 8.5 s,
  // inside a measured quiet interval. Repeat them after a long pause so the
  // second speech section exercises loss/reconnect. This is a transport probe,
  // not a distinct-topic lecture or a transcript-quality benchmark.
  const speechBytes = 8.5 * BYTES_PER_SECOND;
  if (!(pcm instanceof Uint8Array) || pcm.length < speechBytes)
    throw new Error("The synthetic source is too short for the paused smoke fixture.");
  const bytes = new Uint8Array(30 * BYTES_PER_SECOND);
  const speech = pcm.subarray(0, speechBytes);
  bytes.set(speech, 0);
  bytes.set(speech, 15 * BYTES_PER_SECOND);
  validateVadFixture(bytes);
  return bytes;
}
