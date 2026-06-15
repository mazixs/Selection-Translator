export const DEFAULT_SETTINGS = Object.freeze({
  provider: "google",
  targetLanguage: "ru",
  sourceLanguage: "auto",
  endpoint: "",
  apiKey: "",
  yandexFolderId: "",
  themePreference: "system",
  autoDetectSource: true,
  showSelectionToolbar: true,
  keepPanelOpen: false,
  maxCharacters: 5000,
});

const MIN_MAX_CHARACTERS = 100;
const MAX_MAX_CHARACTERS = 50000;

export function clampMaxCharacters(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SETTINGS.maxCharacters;
  }

  return Math.min(
    MAX_MAX_CHARACTERS,
    Math.max(MIN_MAX_CHARACTERS, Math.trunc(parsed)),
  );
}

export function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    provider:
      settings.provider === "libretranslate" ||
      settings.provider === "google" ||
      settings.provider === "yandex" ||
      settings.provider === "yandex-web"
        ? settings.provider
        : DEFAULT_SETTINGS.provider,
    targetLanguage:
      typeof settings.targetLanguage === "string" && settings.targetLanguage.trim()
        ? settings.targetLanguage.trim()
        : DEFAULT_SETTINGS.targetLanguage,
    sourceLanguage:
      typeof settings.sourceLanguage === "string" && settings.sourceLanguage.trim()
        ? settings.sourceLanguage.trim()
        : DEFAULT_SETTINGS.sourceLanguage,
    endpoint:
      typeof settings.endpoint === "string"
        ? settings.endpoint.trim()
        : DEFAULT_SETTINGS.endpoint,
    apiKey:
      typeof settings.apiKey === "string"
        ? settings.apiKey.trim()
        : DEFAULT_SETTINGS.apiKey,
    yandexFolderId:
      typeof settings.yandexFolderId === "string"
        ? settings.yandexFolderId.trim()
        : DEFAULT_SETTINGS.yandexFolderId,
    themePreference:
      settings.themePreference === "system" ||
      settings.themePreference === "light" ||
      settings.themePreference === "dark"
        ? settings.themePreference
        : DEFAULT_SETTINGS.themePreference,
    autoDetectSource: Boolean(
      settings.autoDetectSource ?? DEFAULT_SETTINGS.autoDetectSource,
    ),
    showSelectionToolbar: Boolean(
      settings.showSelectionToolbar ?? DEFAULT_SETTINGS.showSelectionToolbar,
    ),
    keepPanelOpen: Boolean(
      settings.keepPanelOpen ?? DEFAULT_SETTINGS.keepPanelOpen,
    ),
    maxCharacters: clampMaxCharacters(
      settings.maxCharacters ?? DEFAULT_SETTINGS.maxCharacters,
    ),
  };
}

export async function loadSettings(storageArea = globalThis.chrome?.storage?.sync) {
  if (!storageArea?.get) {
    return mergeSettings();
  }

  const stored = await storageArea.get(DEFAULT_SETTINGS);
  return mergeSettings(stored);
}

export async function saveSettings(
  nextSettings,
  storageArea = globalThis.chrome?.storage?.sync,
) {
  const settings = mergeSettings(nextSettings);

  if (!storageArea?.set) {
    return settings;
  }

  await storageArea.set(settings);
  return settings;
}
