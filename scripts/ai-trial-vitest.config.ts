import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

if (process.env.CI || process.env.LIVELECTURE_AI_TRIAL_EXECUTE !== "approved-one-dollar-v1")
  throw new Error("Use the explicitly authorized ai:trial launcher.");

export default defineConfig({
  root: fileURLToPath(new URL("../", import.meta.url)),
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["web/src/server/ai-evaluation/trial/actual.run.tsx"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 900_000,
  },
});
