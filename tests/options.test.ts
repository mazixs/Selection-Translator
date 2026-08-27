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

test("options page uses provider-specific keys and removes Yandex web", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(optionsHtml.includes('value="yandex-web"'), false);
  assert.equal(optionsHtml.includes('name="apiKey"'), false);
  assert.equal(optionsHtml.includes('name="yandexApiKey"'), true);
  assert.equal(optionsHtml.includes('name="libreTranslateApiKey"'), true);
  assert.equal(optionsScript.includes("fields.yandexApiKey.value"), true);
  assert.equal(optionsScript.includes("fields.libreTranslateApiKey.value"), true);
});

test("options endpoint permission check rejects credentialed URLs", () => {
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(optionsScript.includes("url.username"), true);
  assert.equal(optionsScript.includes("url.password"), true);
});

test("options page offers panel opacity with a live preview", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");
  const optionsCss = readFileSync(join(ROOT, "options/options.css"), "utf8");
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.match(optionsHtml, /name="panelOpacity" type="range" min="50" max="100"/);
  assert.equal(optionsHtml.includes('id="opacity-output"'), true);
  assert.equal(optionsHtml.includes('class="opacity-preview"'), true);
  assert.match(optionsCss, /rgb\(255 255 255 \/ var\(--preview-alpha, 1\)\)/);
  assert.match(optionsScript, /function applyPanelOpacity/);
  assert.match(optionsScript, /setProperty\(\s*"--preview-alpha"/);
});

test("options page shows only the fields of the selected provider", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  for (const provider of ["google", "yandex", "libretranslate"]) {
    assert.equal(
      optionsHtml.includes(`class="provider-fields" data-provider="${provider}"`),
      true,
      `${provider} group is present`,
    );
  }

  assert.equal(optionsHtml.includes('data-shown-when="manual-source"'), true);
  assert.match(optionsScript, /function applyDisclosure/);
  assert.match(optionsScript, /group\.hidden = group\.dataset\.provider !== fields\.provider\.value/);
  assert.match(optionsScript, /field\.hidden = fields\.autoDetectSource\.checked/);
});

test("options page keeps the save button honest about unsaved edits", () => {
  const optionsHtml = readFileSync(join(ROOT, "options/options.html"), "utf8");
  const optionsScript = readFileSync(join(ROOT, "options/options.ts"), "utf8");

  assert.equal(optionsHtml.includes('id="save-button"'), true);
  assert.match(optionsScript, /function setUnsaved/);
  assert.match(optionsScript, /saveButton\.disabled = !unsaved/);
  assert.match(optionsScript, /setUnsaved\(false\);/);
});
