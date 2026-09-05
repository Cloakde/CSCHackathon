import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const meltingpot = process.env.LIVELECTURE_MELTINGPOT_ROOT;
if (!meltingpot) throw new Error("Run the paired test through scripts/meltingpot-components.mjs.");
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@meltingpot", replacement: path.join(meltingpot, "web") },
      { find: "@", replacement: path.join(meltingpot, "web") },
      {
        find: "@livelecture/contracts",
        replacement: path.join(meltingpot, "vendor/livelecture-contracts/src/index.ts"),
      },
      { find: "react", replacement: path.join(root, "node_modules/react") },
      { find: "react-dom", replacement: path.join(root, "node_modules/react-dom") },
      { find: "zod", replacement: path.join(root, "node_modules/zod") },
      { find: "next", replacement: path.join(root, "node_modules/next") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["scripts/meltingpot-connection.test.tsx"],
  },
});
