export type TranslationProvider =
  | "google"
  | "yandex"
  | "libretranslate";

export type ThemePreference = "system" | "light" | "dark";

export type Settings = {
  provider: TranslationProvider;
  targetLanguage: string;
  sourceLanguage: string;
  endpoint: string;
  yandexApiKey: string;
  libreTranslateApiKey: string;
  yandexFolderId: string;
  themePreference: ThemePreference;
  autoDetectSource: boolean;
  showSelectionToolbar: boolean;
  keepPanelOpen: boolean;
  maxCharacters: number;
};

export type SettingsInput = Partial<Record<keyof Settings, unknown>> & {
  apiKey?: unknown;
};

type StorageAreaLike = {
  get(defaults: SettingsInput): Promise<Record<string, unknown>>;
  set(settings: Settings): Promise<void>;
  remove?(keys: string | string[]): Promise<void>;
};

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  provider: "google",
  targetLanguage: "ru",
  sourceLanguage: "auto",
  endpoint: "",
  yandexApiKey: "",
  libreTranslateApiKey: "",
  yandexFolderId: "",
  themePreference: "system",
  autoDetectSource: true,
  showSelectionToolbar: true,
  keepPanelOpen: false,
  maxCharacters: 5000,
});

const MIN_MAX_CHARACTERS = 100;
const MAX_MAX_CHARACTERS = 50000;

export function clampMaxCharacters(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SETTINGS.maxCharacters;
  }

  return Math.min(
    MAX_MAX_CHARACTERS,
    Math.max(MIN_MAX_CHARACTERS, Math.trunc(parsed)),
  );
}

function getStringSetting(
  value: unknown,
  fallback: string,
  options: { trim?: boolean } = {},
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const nextValue = options.trim === false ? value : value.trim();
  return nextValue ? nextValue : fallback;
}

function getOptionalStringSetting(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getProvider(value: unknown): TranslationProvider {
  return value === "libretranslate" ||
    value === "google" ||
    value === "yandex"
    ? value
    : DEFAULT_SETTINGS.provider;
}

function getThemePreference(value: unknown): ThemePreference {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : DEFAULT_SETTINGS.themePreference;
}

export function mergeSettings(settings: SettingsInput = {}): Settings {
  const provider = getProvider(settings.provider);
  const legacyApiKey = getOptionalStringSetting(settings.apiKey);
  const yandexApiKey =
    getOptionalStringSetting(settings.yandexApiKey) ||
    (provider === "yandex" ? legacyApiKey : "");
  const libreTranslateApiKey =
    getOptionalStringSetting(settings.libreTranslateApiKey) ||
    (provider === "libretranslate" ? legacyApiKey : "");

  return {
    ...DEFAULT_SETTINGS,
    provider,
    targetLanguage: getStringSetting(
      settings.targetLanguage,
      DEFAULT_SETTINGS.targetLanguage,
    ),
    sourceLanguage: getStringSetting(
      settings.sourceLanguage,
      DEFAULT_SETTINGS.sourceLanguage,
    ),
    endpoint: getOptionalStringSetting(settings.endpoint),
    yandexApiKey,
    libreTranslateApiKey,
    yandexFolderId: getOptionalStringSetting(settings.yandexFolderId),
    themePreference: getThemePreference(settings.themePreference),
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

export async function loadSettings(
  storageArea: StorageAreaLike | undefined = globalThis.chrome?.storage?.sync,
): Promise<Settings> {
  if (!storageArea?.get) {
    return mergeSettings();
  }

  const stored = await storageArea.get({ ...DEFAULT_SETTINGS, apiKey: "" });
  return mergeSettings(stored);
}

export async function saveSettings(
  nextSettings: SettingsInput,
  storageArea: StorageAreaLike | undefined = globalThis.chrome?.storage?.sync,
): Promise<Settings> {
  const settings = mergeSettings(nextSettings);

  if (!storageArea?.set) {
    return settings;
  }

  await storageArea.set(settings);
  await storageArea.remove?.("apiKey");
  return settings;
}
