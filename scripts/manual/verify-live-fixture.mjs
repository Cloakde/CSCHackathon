import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildSmokeFixture, validateVadFixture } from "./scribe-fixture.mjs";
const file = new URL("../../web/public/live-test-lecture.wav", import.meta.url);
const bytes = await readFile(file);
if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE")
  throw new Error("Invalid WAV fixture.");
let format, pcm;
for (let offset = 12; offset + 8 <= bytes.length;) {
  const tag = bytes.toString("ascii", offset, offset + 4),
    length = bytes.readUInt32LE(offset + 4);
  const data = bytes.subarray(offset + 8, offset + 8 + length);
  if (data.length !== length) throw new Error("Truncated WAV fixture.");
  if (tag === "fmt ") format = data;
  if (tag === "data") pcm = data;
  offset += 8 + length + (length % 2);
}
if (
  !format ||
  format.readUInt16LE(0) !== 1 ||
  format.readUInt16LE(2) !== 1 ||
  format.readUInt32LE(4) !== 16000 ||
  format.readUInt16LE(14) !== 16 ||
  !pcm ||
  pcm.length % 2 ||
  !pcm.some((value) => value !== 0)
)
  throw new Error("Fixture must contain nonsilent mono PCM16 at 16 kHz.");
const seconds = pcm.length / 32000;
if (seconds < 10 || seconds > 90) throw new Error("Synthetic fixture exceeds the live test bound.");
const option = process.argv[2];
if (process.argv.length > 3 || (option && !/^--(?:pcm|smoke-pcm)-output=.+$/.test(option)))
  throw new Error("Unknown fixture verification option.");
const smokePcm = buildSmokeFixture(pcm);
if (option)
  await writeFile(
    option.slice(option.indexOf("=") + 1),
    option.startsWith("--smoke-") ? smokePcm : pcm,
    { flag: "wx" },
  );
console.log(
  JSON.stringify(
    {
      sampleRate: 16000,
      channels: 1,
      seconds,
      wavSha256: createHash("sha256").update(bytes).digest("hex"),
      pcmSha256: createHash("sha256").update(pcm).digest("hex"),
      smokeSeconds: smokePcm.length / 32000,
      smokePcmSha256: createHash("sha256").update(smokePcm).digest("hex"),
      smokeLayout: "0-8.5s synthetic introduction, silence to 15s; repeat, silence to 30s",
      smokePauses: validateVadFixture(smokePcm),
    },
    null,
    2,
  ),
);
