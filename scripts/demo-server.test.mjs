import assert from "node:assert/strict";
import { test } from "node:test";
import { demoConfiguration } from "./demo-server.mjs";

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
