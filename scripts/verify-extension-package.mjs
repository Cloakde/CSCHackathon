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
  JSON.stringify([...manifest.permissions].sort()) ===
    JSON.stringify(["activeTab", "offscreen", "sidePanel", "storage", "tabCapture"].sort()),
  "capture requires exactly activeTab, offscreen, sidePanel, storage, and tabCapture",
);
assert(
  manifest.host_permissions === undefined || manifest.host_permissions.length === 0,
  "no host permission may be declared for TASK-101 capture",
);
assert(
  manifest.content_security_policy?.extension_pages ===
    "script-src 'self'; object-src 'self'; connect-src http://127.0.0.1:3000",
  "extension scripts must be local and connections must use only the fixed local demo port",
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
const offscreenPath = resolvePackagedPath("offscreen.html");
await Promise.all([access(workerPath), access(panelPath), access(offscreenPath)]);

async function assertLocalDocument(documentPath) {
  const html = await readFile(documentPath, "utf8");
  const remoteReferencePattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  const moduleScriptPaths = [];
  for (const scriptTag of scriptTags) {
    const source = scriptTag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!source) continue;
    assert(!remoteReferencePattern.test(source), `remote script is forbidden: ${source}`);
    await access(resolvePackagedPath(source));
    if (/\btype=["']module["']/i.test(scriptTag)) moduleScriptPaths.push(source);
  }
  assert(
    moduleScriptPaths.length > 0,
    `${path.basename(documentPath)} must load a local module script`,
  );

  const stylesheetTags = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((linkTag) => /\brel=["']stylesheet["']/i.test(linkTag));
  for (const stylesheetTag of stylesheetTags) {
    const href = stylesheetTag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    assert(Boolean(href), "stylesheet link is missing href");
    assert(!remoteReferencePattern.test(href), `remote stylesheet is forbidden: ${href}`);
    await access(resolvePackagedPath(href));
  }
}

await assertLocalDocument(panelPath);
await assertLocalDocument(offscreenPath);

// Prove the packaged worker clears any inherited automatic-open preference and
// registers the explicit action listener the capture handshake depends on,
// rather than only asserting this against source that might not be what shipped.
const setPanelBehaviorCalls = [];
let actionListenerCount = 0;
globalThis.chrome = {
  action: { onClicked: { addListener: () => (actionListenerCount += 1) } },
  sidePanel: {
    async setPanelBehavior(options) {
      setPanelBehaviorCalls.push(options);
    },
  },
  storage: { session: { get: async () => ({}), set: async () => undefined } },
  tabs: { onRemoved: { addListener: () => undefined } },
  tabCapture: {
    getMediaStreamId: async () => {
      throw new Error("not exercised by package verification");
    },
    getCapturedTabs: async () => [],
    onStatusChanged: { addListener: () => undefined },
  },
  runtime: {
    onMessage: { addListener: () => undefined },
    sendMessage: async () => undefined,
    getContexts: async () => [],
    getURL: (relativePath) => `chrome-extension://package-verification/${relativePath}`,
  },
  offscreen: { createDocument: async () => undefined, closeDocument: async () => undefined },
};
await import(`${pathToFileURL(workerPath).href}?package-verification=${Date.now()}`);
assert(
  setPanelBehaviorCalls.length === 1,
  "packaged background worker must configure the side panel once",
);
assert(
  setPanelBehaviorCalls[0]?.openPanelOnActionClick === false,
  "packaged background worker must clear the automatic-open preference so the explicit capture flow controls invocation",
);
assert(
  actionListenerCount === 1,
  "packaged background worker must register exactly one explicit action.onClicked listener",
);

console.log("Packaged extension verification passed.");
