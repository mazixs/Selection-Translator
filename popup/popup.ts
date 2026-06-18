import { loadSettings } from "../src/settings.js";

const LANGUAGE_NAMES: Partial<Record<string, string>> = {
  ru: "Русский",
  en: "Английский",
  de: "Немецкий",
  fr: "Французский",
  es: "Испанский",
  it: "Итальянский",
  tr: "Турецкий",
  uk: "Украинский",
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

const statusLine = getRequiredElement("#status-line", HTMLParagraphElement);
const targetLanguage = getRequiredElement("#target-language", HTMLElement);
const providerStatus = getRequiredElement("#provider-status", HTMLElement);
const openOptions = getRequiredElement("#open-options", HTMLButtonElement);

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
