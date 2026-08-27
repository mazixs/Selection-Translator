import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("translation panel avoids semantic page tags that inherit site styles", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.equal(contentScript.includes('document.createElement("section")'), false);
  assert.equal(contentScript.includes("<header"), false);
  assert.equal(contentScript.includes("</header>"), false);
  assert.equal(contentScript.includes("<footer"), false);
  assert.equal(contentScript.includes("</footer>"), false);
});

test("content script guards against stale translation responses", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(contentScript, /let activeTranslationRequestId = 0;/);
  assert.match(contentScript, /const requestId = \+\+activeTranslationRequestId;/);
  assert.match(contentScript, /requestId !== activeTranslationRequestId/);
});

test("content script caches settings and listens for storage changes", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(contentScript, /let cachedSettings: Settings = \{ \.\.\.DEFAULT_SETTINGS \};/);
  assert.match(contentScript, /async function refreshSettings/);
  assert.equal(contentScript.includes("chrome.storage.onChanged.addListener"), true);
  assert.equal(contentScript.includes("changes?.targetLanguage"), true);
  assert.equal(contentScript.includes("cachedSettings = mergeSettings"), true);
});

test("selection toolbar uses the extension icon instead of a Yandex-like letter", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.equal(contentScript.includes('badge.textContent = "Y"'), false);
  assert.equal(contentScript.includes('chrome.runtime.getURL("assets/icon-32.png")'), true);
});

test("content script ignores synthetic page events for privileged UI actions", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /function isTrustedUserEvent\(event: Event\): boolean \{\s+return event\.isTrusted === true;\s+\}/s,
  );
  assert.match(
    contentScript,
    /toolbar\.addEventListener\("click", \(event\) => \{\s+if \(!isTrustedUserEvent\(event\)\)/s,
  );
  assert.match(
    contentScript,
    /async function handleLanguageChange\(event: Event\) \{\s+if \(!isTrustedUserEvent\(event\)\)/s,
  );
  assert.equal(
    (contentScript.match(/if \(!isTrustedUserEvent\(event\)\)/g) || []).length >= 4,
    true,
  );
});

test("panel text can be selected by hand while the toolbar keeps the page selection", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const contentStyles = readFileSync(join(ROOT, "src/content.css"), "utf8");

  assert.match(
    contentScript,
    /if \(!isSelectableTarget\(event\.target\)\) \{\s+event\.preventDefault\(\);/s,
  );
  assert.match(
    contentScript,
    /async function updateSelectionFromPage[\s\S]{0,220}isSelectionInsideUi\(window\.getSelection\(\)\)/,
  );
  assert.match(contentStyles, /\.stx-panel-text \{\s+cursor: text;/);
  assert.match(contentStyles, /user-select: text;/);
});

test("copying falls back to a textarea and reports a failure", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(contentScript, /async function copyText\(text: unknown\): Promise<boolean>/);
  assert.match(
    contentScript,
    /await navigator\.clipboard\.writeText\(value\);\s+return true;\s+\} catch \{/s,
  );
  assert.match(contentScript, /return copyThroughTextarea\(value\);/);
  assert.match(contentScript, /copied = document\.execCommand\("copy"\);/);
  assert.match(contentScript, /Ctrl\+C/);
});
