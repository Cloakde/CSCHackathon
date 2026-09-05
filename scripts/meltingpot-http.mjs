import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Uses existing servers only. It never starts/stops a server or opens a browser.
const root = fileURLToPath(new URL("../", import.meta.url));
const LL_ORIGIN = "http://127.0.0.1:3000";
const MP_ORIGIN = "http://127.0.0.1:3111";
const flags = ["meltingpot-root", "livelecture-server-root", "livelecture-server-commit"];
const args = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--([^=]+)=(.+)$/.exec(argument);
  assert.ok(
    match && flags.includes(match[1]) && !args.has(match[1]),
    "Unexpected or duplicate argument.",
  );
  args.set(match[1], match[2]);
}
assert.equal(
  args.size,
  flags.length,
  "Usage: node scripts/meltingpot-http.mjs --meltingpot-root=PATH --livelecture-server-root=PATH --livelecture-server-commit=SHA",
);
const meltingpot = path.resolve(args.get("meltingpot-root"));
const serverRoot = path.resolve(args.get("livelecture-server-root"));
const serverCommit = args.get("livelecture-server-commit");
assert.match(
  serverCommit,
  /^[a-f0-9]{40}$/,
  "Supply the exact existing LiveLecture server revision.",
);

function git(directory, ...gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: directory, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Git verification failed in ${directory}.`);
  return result.stdout.trimEnd();
}

const backendPaths = [
  "shared/src",
  "shared/fixtures",
  "web/src/server",
  "web/src/app/api",
  "web/next.config.ts",
  "web/package.json",
  "shared/package.json",
  "package-lock.json",
];
assert.equal(
  git(serverRoot, "rev-parse", "HEAD"),
  serverCommit,
  "Existing server checkout is not at its declared revision.",
);
assert.equal(
  git(serverRoot, "status", "--porcelain", "--", ...backendPaths),
  "",
  "Existing server backend has uncommitted changes.",
);
assert.equal(
  git(root, "status", "--porcelain"),
  "",
  "Commit the LiveLecture candidate before paired verification.",
);
assert.equal(
  git(meltingpot, "status", "--porcelain"),
  "",
  "Commit the MeltingPot candidate before paired verification.",
);
const sourceNames = (directory) =>
  [
    ...new Set(
      git(
        directory,
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        ...backendPaths,
      )
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
const names = sourceNames(root);
assert.ok(names.length > 0, "No LiveLecture backend sources were found.");
assert.deepEqual(
  sourceNames(serverRoot),
  names,
  "Candidate and existing server backend file sets differ.",
);
const backendHash = createHash("sha256");
const backendFiles = {};
for (const name of names) {
  const bytes = readFileSync(path.join(root, name));
  assert.deepEqual(
    bytes,
    readFileSync(path.join(serverRoot, name)),
    `Existing server source differs: ${name}`,
  );
  backendFiles[name] = createHash("sha256").update(bytes).digest("hex");
  backendHash.update(name).update("\0").update(bytes).update("\0");
}

const { verifyContracts } = await import(
  pathToFileURL(path.join(meltingpot, "scripts/verify-livelecture-contracts.mjs"))
);
const { reworkEnvironment, runtimeFingerprint } = await import(
  pathToFileURL(path.join(meltingpot, "scripts/rework-environment.mjs"))
);
reworkEnvironment(meltingpot);
const provenance = verifyContracts(root);
const fingerprint = runtimeFingerprint(meltingpot);
const stamp = JSON.parse(
  readFileSync(path.join(meltingpot, "web/.next/livelecture-rework-build.json"), "utf8"),
);
assert.equal(stamp.mode, "synthetic-v1", "MeltingPot was not built in isolated mode.");
assert.equal(stamp.fingerprint, fingerprint, "MeltingPot source changed since its isolated build.");

// Node 24 strips these existing TypeScript schemas. Resolve only their local
// extensionless imports; use the canonical schemas instead of another wire model.
const schemaBase = pathToFileURL(path.join(root, "shared/src/schemas/")).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.startsWith(schemaBase) &&
      specifier.startsWith(".") &&
      !path.extname(specifier)
    ) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
});
let ApiContracts, ApiErrorSchema, CompletedSessionViewSchema, assertWeakAreaDrillLinkage;
try {
  ({ ApiContracts } = await import(new URL("api.ts", schemaBase)));
  ({ ApiErrorSchema } = await import(new URL("common.ts", schemaBase)));
  ({ CompletedSessionViewSchema } = await import(new URL("session.ts", schemaBase)));
  ({ assertWeakAreaDrillLinkage } = await import(new URL("study.ts", schemaBase)));
} finally {
  hooks.deregister();
}

const evidence = {
  livelectureCandidateCommit: git(root, "rev-parse", "HEAD"),
  existingLivelectureServerCommit: serverCommit,
  existingServerWasReused: true,
  meltingpotCandidateCommit: git(meltingpot, "rev-parse", "HEAD"),
  meltingpotBuildFingerprint: fingerprint,
  canonicalSchemaCommit: provenance.sourceCommit,
  canonicalSchemaHashes: provenance.files,
  backendFingerprint: backendHash.digest("hex"),
  backendSourceHashes: backendFiles,
};
console.log(JSON.stringify({ pairedSourceEvidence: evidence }, null, 2));

async function http(origin, pathname, { method = "GET", headers = {}, body } = {}) {
  assert.ok(origin === LL_ORIGIN || origin === MP_ORIGIN);
  assert.ok(pathname.startsWith("/") && !pathname.startsWith("//"));
  const url = new URL(pathname, origin);
  assert.equal(url.origin, origin, "Only fixed local origins may be called.");
  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.redirected, false, "Unexpected redirect.");
  const pieces = [];
  let length = 0;
  const reader = response.body?.getReader();
  try {
    if (reader)
      for (;;) {
        const piece = await reader.read();
        if (piece.done) break;
        length += piece.value.byteLength;
        assert.ok(length <= 1024 * 1024, "HTTP smoke response is too large.");
        pieces.push(piece.value);
      }
  } finally {
    await reader?.cancel();
  }
  return { response, text: Buffer.concat(pieces).toString("utf8") };
}

function noStore(response, label) {
  assert.ok(
    response.headers
      .get("cache-control")
      ?.split(",")
      .some((part) => part.trim() === "no-store"),
    `${label} must not be cached.`,
  );
}
function privateResponse(response, label) {
  noStore(response, label);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    null,
    `${label} must not allow cross-origin access.`,
  );
  assert.equal(
    response.headers.get("set-cookie"),
    null,
    `${label} must not create an inherited auth cookie.`,
  );
}
const requestHeaders = (origin, body) => ({
  Origin: origin,
  ...(origin === MP_ORIGIN
    ? { "X-LiveLecture-Rework": "synthetic-v1" }
    : { "X-LiveLecture-Demo": "scripted-v1" }),
  ...(body === undefined ? {} : { "Content-Type": "application/json" }),
});
async function api(origin, pathname, contract, method = "GET", body) {
  const { response, text } = await http(origin, pathname, {
    method,
    headers: requestHeaders(origin, body),
    body,
  });
  noStore(response, pathname);
  if (origin === MP_ORIGIN) privateResponse(response, pathname);
  assert.equal(response.status, 200, `${pathname}: HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const envelope = contract.response.parse(JSON.parse(text));
  assert.equal(envelope.ok, true, `${pathname} did not succeed.`);
  return envelope.data;
}
async function deleted(origin, pathname) {
  const { response, text } = await http(origin, pathname, {
    method: "DELETE",
    headers: requestHeaders(origin),
  });
  noStore(response, pathname);
  if (origin === MP_ORIGIN) privateResponse(response, pathname);
  assert.equal(response.status, 200, `Cleanup: ${pathname}: HTTP ${response.status}`);
  const envelope = JSON.parse(text);
  assert.deepEqual(Object.keys(envelope).sort(), ["data", "ok"]);
  assert.equal(envelope.ok, true);
  assert.deepEqual(Object.keys(envelope.data), ["deleted"]);
  assert.equal(typeof envelope.data.deleted, "boolean");
  return envelope.data.deleted;
}
async function missing(origin, pathname) {
  const { response, text } = await http(origin, pathname, { headers: requestHeaders(origin) });
  noStore(response, pathname);
  if (origin === MP_ORIGIN) privateResponse(response, pathname);
  assert.equal(response.status, 404, `${pathname} must be unavailable after deletion.`);
  assert.equal(ApiErrorSchema.parse(JSON.parse(text)).error.code, "SESSION_NOT_FOUND");
}
async function page(pathname) {
  const { response, text } = await http(MP_ORIGIN, pathname);
  assert.equal(response.status, 200, `${pathname}: isolated MeltingPot is not available.`);
  privateResponse(response, pathname);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /(?:^|;)\s*connect-src 'self'(?:;|$)/);
  assert.doesNotMatch(csp, /https?:|wss?:|\*/);
  assert.match(text, /Simulation Mode/i);
  assert.match(text, /practice are prewritten/i);
  assert.match(text, /Private local demo/i);
  return text;
}

let ownedSessionId;
let failure;
try {
  // Establish isolated mode before sending even negative requests to inherited paths.
  await page("/lectures");
  const marker = `M3 paired HTTP smoke ${randomUUID()}`;
  const { session } = await api(LL_ORIGIN, "/api/sessions", ApiContracts.startSession, "POST", {
    sourceMode: "simulation",
    title: marker,
  });
  assert.equal(session.sourceMode, "simulation");
  assert.equal(session.title, marker, "The server did not return the newly created test session.");
  ownedSessionId = session.sessionId;
  const llPath = `/api/sessions/${ownedSessionId}`;
  const mpPath = `/api/lectures/${ownedSessionId}`;
  const fixture = JSON.parse(
    readFileSync(path.join(root, "shared/fixtures/calculus-lecture.json"), "utf8"),
  );
  const chunks = fixture.events
    .filter((event) => event.type === "transcript.committed")
    .map((event) => ({ ...event.chunk, sessionId: ownedSessionId }));
  assert.equal(chunks.length, 10);
  const firstUpload = await api(
    LL_ORIGIN,
    `${llPath}/chunks`,
    ApiContracts.appendCommittedChunks,
    "POST",
    { chunks: chunks.slice(0, 3) },
  );
  assert.deepEqual(
    firstUpload.acceptedChunkIds,
    chunks.slice(0, 3).map((chunk) => chunk.chunkId),
  );
  const first = await api(LL_ORIGIN, `${llPath}/im-lost`, ApiContracts.imLost, "POST", {
    lookbackMs: 900_000,
  });
  assert.equal(first.groundingStatus, "grounded");
  assert.equal(first.confusionEvent.conceptId, "concept_inner_outer");
  await api(LL_ORIGIN, `${llPath}/chunks`, ApiContracts.appendCommittedChunks, "POST", { chunks });
  const second = await api(LL_ORIGIN, `${llPath}/im-lost`, ApiContracts.imLost, "POST", {
    lookbackMs: 900_000,
  });
  assert.equal(second.groundingStatus, "grounded");
  assert.equal(second.confusionEvent.conceptId, "concept_inner_derivative");
  const endedAt = new Date(Date.parse(session.startedAt) + chunks.at(-1).endMs).toISOString();
  const ended = await api(LL_ORIGIN, `${llPath}/end`, ApiContracts.endSession, "POST", { endedAt });
  assert.equal(ended.session.sessionId, ownedSessionId);
  assert.equal(ended.handoff.companionRoute, `/sessions/${ownedSessionId}`);
  assert.deepEqual(
    await api(LL_ORIGIN, `${llPath}/end`, ApiContracts.endSession, "POST", { endedAt }),
    ended,
  );
  const view = CompletedSessionViewSchema.parse(
    await api(MP_ORIGIN, mpPath, ApiContracts.getSession),
  );
  assert.equal(view.session.sessionId, ownedSessionId);
  assert.equal(view.session.sourceMode, "simulation");
  assert.deepEqual(view.committedChunks, chunks);
  assert.deepEqual(view.confusionEvents, [first.confusionEvent, second.confusionEvent]);
  assert.deepEqual(view, await api(LL_ORIGIN, llPath, ApiContracts.getSession));
  const prompts = [];
  for (const help of [first, second]) {
    const request = { confusionEventIds: [help.confusionEvent.confusionId] };
    const drill = await api(
      MP_ORIGIN,
      `${mpPath}/practice`,
      ApiContracts.createWeakAreaDrill,
      "POST",
      request,
    );
    assertWeakAreaDrillLinkage(
      { sessionId: ownedSessionId, ...request },
      view.confusionEvents,
      drill,
    );
    for (const citation of help.citations) {
      const chunk = view.committedChunks.find((item) => item.chunkId === citation.chunkId);
      assert.ok(chunk, "Help evidence must resolve in this session.");
      assert.equal(citation.startMs, chunk.startMs);
      assert.equal(citation.endMs, chunk.endMs);
    }
    for (const chunkId of drill.evidenceChunkIds)
      assert.ok(
        view.committedChunks.some((chunk) => chunk.chunkId === chunkId),
        "Practice evidence must resolve in this session.",
      );
    prompts.push(drill.practiceItems[0].prompt);
  }
  assert.notEqual(prompts[0], prompts[1], "Two concepts require different practice questions.");
  assert.match(await page(`/lectures/${ownedSessionId}`), /Your private lecture review/);

  for (const headers of [
    {},
    { "X-LiveLecture-Rework": "wrong" },
    { "X-LiveLecture-Rework": "synthetic-v1", Origin: "https://example.invalid" },
  ]) {
    const { response, text } = await http(MP_ORIGIN, mpPath, { headers });
    assert.equal(response.status, 403, "Invalid local access must be rejected.");
    privateResponse(response, mpPath);
    assert.equal(ApiErrorSchema.parse(JSON.parse(text)).error.code, "INVALID_REQUEST");
  }
  const preflight = await http(MP_ORIGIN, mpPath, {
    method: "OPTIONS",
    headers: { Origin: "https://example.invalid", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(preflight.response.status, 403);
  privateResponse(preflight.response, "preflight");

  for (const [pathname, method] of [
    ["/login", "GET"],
    ["/login.png", "GET"],
    ["/%6cogin", "GET"],
    ["/p/fixture_class", "GET"],
    ["/p/fixture_class.png", "GET"],
    ["/%70/fixture_class", "GET"],
    ["/admin", "GET"],
    ["/admin.png", "GET"],
    ["/%61dmin", "GET"],
    ["/api/ai/study", "POST"],
    ["/api/ai/organize.png", "POST"],
    ["/api/%61i/study", "POST"],
    ["/supabase/rest/v1/pots", "GET"],
    ["/api/attachments/fixture.png", "GET"],
  ]) {
    const { response, text } = await http(MP_ORIGIN, pathname, {
      method,
      headers: requestHeaders(MP_ORIGIN),
    });
    assert.equal(
      response.status,
      404,
      `${pathname} must be blocked before inherited services run.`,
    );
    privateResponse(response, pathname);
    assert.match(text, /surface is unavailable in the local lecture demo/i);
  }

  assert.equal(await deleted(MP_ORIGIN, mpPath), true);
  await missing(MP_ORIGIN, mpPath);
  await missing(LL_ORIGIN, llPath);
} catch (error) {
  failure = error;
} finally {
  // Only the session created above is ever eligible for cleanup. Use the original
  // local API so a broken MeltingPot destination cannot prevent deletion.
  if (ownedSessionId) {
    try {
      await deleted(LL_ORIGIN, `/api/sessions/${ownedSessionId}`);
    } catch (cleanupError) {
      failure = failure
        ? new AggregateError(
            [failure, cleanupError],
            "Paired smoke failed and its test session cleanup could not be confirmed.",
          )
        : cleanupError;
    }
  }
}
if (failure) throw failure;
console.log(
  "Paired production HTTP PASS: existing LiveLecture backend source parity, isolated MeltingPot build, two concepts and distinct practice, evidence, repeated Finish, local access guards, inherited-route rejection, and test-session deletion. Servers were reused and left running. No browser or provider was used.",
);
