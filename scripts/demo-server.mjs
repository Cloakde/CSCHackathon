import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { prepareTrialExecution } from "./ai-trial.mjs";

export function demoConfiguration(args, environment = process.env, repository) {
  let production = false;
  let gemini = false;
  const approval = [];
  let extensionId = environment.LIVELECTURE_EXTENSION_ID ?? "";
  for (const argument of args) {
    if (argument === "--production") production = true;
    else if (argument === "--gemini") gemini = true;
    else if (argument === "--approve-usd=1" || /^--source-tree=[a-f0-9]{40}$/.test(argument))
      approval.push(argument);
    else if (argument.startsWith("--extension-id=")) extensionId = argument.slice(15);
    else throw new Error(`Unknown demo option: ${argument}`);
  }
  if (extensionId && !/^[a-p]{32}$/.test(extensionId))
    throw new Error("The extension ID must be the 32 lowercase letters shown by Chrome.");
  if (!gemini && approval.length)
    throw new Error("Approval flags require an explicitly selected Gemini run.");
  let activation = {
    LIVELECTURE_ASSISTANCE_PROVIDER: "prewritten",
    LIVELECTURE_APP_EXECUTE: "",
    LIVELECTURE_APP_TREE: "",
    LIVELECTURE_APP_POLICY: "",
  };
  if (gemini) {
    const git = (...gitArgs) => {
      const result = spawnSync("git", gitArgs, {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.status !== 0) throw new Error("Cannot verify the application source.");
      return result.stdout.trim();
    };
    const prepared = prepareTrialExecution(
      ["--execute", ...approval],
      environment,
      repository ?? {
        sourceTree: git("rev-parse", "HEAD^{tree}"),
        commit: git("rev-parse", "HEAD"),
        dirty: git("status", "--porcelain") !== "",
        commonDir: git("rev-parse", "--path-format=absolute", "--git-common-dir"),
      },
    );
    activation = {
      LIVELECTURE_ASSISTANCE_PROVIDER: "gemini",
      LIVELECTURE_APP_EXECUTE: prepared.LIVELECTURE_AI_TRIAL_EXECUTE,
      LIVELECTURE_APP_TREE: prepared.LIVELECTURE_AI_TRIAL_TREE,
      LIVELECTURE_APP_POLICY: prepared.LIVELECTURE_AI_TRIAL_POLICY,
    };
  }
  return {
    args: [production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3000"],
    env: {
      ...environment,
      ...activation,
      LIVELECTURE_DEMO_ENABLED: "true",
      LIVELECTURE_EXTENSION_ID: extensionId,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  };
}

function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const require = createRequire(new URL("../web/package.json", import.meta.url));
  const configuration = demoConfiguration(process.argv.slice(2));
  console.log("Local synthetic demo: http://127.0.0.1:3000/demo");
  console.log(
    configuration.env.LIVELECTURE_ASSISTANCE_PROVIDER === "gemini"
      ? "Gemini selected for the explicitly authorized capped run; no verified answer yet."
      : "Prewritten help only. Open the address yourself when ready; no browser is opened.",
  );
  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), ...configuration.args],
    {
      cwd: resolve(root, "web"),
      env: configuration.env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
