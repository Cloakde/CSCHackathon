import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const repositoryRoot = process.cwd();
const extensionRoot = path.resolve(repositoryRoot, "extension", "dist");

function assert(condition, message) {
  if (!condition) throw new Error(`Extension package verification failed: ${message}`);
}

function resolvePackagedPath(relativePath) {
  assert(typeof relativePath === "string" && relativePath.length > 0, "missing packaged path");
  const normalizedPath = relativePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(extensionRoot, normalizedPath);
  assert(
    absolutePath.startsWith(`${extensionRoot}${path.sep}`),
    `path escapes extension package: ${relativePath}`,
  );
  return absolutePath;
}

const manifestPath = path.join(extensionRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.minimum_chrome_version === "116", "minimum_chrome_version must remain 116");
assert(
  JSON.stringify(manifest.permissions) === JSON.stringify(["sidePanel"]),
  "sidePanel must be the only extension permission",
);
assert(
  manifest.host_permissions === undefined || manifest.host_permissions.length === 0,
  "host permissions are forbidden in the bootstrap",
);
assert(
  manifest.action && typeof manifest.action === "object",
  "a toolbar action is required to open the side panel",
);
assert(
  !("default_popup" in manifest.action),
  "the toolbar action must not replace side-panel behavior with a popup",
);
assert(manifest.background?.type === "module", "background worker must be an ES module");

const workerPath = resolvePackagedPath(manifest.background?.service_worker);
const panelPath = resolvePackagedPath(manifest.side_panel?.default_path);
await Promise.all([access(workerPath), access(panelPath)]);

const panelHtml = await readFile(panelPath, "utf8");
const remoteReferencePattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const scriptTags = [...panelHtml.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
const moduleScriptPaths = [];
for (const scriptTag of scriptTags) {
  const source = scriptTag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!source) continue;
  assert(!remoteReferencePattern.test(source), `remote script is forbidden: ${source}`);
  await access(resolvePackagedPath(source));
  if (/\btype=["']module["']/i.test(scriptTag)) moduleScriptPaths.push(source);
}
assert(moduleScriptPaths.length > 0, "side panel must load at least one local module script");

const stylesheetTags = [...panelHtml.matchAll(/<link\b[^>]*>/gi)]
  .map((match) => match[0])
  .filter((linkTag) => /\brel=["']stylesheet["']/i.test(linkTag));
for (const stylesheetTag of stylesheetTags) {
  const href = stylesheetTag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  assert(Boolean(href), "stylesheet link is missing href");
  assert(!remoteReferencePattern.test(href), `remote stylesheet is forbidden: ${href}`);
  await access(resolvePackagedPath(href));
}

const startupCalls = [];
globalThis.chrome = {
  sidePanel: {
    async setPanelBehavior(options) {
      startupCalls.push(options);
    },
  },
};
await import(`${pathToFileURL(workerPath).href}?package-verification=${Date.now()}`);
assert(startupCalls.length === 1, "packaged background worker must configure the side panel once");
assert(
  startupCalls[0]?.openPanelOnActionClick === true,
  "packaged background worker must open the side panel from the toolbar action",
);

console.log("Packaged extension verification passed.");
