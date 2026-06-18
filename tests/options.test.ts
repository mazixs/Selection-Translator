import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("options header uses the extension icon instead of a Yandex-like letter", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");

  assert.equal(optionsHtml.includes('<div class="brand-mark">Y</div>'), false);
  assert.equal(optionsHtml.includes('src="../assets/icon-48.png"'), true);
});

test("options page exposes a single icon theme toggle", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");

  assert.equal(optionsHtml.includes('id="theme-toggle"'), true);
  assert.equal(optionsHtml.includes('name="themePreference"'), true);
  assert.equal(optionsHtml.includes('class="theme-icon theme-icon-moon"'), true);
  assert.equal(optionsHtml.includes('class="theme-icon theme-icon-sun"'), true);
});

test("options styles inherit browser color scheme and allow explicit overrides", () => {
  const optionsCss = readFileSync(join(ROOT, "options/options.css"), "utf8");

  assert.equal(optionsCss.includes("color-scheme: light dark"), true);
  assert.equal(optionsCss.includes("@media (prefers-color-scheme: dark)"), true);
  assert.equal(optionsCss.includes(':root[data-theme="dark"]'), true);
  assert.equal(optionsCss.includes(':root[data-theme="light"]'), true);
});

test("options script resolves system theme and updates the theme toggle icon", () => {
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(
    optionsScript.includes('window.matchMedia?.("(prefers-color-scheme: dark)")'),
    true,
  );
  assert.equal(optionsScript.includes("dataset.themeResolved"), true);
  assert.equal(optionsScript.includes("themePreference"), true);
});

test("options script persists theme toggle without saving unrelated form edits", () => {
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(optionsScript.includes("const storedSettings = await loadSettings();"), true);
  assert.equal(
    optionsScript.includes("saveSettings({ ...storedSettings, themePreference: nextPreference })"),
    true,
  );
});

test("options page requests optional origin permission for custom LibreTranslate endpoint", () => {
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(optionsScript.includes("function getEndpointOriginPattern"), true);
  assert.equal(optionsScript.includes("chrome.permissions?.request"), true);
  assert.equal(optionsScript.includes("provider !== \"libretranslate\""), true);
  assert.equal(optionsScript.includes("origins: [originPattern]"), true);
});
