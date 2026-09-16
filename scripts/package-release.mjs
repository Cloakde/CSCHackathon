import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const git = (directory, ...args) =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8", windowsHide: true }).trim();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function files(directory, base = directory) {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Package symlinks are not supported.");
    if (entry.isDirectory()) Object.assign(result, await files(path, base));
    else result[relative(base, path).replaceAll("\\", "/")] = hash(await readFile(path));
  }
  return result;
}
async function main() {
  if (process.platform !== "win32")
    throw new Error("This local packaging command uses Windows Compress-Archive.");
  const arg = process.argv[2];
  if (process.argv.length !== 3 || !arg?.startsWith("--meltingpot-root="))
    throw new Error("Supply the isolated MeltingPot rework root.");
  const copy = resolve(arg.slice(18));
  if (
    (await readFile(join(copy, "REWORK.md"), "utf8")).indexOf("rework/lecture-integration") < 0 ||
    git(copy, "remote") !== "" ||
    git(copy, "branch", "--show-current") !== "rework/lecture-integration"
  )
    throw new Error("Only the isolated, remote-free MeltingPot rework may be packaged.");
  for (const directory of [root, copy])
    if (git(directory, "status", "--porcelain"))
      throw new Error("Commit reviewed work before packaging; dirty files are preserved.");
  const heads = [root, copy].map((directory) => git(directory, "rev-parse", "HEAD"));
  const verifySource = () =>
    [root, copy].forEach((directory, index) => {
      if (
        git(directory, "status", "--porcelain") ||
        git(directory, "rev-parse", "HEAD") !== heads[index]
      )
        throw new Error("Source changed while packaging; the candidate is not valid.");
    });
  const verifyEnvironmentFiles = async () => {
    for (const directory of [root, join(root, "extension")])
      if (
        (await readdir(directory)).some(
          (name) => /^\.env(?:\.|$)/i.test(name) && name !== ".env.example",
        )
      )
        throw new Error("Local environment files are forbidden during packaging.");
  };
  await verifyEnvironmentFiles();
  const env = { NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of [
    "Path",
    "PATH",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "LOCALAPPDATA",
    "APPDATA",
    "USERPROFILE",
  ])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  const run = (args, cwd = root) =>
    execFileSync(process.execPath, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: "pipe",
      timeout: 120_000,
    });
  run([join(root, "node_modules/typescript/bin/tsc"), "-p", "shared/tsconfig.build.json"]);
  run(
    [join(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "production"],
    join(root, "extension"),
  );
  run([join(root, "scripts/verify-extension-package.mjs")]);
  await verifyEnvironmentFiles();
  verifySource();
  const source = {
    livelecture: {
      commit: git(root, "rev-parse", "HEAD"),
      tree: git(root, "rev-parse", "HEAD^{tree}"),
    },
    meltingpot: {
      commit: git(copy, "rev-parse", "HEAD"),
      tree: git(copy, "rev-parse", "HEAD^{tree}"),
    },
  };
  const output = join(root, "release", source.livelecture.commit.slice(0, 12));
  await mkdir(join(root, "release"), { recursive: true });
  await mkdir(output); // Refuse to replace an existing package.
  const extensionZip = join(output, "LiveLecture-extension.zip");
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -LiteralPath ${quote(join(root, "extension/dist"))} -DestinationPath ${quote(extensionZip)} -ErrorAction Stop`,
    ],
    { windowsHide: true, stdio: "pipe", timeout: 30_000 },
  );
  for (const [name, directory] of [
    ["LiveLecture-source", root],
    ["MeltingPot-rework-source", copy],
  ])
    git(directory, "archive", "--format=zip", "-o", join(output, name + ".zip"), "HEAD");
  await verifyEnvironmentFiles();
  verifySource();
  await writeFile(
    join(output, "README.txt"),
    "LiveLecture AI candidate package.\nExtract LiveLecture-extension.zip and Load unpacked its dist folder in Chrome. This is SIMULATION MODE with prewritten assistance and no audio capture.\nThe two source archives are the exact paired commits in manifest.json. Follow docs/evaluations/TASK-308/RELEASE.md in LiveLecture-source for local-server setup, rework isolation and unfinished acceptance checks.\nThis package is not a hosted service or an accepted release. No API key belongs in the extension.\n",
  );
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        source,
        sourceMode: "simulation",
        assistance: "prewritten",
        liveIncluded: false,
        extensionFiles: await files(join(root, "extension/dist")),
        artifacts: await files(output),
        humanAcceptance: "pending",
        providerAcceptance: "pending",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(output);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Packaging failed.");
  process.exitCode = 1;
});
