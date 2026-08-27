import {
  clampPanelOpacity,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
  type SettingsInput,
  type ThemePreference,
} from "../src/settings.js";

type ResolvedTheme = "light" | "dark";

type SettingsFormControls = HTMLFormControlsCollection & {
  themePreference: HTMLInputElement;
  targetLanguage: HTMLSelectElement;
  provider: HTMLSelectElement;
  sourceLanguage: HTMLInputElement;
  endpoint: HTMLInputElement;
  yandexApiKey: HTMLInputElement;
  libreTranslateApiKey: HTMLInputElement;
  yandexFolderId: HTMLInputElement;
  autoDetectSource: HTMLInputElement;
  showSelectionToolbar: HTMLInputElement;
  keepPanelOpen: HTMLInputElement;
  autoFallbackProvider: HTMLInputElement;
  panelOpacity: HTMLInputElement;
  maxCharacters: HTMLInputElement;
};

type SettingsFormElement = HTMLFormElement & {
  readonly elements: SettingsFormControls;
};

function getRequiredElement<T extends Element>(
  selector: string,
  constructor: { new (...args: never[]): T },
): T {
  const element = document.querySelector(selector);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

const form = getRequiredElement("#settings-form", HTMLFormElement) as SettingsFormElement;
const fields = form.elements;
const resetButton = getRequiredElement("#reset-button", HTMLButtonElement);
const saveButton = getRequiredElement("#save-button", HTMLButtonElement);
const opacityOutput = getRequiredElement("#opacity-output", HTMLOutputElement);
const status = getRequiredElement("#status", HTMLSpanElement);
const providerGroups = [
  ...document.querySelectorAll<HTMLElement>(".provider-fields"),
];
const manualSourceFields = [
  ...document.querySelectorAll<HTMLElement>('[data-shown-when="manual-source"]'),
];
const themeToggleButton = getRequiredElement("#theme-toggle", HTMLButtonElement);
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

function normalizeThemePreference(themePreference: unknown): ThemePreference {
  return themePreference === "light" || themePreference === "dark"
    ? themePreference
    : "system";
}

function getSystemTheme(): ResolvedTheme {
  return systemThemeQuery?.matches ? "dark" : "light";
}

function getResolvedTheme(themePreference: unknown): ResolvedTheme {
  const preference = normalizeThemePreference(themePreference);
  return preference === "system" ? getSystemTheme() : preference;
}

function getThemeToggleLabel(resolvedTheme: ResolvedTheme): string {
  return resolvedTheme === "dark"
    ? "Включить светлую тему"
    : "Включить темную тему";
}

function applyThemePreference(themePreference: unknown) {
  const preference = normalizeThemePreference(themePreference);
  const resolvedTheme = getResolvedTheme(preference);

  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.themeResolved = resolvedTheme;
  fields.themePreference.value = preference;

  const label = getThemeToggleLabel(resolvedTheme);
  themeToggleButton.setAttribute("aria-label", label);
  themeToggleButton.title = label;
}

function fillForm(settings: Settings) {
  applyThemePreference(settings.themePreference);
  fields.targetLanguage.value = settings.targetLanguage;
  fields.provider.value = settings.provider;
  fields.sourceLanguage.value = settings.sourceLanguage;
  fields.endpoint.value = settings.endpoint;
  fields.yandexApiKey.value = settings.yandexApiKey;
  fields.libreTranslateApiKey.value = settings.libreTranslateApiKey;
  fields.yandexFolderId.value = settings.yandexFolderId;
  fields.autoDetectSource.checked = settings.autoDetectSource;
  fields.showSelectionToolbar.checked = settings.showSelectionToolbar;
  fields.keepPanelOpen.checked = settings.keepPanelOpen;
  fields.autoFallbackProvider.checked = settings.autoFallbackProvider;
  fields.panelOpacity.value = String(settings.panelOpacity);
  fields.maxCharacters.value = String(settings.maxCharacters);
  applyPanelOpacity(settings.panelOpacity);
  applyDisclosure();
}

/** The preview shows the real thing: only the surface goes translucent. */
function applyPanelOpacity(value: unknown) {
  const opacity = clampPanelOpacity(value);
  opacityOutput.textContent = `${opacity}%`;
  document.documentElement.style.setProperty(
    "--preview-alpha",
    String(opacity / 100),
  );
}

/** Only the chosen provider's credentials are worth showing. */
function applyDisclosure() {
  for (const group of providerGroups) {
    group.hidden = group.dataset.provider !== fields.provider.value;
  }

  for (const field of manualSourceFields) {
    field.hidden = fields.autoDetectSource.checked;
  }
}

function setUnsaved(unsaved: boolean) {
  saveButton.disabled = !unsaved;

  if (unsaved) {
    setStatus("Есть несохраненные изменения", "pending");
    return;
  }

  if (status.dataset.state === "pending") {
    setStatus("");
  }
}

function readForm(): SettingsInput {
  return {
    targetLanguage: fields.targetLanguage.value,
    provider: fields.provider.value,
    sourceLanguage: fields.sourceLanguage.value,
    endpoint: fields.endpoint.value,
    yandexApiKey: fields.yandexApiKey.value,
    libreTranslateApiKey: fields.libreTranslateApiKey.value,
    yandexFolderId: fields.yandexFolderId.value,
    themePreference: fields.themePreference.value,
    autoDetectSource: fields.autoDetectSource.checked,
    showSelectionToolbar: fields.showSelectionToolbar.checked,
    keepPanelOpen: fields.keepPanelOpen.checked,
    autoFallbackProvider: fields.autoFallbackProvider.checked,
    panelOpacity: fields.panelOpacity.value,
    maxCharacters: fields.maxCharacters.value,
  };
}

function getEndpointOriginPattern(endpoint: unknown): string {
  if (typeof endpoint !== "string") {
    return "";
  }

  try {
    const url = new URL(endpoint);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return "";
    }

    return `${url.origin}/*`;
  } catch {
    return "";
  }
}

async function requestLibreTranslatePermission(settings: SettingsInput): Promise<boolean> {
  if (
    settings.provider !== "libretranslate" ||
    typeof settings.endpoint !== "string" ||
    !settings.endpoint
  ) {
    return true;
  }

  const originPattern = getEndpointOriginPattern(settings.endpoint);
  if (!originPattern || !chrome.permissions?.request) {
    return true;
  }

  return await chrome.permissions.request({
    origins: [originPattern],
  });
}

let statusTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(message: string, state = "") {
  clearTimeout(statusTimer);
  status.textContent = message;
  status.dataset.state = state;

  if (!message || state === "pending") {
    return;
  }

  statusTimer = setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
      status.dataset.state = "";
    }
  }, 1800);
}

themeToggleButton.addEventListener("click", async () => {
  const resolvedTheme = getResolvedTheme(fields.themePreference.value);
  const nextPreference = resolvedTheme === "dark" ? "light" : "dark";
  applyThemePreference(nextPreference);

  const storedSettings = await loadSettings();
  await saveSettings({ ...storedSettings, themePreference: nextPreference });
  setStatus("Тема сохранена");
});

systemThemeQuery?.addEventListener("change", () => {
  if (normalizeThemePreference(fields.themePreference.value) === "system") {
    applyThemePreference("system");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextSettings = readForm();
  const permissionGranted = await requestLibreTranslatePermission(nextSettings);

  if (!permissionGranted) {
    setStatus("Нет доступа к endpoint");
    return;
  }

  const saved = await saveSettings(nextSettings);
  fillForm(saved);
  setStatus("Сохранено");
  saveButton.disabled = true;
});

resetButton.addEventListener("click", async () => {
  const saved = await saveSettings(DEFAULT_SETTINGS);
  fillForm(saved);
  setStatus("Сброшено");
  saveButton.disabled = true;
});

form.addEventListener("input", (event) => {
  const target = event.target;

  if (target === fields.panelOpacity) {
    applyPanelOpacity(fields.panelOpacity.value);
  }

  if (target === fields.provider || target === fields.autoDetectSource) {
    applyDisclosure();
  }

  setUnsaved(true);
});

fillForm(await loadSettings());
setUnsaved(false);
