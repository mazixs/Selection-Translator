import { getRequiredElement } from "../src/dom.js";
import { getUiLocale, type Translate } from "../src/i18n.js";
import { getInitialUiLocale, localizePage, rememberUiLocale } from "../src/i18n-dom.js";
import { getLanguageName } from "../src/languages.js";
import { loadSettings, type Settings } from "../src/settings.js";

const statusLine = getRequiredElement("#status-line", HTMLParagraphElement);
const targetLanguage = getRequiredElement("#target-language", HTMLElement);
const providerStatus = getRequiredElement("#provider-status", HTMLElement);
const openOptions = getRequiredElement("#open-options", HTMLButtonElement);

function getProviderStatus(settings: Settings, t: Translate): string {
  if (settings.provider === "google") {
    return t("popup.providerGoogle");
  }

  if (settings.provider === "yandex") {
    return t(
      settings.yandexApiKey ? "popup.providerYandex" : "popup.providerYandexNoKey",
    );
  }

  return t(
    settings.endpoint ? "popup.providerLibreTranslate" : "popup.providerNotConfigured",
  );
}

// Texts first, without waiting for storage, so the popup is never shown blank.
const initialLocale = getInitialUiLocale();
let t = localizePage(initialLocale);

const settings = await loadSettings();
const locale = getUiLocale(settings.uiLanguage);

// The first render guessed the locale; correct it if the settings disagree.
if (locale !== initialLocale) {
  t = localizePage(locale);
}

rememberUiLocale(locale);

targetLanguage.textContent = getLanguageName(settings.targetLanguage, t);
providerStatus.textContent = getProviderStatus(settings, t);
statusLine.textContent = t(
  settings.showSelectionToolbar ? "popup.panelOn" : "popup.panelOff",
);

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
