import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("translation panel avoids semantic page tags that inherit site styles", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.js"), "utf8");

  assert.equal(contentScript.includes('document.createElement("section")'), false);
  assert.equal(contentScript.includes("<header"), false);
  assert.equal(contentScript.includes("</header>"), false);
  assert.equal(contentScript.includes("<footer"), false);
  assert.equal(contentScript.includes("</footer>"), false);
});

test("content script guards against stale translation responses", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.js"), "utf8");

  assert.match(contentScript, /let activeTranslationRequestId = 0;/);
  assert.match(contentScript, /const requestId = \+\+activeTranslationRequestId;/);
  assert.match(contentScript, /requestId !== activeTranslationRequestId/);
});

test("content script caches settings and listens for storage changes", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.js"), "utf8");

  assert.match(contentScript, /let cachedSettings = \{ \.\.\.DEFAULT_SETTINGS \};/);
  assert.match(contentScript, /async function refreshSettings/);
  assert.equal(contentScript.includes("chrome.storage.onChanged.addListener"), true);
  assert.equal(contentScript.includes("changes?.targetLanguage"), true);
});

test("selection toolbar uses the extension icon instead of a Yandex-like letter", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.js"), "utf8");

  assert.equal(contentScript.includes('badge.textContent = "Y"'), false);
  assert.equal(contentScript.includes('chrome.runtime.getURL("assets/icon-32.png")'), true);
});
