import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ignoredDirectories = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const ignoredFiles = new Set(["package-lock.json", "secret-scan.mjs"]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const patterns = [
  {
    name: "ElevenLabs-style secret",
    expression: new RegExp(["s", "k", "_"].join("") + "[A-Za-z0-9]{24,}"),
  },
  {
    name: "assigned provider secret",
    expression: new RegExp("(?:ELEVENLABS|GENERATION)_API_KEY\\s*=\\s*[^\\s#]+"),
  },
  {
    name: "private key material",
    expression: new RegExp("BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolutePath)));
    else if (!ignoredFiles.has(entry.name) && textExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }
  return files;
}

const repositoryRoot = process.cwd();
const findings = [];
for (const file of await collectFiles(repositoryRoot)) {
  const content = await readFile(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) {
      findings.push(`${path.relative(repositoryRoot, file)}: ${pattern.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("Secret scan passed.");
}
