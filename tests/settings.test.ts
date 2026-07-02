import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  clampMaxCharacters,
  mergeSettings,
  saveSettings,
} from "../src/settings.js";

test("mergeSettings keeps defaults for missing values and accepts user overrides", () => {
  const settings = mergeSettings({
    provider: "yandex",
    targetLanguage: "en",
    showSelectionToolbar: false,
    themePreference: "dark",
    maxCharacters: 12000,
    yandexApiKey: "yandex-secret",
  });

  assert.equal(settings.targetLanguage, "en");
  assert.equal(settings.showSelectionToolbar, false);
  assert.equal(settings.provider, "yandex");
  assert.equal(settings.yandexApiKey, "yandex-secret");
  assert.equal(settings.themePreference, "dark");
  assert.equal(settings.yandexFolderId, DEFAULT_SETTINGS.yandexFolderId);
  assert.equal(settings.autoDetectSource, DEFAULT_SETTINGS.autoDetectSource);
  assert.equal(settings.maxCharacters, 12000);
});

test("mergeSettings falls back when legacy Yandex web provider is stored", () => {
  const settings = mergeSettings({
    provider: "yandex-web",
  });

  assert.equal(settings.provider, DEFAULT_SETTINGS.provider);
});

test("mergeSettings migrates legacy apiKey only to the active provider", () => {
  const yandexSettings = mergeSettings({
    provider: "yandex",
    apiKey: "legacy-yandex",
  });
  const libreSettings = mergeSettings({
    provider: "libretranslate",
    apiKey: "legacy-libre",
  });
  const googleSettings = mergeSettings({
    provider: "google",
    apiKey: "legacy-google",
  });

  assert.equal(yandexSettings.yandexApiKey, "legacy-yandex");
  assert.equal(yandexSettings.libreTranslateApiKey, "");
  assert.equal(libreSettings.yandexApiKey, "");
  assert.equal(libreSettings.libreTranslateApiKey, "legacy-libre");
  assert.equal(googleSettings.yandexApiKey, "");
  assert.equal(googleSettings.libreTranslateApiKey, "");
});

test("mergeSettings prefers explicit provider keys over legacy apiKey", () => {
  const settings = mergeSettings({
    provider: "yandex",
    apiKey: "legacy-yandex",
    yandexApiKey: "new-yandex",
  });

  assert.equal(settings.yandexApiKey, "new-yandex");
});

test("saveSettings removes legacy apiKey from storage", async () => {
  let savedSettings: unknown;
  let removedKeys: unknown;

  await saveSettings(
    {
      provider: "yandex",
      yandexApiKey: "new-yandex",
    },
    {
      async get() {
        return {};
      },
      async set(settings) {
        savedSettings = settings;
      },
      async remove(keys) {
        removedKeys = keys;
      },
    },
  );

  assert.equal((savedSettings as Record<string, unknown>).yandexApiKey, "new-yandex");
  assert.equal("apiKey" in (savedSettings as Record<string, unknown>), false);
  assert.equal(removedKeys, "apiKey");
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
