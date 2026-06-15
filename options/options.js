import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../src/settings.js";

const form = document.querySelector("#settings-form");
const resetButton = document.querySelector("#reset-button");
const status = document.querySelector("#status");
const themeToggleButton = document.querySelector("#theme-toggle");
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

function normalizeThemePreference(themePreference) {
  return themePreference === "light" || themePreference === "dark"
    ? themePreference
    : "system";
}

function getSystemTheme() {
  return systemThemeQuery?.matches ? "dark" : "light";
}

function getResolvedTheme(themePreference) {
  const preference = normalizeThemePreference(themePreference);
  return preference === "system" ? getSystemTheme() : preference;
}

function getThemeToggleLabel(resolvedTheme) {
  return resolvedTheme === "dark"
    ? "Включить светлую тему"
    : "Включить темную тему";
}

function applyThemePreference(themePreference) {
  const preference = normalizeThemePreference(themePreference);
  const resolvedTheme = getResolvedTheme(preference);

  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.themeResolved = resolvedTheme;
  form.themePreference.value = preference;

  const label = getThemeToggleLabel(resolvedTheme);
  themeToggleButton.setAttribute("aria-label", label);
  themeToggleButton.title = label;
}

function fillForm(settings) {
  applyThemePreference(settings.themePreference);
  form.targetLanguage.value = settings.targetLanguage;
  form.provider.value = settings.provider;
  form.sourceLanguage.value = settings.sourceLanguage;
  form.endpoint.value = settings.endpoint;
  form.apiKey.value = settings.apiKey;
  form.yandexFolderId.value = settings.yandexFolderId;
  form.autoDetectSource.checked = settings.autoDetectSource;
  form.showSelectionToolbar.checked = settings.showSelectionToolbar;
  form.keepPanelOpen.checked = settings.keepPanelOpen;
  form.maxCharacters.value = String(settings.maxCharacters);
}

function readForm() {
  return {
    targetLanguage: form.targetLanguage.value,
    provider: form.provider.value,
    sourceLanguage: form.sourceLanguage.value,
    endpoint: form.endpoint.value,
    apiKey: form.apiKey.value,
    yandexFolderId: form.yandexFolderId.value,
    themePreference: form.themePreference.value,
    autoDetectSource: form.autoDetectSource.checked,
    showSelectionToolbar: form.showSelectionToolbar.checked,
    keepPanelOpen: form.keepPanelOpen.checked,
    maxCharacters: form.maxCharacters.value,
  };
}

function getEndpointOriginPattern(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return `${url.origin}/*`;
  } catch {
    return "";
  }
}

async function requestLibreTranslatePermission(settings) {
  if (settings.provider !== "libretranslate" || !settings.endpoint) {
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

function setStatus(message) {
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) {
      status.textContent = "";
    }
  }, 1800);
}

themeToggleButton.addEventListener("click", async () => {
  const resolvedTheme = getResolvedTheme(form.themePreference.value);
  const nextPreference = resolvedTheme === "dark" ? "light" : "dark";
  applyThemePreference(nextPreference);

  const storedSettings = await loadSettings();
  await saveSettings({ ...storedSettings, themePreference: nextPreference });
  setStatus("Тема сохранена");
});

systemThemeQuery?.addEventListener("change", () => {
  if (normalizeThemePreference(form.themePreference.value) === "system") {
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
});

resetButton.addEventListener("click", async () => {
  const saved = await saveSettings(DEFAULT_SETTINGS);
  fillForm(saved);
  setStatus("Сброшено");
});

fillForm(await loadSettings());
