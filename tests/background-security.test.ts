import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("background validates message sender before privileged actions", () => {
  const backgroundScript = readFileSync(join(ROOT, "src/background.ts"), "utf8");

  assert.match(
    backgroundScript,
    /function isTrustedContentSender\(sender: chrome\.runtime\.MessageSender\): boolean \{/,
  );
  assert.equal(backgroundScript.includes("sender.id === chrome.runtime.id"), true);
  assert.equal(
    backgroundScript.includes('typeof sender.tab?.id === "number"'),
    true,
  );
  assert.match(
    backgroundScript,
    /if \(!runtimeMessage \|\| !isTrustedContentSender\(sender\)\) \{\s+return false;\s+\}/s,
  );
});

test("background no longer configures dynamic Yandex web header rewrites", () => {
  const backgroundScript = readFileSync(join(ROOT, "src/background.ts"), "utf8");

  assert.equal(backgroundScript.includes("declarativeNetRequest"), false);
  assert.equal(backgroundScript.includes("modifyHeaders"), false);
  assert.equal(backgroundScript.includes("configureYandexWebHeaderRules"), false);
});
