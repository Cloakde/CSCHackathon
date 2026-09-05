import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
assert.ok(
  args.length === 1 && args[0].startsWith("--meltingpot-root="),
  "Usage: node scripts/meltingpot-components.mjs --meltingpot-root=PATH",
);
const meltingpot = path.resolve(args[0].slice("--meltingpot-root=".length));
const { verifyContracts } = await import(
  pathToFileURL(path.join(meltingpot, "scripts/verify-livelecture-contracts.mjs"))
);
const { reworkEnvironment } = await import(
  pathToFileURL(path.join(meltingpot, "scripts/rework-environment.mjs"))
);
verifyContracts(root);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    "scripts/meltingpot-vitest.config.ts",
  ],
  {
    cwd: root,
    env: { ...reworkEnvironment(meltingpot), LIVELECTURE_MELTINGPOT_ROOT: meltingpot },
    stdio: "inherit",
    windowsHide: true,
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
