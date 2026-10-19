/**
 * The reference catalog: its keys are the full set every locale must provide,
 * and its texts are the fallback. Placeholders are written as `{name}`.
 */
export const en = {
  "locale.autonym": "English",
  "app.name": "Selection Translator",
  "manifest.description": "A floating menu that translates and copies selected text.",

  "language.ru": "Russian",
  "language.en": "English",
  "language.de": "German",
  "language.fr": "French",
  "language.es": "Spanish",
  "language.it": "Italian",
  "language.tr": "Turkish",
  "language.uk": "Ukrainian",

  "common.close": "Close",
  "common.settings": "Settings",

  "toolbar.translate": "Translate",
  "toolbar.copySelection": "Copy selection",
  "toolbar.translateAndCopy": "Translate and copy",
  "toolbar.copied": "Copied",
  "toolbar.copyFailed": "Failed",

  "panel.label": "Translation",
  "panel.targetLanguage": "Target language",
  "panel.copyTranslation": "Copy translation",
  "panel.loading": "Translating...",
  "panel.trimmed": "The text was trimmed to the limit set in the settings.",
  "panel.noConnection": "Could not reach the extension.",
  "panel.noConnectionHint": "Try reloading the page and repeating.",
  "panel.unfocused":
    "The tab was not in focus, so the translation was not copied. Press ⧉ in the panel.",
  "panel.copied": "Translation copied",
  "panel.copyBlocked":
    "The page blocked clipboard access. Select the translation with the mouse and press Ctrl+C.",

  "error.empty_text": "There is no text to translate.",
  "error.missing_endpoint":
    "Set the translator endpoint in the settings. Any LibreTranslate-compatible API will do.",
  "error.missing_yandex_api_key":
    "Set the Yandex Cloud Translate API key in the settings.",
  "error.fetch_unavailable": "Network requests for translation are unavailable here.",
  "error.network_error":
    "Could not get a translation. Check the connection or the provider settings.",
  "error.provider_error": "{provider} returned error {status}.",
  "error.empty_provider_response": "{provider} returned no translation.",
  "error.rate_limited":
    "Google has temporarily limited access from this address. Try again in {time}. If a VPN is on, another server or Yandex in the settings helps.",
  "error.unknown": "Could not translate the text.",

  "provider.google": "Google Translate",
  "provider.yandex": "Yandex Translate",
  "provider.libretranslate": "LibreTranslate",
  "provider.unknown": "The translator",

  "time.seconds": "{count} sec",
  "time.minutes": "{count} min",

  "note.fallback": "Google could not translate the text, so {provider} did.",
  "note.fallbackRateLimited": "Google limited access, so {provider} translated the text.",

  "menu.parent": "Translation",
  "menu.translate": "Translate",
  "menu.copy": "Copy",

  "popup.loading": "Loading...",
  "popup.language": "Language",
  "popup.provider": "Provider",
  "popup.providerGoogle": "Google web",
  "popup.providerYandex": "Yandex Cloud",
  "popup.providerYandexNoKey": "Yandex: key required",
  "popup.providerLibreTranslate": "LibreTranslate",
  "popup.providerNotConfigured": "Not configured",
  "popup.panelOn": "Panel is on",
  "popup.panelOff": "Panel is off",

  "options.pageTitle": "Selection Translator - settings",
  "options.tagline": "A translation panel for selected text.",
  "options.themeToDark": "Switch to the dark theme",
  "options.themeToLight": "Switch to the light theme",

  "options.translation.title": "Translation",
  "options.translation.description":
    "Which language to translate the selected text into, and from which.",
  "options.targetLanguage": "Target language",
  "options.sourceLanguage": "Source language",
  "options.sourceLanguageHint": "Language code: en, de, tr.",
  "options.autoDetectSource": "Detect the language automatically",
  "options.autoDetectSourceHint":
    "Turn it off if a site mixes two languages in one paragraph.",

  "options.provider.title": "Provider",
  "options.provider.description":
    "Google works without a key, the others need their own credentials.",
  "options.providerService": "Translation service",
  "options.providerGoogle": "Google web, no key",
  "options.providerYandex": "Yandex Cloud Translate",
  "options.providerLibreTranslate": "LibreTranslate endpoint",
  "options.googleHint":
    "No key is needed. Access is limited per IP address, so on error 429 the second provider from the Reliability section helps out.",
  "options.yandexApiKey": "Yandex Cloud API key",
  "options.yandexFolderId": "Folder id",
  "options.yandexFolderIdHint": "Needed if the key belongs to a service account.",
  "options.endpoint": "Endpoint",
  "options.endpointHint": "Chrome will ask for access to this address when you save.",
  "options.libreTranslateApiKey": "API key",
  "options.libreTranslateApiKeyPlaceholder": "If the endpoint requires one",

  "options.panel.title": "Panel on the page",
  "options.panel.description": "How the pop-up window behaves over a site.",
  "options.panelOpacity": "Panel opacity",
  "options.panelOpacityHint":
    "Only the background shows through: the translation stays crisp, and the page behind the panel is blurred.",
  "options.previewLanguage": "English",
  "options.previewText": "Get more than 400 AI prompts and websites",
  "options.showSelectionToolbar": "Show buttons when text is selected",
  "options.showSelectionToolbarHint":
    "Without them, translation is available from the context menu.",
  "options.keepPanelOpen":
    "Keep the translation window open when the selection is cleared",

  "options.reliability.title": "Reliability",
  "options.reliability.description":
    "What to do when a provider refuses or the text is too long.",
  "options.autoFallbackProvider":
    "Translate with a second provider when Google limits access",
  "options.autoFallbackProviderHint":
    "Works if a Yandex Cloud key or your own endpoint is set.",
  "options.maxCharacters": "Maximum characters per translation",
  "options.maxCharactersHint":
    "A longer selection is trimmed, and the panel warns about it.",

  "options.interface.title": "Interface",
  "options.interface.description": "The language of the panel, the menus and this page.",
  "options.uiLanguage": "Interface language",
  "options.uiLanguageAuto": "Automatic",
  "options.uiLanguageHint":
    "Automatic follows the browser language when it is English, Russian or Spanish, and uses English otherwise.",

  "options.reset": "Reset",
  "options.save": "Save",
  "options.statusUnsaved": "There are unsaved changes",
  "options.statusThemeSaved": "Theme saved",
  "options.statusNoEndpointAccess": "No access to the endpoint",
  "options.statusSaved": "Saved",
  "options.statusReset": "Reset to defaults",
};

export type MessageKey = keyof typeof en;

export type Messages = { readonly [Key in MessageKey]: string };
