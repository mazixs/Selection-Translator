import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("options page requests optional origin permission for custom LibreTranslate endpoint", () => {
  const optionsScript = readFileSync(join(ROOT, "options/options.js"), "utf8");

  assert.equal(optionsScript.includes("function getEndpointOriginPattern"), true);
  assert.equal(optionsScript.includes("chrome.permissions?.request"), true);
  assert.equal(optionsScript.includes("provider !== \"libretranslate\""), true);
  assert.equal(optionsScript.includes("origins: [originPattern]"), true);
});
