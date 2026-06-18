import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  clampMaxCharacters,
  mergeSettings,
} from "../src/settings.js";

test("mergeSettings keeps defaults for missing values and accepts user overrides", () => {
  const settings = mergeSettings({
    provider: "yandex-web",
    targetLanguage: "en",
    showSelectionToolbar: false,
    themePreference: "dark",
    maxCharacters: 12000,
  });

  assert.equal(settings.targetLanguage, "en");
  assert.equal(settings.showSelectionToolbar, false);
  assert.equal(settings.provider, "yandex-web");
  assert.equal(settings.themePreference, "dark");
  assert.equal(settings.yandexFolderId, DEFAULT_SETTINGS.yandexFolderId);
  assert.equal(settings.autoDetectSource, DEFAULT_SETTINGS.autoDetectSource);
  assert.equal(settings.maxCharacters, 12000);
});

test("mergeSettings falls back to system theme for unsupported theme values", () => {
  const settings = mergeSettings({
    themePreference: "sepia",
  });

  assert.equal(DEFAULT_SETTINGS.themePreference, "system");
  assert.equal(settings.themePreference, "system");
});

test("clampMaxCharacters keeps translation limits inside the supported range", () => {
  assert.equal(clampMaxCharacters("10"), 100);
  assert.equal(clampMaxCharacters(2500), 2500);
  assert.equal(clampMaxCharacters(100000), 50000);
  assert.equal(clampMaxCharacters("not a number"), DEFAULT_SETTINGS.maxCharacters);
});
