import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { readFileSync, writeFileSync } from "node:fs";

export default defineConfig(({ mode }) => ({
  define:
    mode === "live-test"
      ? {
          "import.meta.env.VITE_LIVELECTURE_LIVE_TEST": JSON.stringify("true"),
          "import.meta.env.VITE_LIVELECTURE_CAPTURE_SPIKE": JSON.stringify("true"),
        }
      : {},
  plugins: [
    react(),
    ...(mode === "live-test"
      ? [
          {
            name: "bounded-live-test-manifest",
            closeBundle() {
              const file = fileURLToPath(
                new URL("./dist-live-test/manifest.json", import.meta.url),
              );
              const manifest = JSON.parse(readFileSync(file, "utf8"));
              manifest.name += " — LIVE TEST";
              manifest.content_security_policy.extension_pages += " wss://api.elevenlabs.io";
              writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
            },
          },
        ]
      : []),
  ],
  build: {
    outDir: mode === "live-test" ? "dist-live-test" : "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: fileURLToPath(new URL("./sidepanel.html", import.meta.url)),
        offscreen: fileURLToPath(new URL("./offscreen.html", import.meta.url)),
        background: fileURLToPath(new URL("./src/background.ts", import.meta.url)),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: true,
  },
}));
