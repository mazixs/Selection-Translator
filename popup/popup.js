import { loadSettings } from "../src/settings.js";

const LANGUAGE_NAMES = {
  ru: "Русский",
  en: "Английский",
  de: "Немецкий",
  fr: "Французский",
  es: "Испанский",
  it: "Итальянский",
  tr: "Турецкий",
  uk: "Украинский",
};

const statusLine = document.querySelector("#status-line");
const targetLanguage = document.querySelector("#target-language");
const providerStatus = document.querySelector("#provider-status");
const openOptions = document.querySelector("#open-options");

const settings = await loadSettings();

targetLanguage.textContent =
  LANGUAGE_NAMES[settings.targetLanguage] || settings.targetLanguage;
providerStatus.textContent =
  settings.provider === "google"
    ? "Google web"
    : settings.provider === "yandex-web"
      ? "Yandex web"
    : settings.provider === "yandex"
      ? settings.apiKey
        ? "Yandex Cloud"
        : "Yandex: нужен ключ"
      : settings.endpoint
        ? "LibreTranslate"
        : "Не настроен";
statusLine.textContent = settings.showSelectionToolbar
  ? "Панель включена"
  : "Панель выключена";

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
