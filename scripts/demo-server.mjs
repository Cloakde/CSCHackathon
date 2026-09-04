import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function demoConfiguration(args, environment = process.env) {
  let production = false;
  let extensionId = environment.LIVELECTURE_EXTENSION_ID ?? "";
  for (const argument of args) {
    if (argument === "--production") production = true;
    else if (argument.startsWith("--extension-id=")) extensionId = argument.slice(15);
    else throw new Error(`Unknown demo option: ${argument}`);
  }
  if (extensionId && !/^[a-p]{32}$/.test(extensionId))
    throw new Error("The extension ID must be the 32 lowercase letters shown by Chrome.");
  return {
    args: [production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", "3000"],
    env: {
      ...environment,
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
  console.log("Prewritten help only. Open the address yourself when ready; no browser is opened.");
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
