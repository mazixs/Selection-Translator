import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("background validates message sender before privileged actions", () => {
  const backgroundScript = readFileSync(join(ROOT, "src/background.ts"), "utf8");

  assert.match(
    backgroundScript,
    /function isTrustedContentSender\(sender: chrome\.runtime\.MessageSender\): boolean \{/,
  );
  assert.equal(backgroundScript.includes("sender.id === chrome.runtime.id"), true);
  assert.equal(backgroundScript.includes('typeof sender.tab?.id === "number"'), true);
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

test("background reads settings from storage per request and keeps the menu up to date", () => {
  const backgroundScript = readFileSync(join(ROOT, "src/background.ts"), "utf8");

  // A worker-lifetime copy went stale between a write and its onChanged event.
  assert.equal(backgroundScript.includes("createSettingsCache"), false);
  assert.match(backgroundScript, /const settings = await loadSettings\(\);/);
  assert.match(backgroundScript, /sendResponse\(await loadSettings\(\)\)/);
  // An older refresh still waiting for settings must not overwrite a newer menu.
  assert.match(backgroundScript, /const refreshId = \+\+menuRefreshId;/);
  assert.match(backgroundScript, /if \(refreshId === menuRefreshId\)/);
  // A failed read still leaves a menu, in the browser language.
  assert.match(backgroundScript, /return getUiLocale\("auto"\);/);
});
