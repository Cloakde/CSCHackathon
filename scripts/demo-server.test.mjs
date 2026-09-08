import assert from "node:assert/strict";
import { test } from "node:test";
import { demoConfiguration } from "./demo-server.mjs";

test("normal launches strip inherited provider activation and never inspect credentials", () => {
  const config = demoConfiguration([], {
    GEMINI_API_KEY: "offline-fake-key",
    LIVELECTURE_ASSISTANCE_PROVIDER: "gemini",
    LIVELECTURE_APP_EXECUTE: "approved-one-dollar-v1",
    LIVELECTURE_APP_TREE: "a".repeat(40),
  });
  assert.equal(config.env.LIVELECTURE_ASSISTANCE_PROVIDER, "prewritten");
  assert.equal(config.env.LIVELECTURE_APP_EXECUTE, "");
});

test("Gemini app runs require explicit cap, clean exact source, and no CI", () => {
  const tree = "a".repeat(40);
  const repository = {
    sourceTree: tree,
    commit: "b".repeat(40),
    dirty: false,
    commonDir: process.cwd(),
  };
  const environment = { GEMINI_API_KEY: "offline-fake-credential-for-tests" };
  assert.throws(() => demoConfiguration(["--gemini"], environment, repository));
  const args = ["--gemini", "--approve-usd=1", `--source-tree=${tree}`];
  assert.throws(() => demoConfiguration(args, { ...environment, CI: "true" }, repository));
  assert.throws(() => demoConfiguration(args, environment, { ...repository, dirty: true }));
  const config = demoConfiguration(args, environment, repository);
  assert.equal(config.env.LIVELECTURE_APP_EXECUTE, "approved-one-dollar-v1");
  assert.equal(config.env.LIVELECTURE_APP_TREE, tree);
  assert.equal(config.env.LIVELECTURE_ASSISTANCE_PROVIDER, "gemini");
});

test("demo binds only to fixed loopback and is explicitly enabled", () => {
  const config = demoConfiguration([], { LIVELECTURE_DEMO_ENABLED: "false" });
  assert.deepEqual(config.args, ["dev", "--hostname", "127.0.0.1", "--port", "3000"]);
  assert.equal(config.env.LIVELECTURE_DEMO_ENABLED, "true");
  assert.equal(config.env.NEXT_TELEMETRY_DISABLED, "1");
  assert.equal(config.env.LIVELECTURE_EXTENSION_ID, "");
  assert.throws(() => demoConfiguration(["--hostname=0.0.0.0"]));
});

test("extension access is an exact validated ID, including environment input", () => {
  assert.throws(() => demoConfiguration([], { LIVELECTURE_EXTENSION_ID: "*" }));
  assert.throws(() => demoConfiguration(["--extension-id=invalid"]));
  const id = "abcdefghijklmnopabcdefghijklmnop";
  const config = demoConfiguration(["--production", `--extension-id=${id}`], {});
  assert.equal(config.args[0], "start");
  assert.equal(config.env.LIVELECTURE_EXTENSION_ID, id);
});
