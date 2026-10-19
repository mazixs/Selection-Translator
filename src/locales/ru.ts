import type { Messages } from "./en.js";

export const ru: Messages = {
  "locale.autonym": "Русский",
  "app.name": "Selection Translator",
  "manifest.description": "Плавающее меню перевода и копирования для выделенного текста.",

  "language.ru": "Русский",
  "language.en": "Английский",
  "language.de": "Немецкий",
  "language.fr": "Французский",
  "language.es": "Испанский",
  "language.it": "Итальянский",
  "language.tr": "Турецкий",
  "language.uk": "Украинский",

  "common.close": "Закрыть",
  "common.settings": "Настройки",

  "toolbar.translate": "Перевести",
  "toolbar.copySelection": "Скопировать выделенное",
  "toolbar.translateAndCopy": "Перевести и скопировать",
  "toolbar.copied": "Скопировано",
  "toolbar.copyFailed": "Не вышло",

  "panel.label": "Перевод",
  "panel.targetLanguage": "Язык перевода",
  "panel.copyTranslation": "Скопировать перевод",
  "panel.loading": "Перевожу...",
  "panel.trimmed": "Текст был обрезан по лимиту из настроек.",
  "panel.noConnection": "Не удалось связаться с расширением.",
  "panel.noConnectionHint": "Попробуй обновить страницу и повторить.",
  "panel.unfocused": "Вкладка была не в фокусе, перевод не скопирован. Нажми ⧉ в панели.",
  "panel.copied": "Перевод скопирован",
  "panel.copyBlocked":
    "Страница не дала доступ к буферу обмена. Выдели перевод мышью и нажми Ctrl+C.",

  "error.empty_text": "Нет текста для перевода.",
  "error.missing_endpoint":
    "Укажи endpoint переводчика в настройках. Подойдёт LibreTranslate-compatible API.",
  "error.missing_yandex_api_key": "Укажи API-ключ Yandex Cloud Translate в настройках.",
  "error.fetch_unavailable": "В этом окружении недоступен сетевой запрос для перевода.",
  "error.network_error":
    "Не удалось получить перевод. Проверь подключение или настройки провайдера.",
  "error.provider_error": "{provider} вернул ошибку {status}.",
  "error.empty_provider_response": "{provider} не вернул текст перевода.",
  "error.rate_limited":
    "Google временно ограничил доступ с этого адреса. Попробуй через {time}. Если включен VPN, помогает другой узел или Yandex в настройках.",
  "error.unknown": "Не удалось перевести текст.",

  "provider.google": "Google Переводчик",
  "provider.yandex": "Yandex Translate",
  "provider.libretranslate": "LibreTranslate",
  "provider.unknown": "Переводчик",

  "time.seconds": "{count} сек.",
  "time.minutes": "{count} мин.",

  "note.fallback": "Google не смог перевести текст, поэтому перевел {provider}.",
  "note.fallbackRateLimited": "Google ограничил доступ, поэтому перевел {provider}.",

  "menu.parent": "Перевод",
  "menu.translate": "Перевести",
  "menu.copy": "Скопировать",

  "popup.loading": "Загрузка...",
  "popup.language": "Язык",
  "popup.provider": "Провайдер",
  "popup.providerGoogle": "Google web",
  "popup.providerYandex": "Yandex Cloud",
  "popup.providerYandexNoKey": "Yandex: нужен ключ",
  "popup.providerLibreTranslate": "LibreTranslate",
  "popup.providerNotConfigured": "Не настроен",
  "popup.panelOn": "Панель включена",
  "popup.panelOff": "Панель выключена",

  "options.pageTitle": "Selection Translator - настройки",
  "options.tagline": "Панель перевода для выделенного текста.",
  "options.themeToDark": "Включить темную тему",
  "options.themeToLight": "Включить светлую тему",

  "options.translation.title": "Перевод",
  "options.translation.description": "Куда и с какого языка переводить выделенный текст.",
  "options.targetLanguage": "Язык перевода",
  "options.sourceLanguage": "Исходный язык",
  "options.sourceLanguageHint": "Код языка: en, de, tr.",
  "options.autoDetectSource": "Определять язык автоматически",
  "options.autoDetectSourceHint":
    "Выключи, если сайт смешивает два языка в одном абзаце.",

  "options.provider.title": "Провайдер",
  "options.provider.description":
    "Google работает без ключа, остальным нужны свои реквизиты.",
  "options.providerService": "Сервис перевода",
  "options.providerGoogle": "Google web, без ключа",
  "options.providerYandex": "Yandex Cloud Translate",
  "options.providerLibreTranslate": "LibreTranslate endpoint",
  "options.googleHint":
    "Ключ не нужен. Доступ ограничивается по IP-адресу, поэтому при ошибке 429 выручает второй провайдер из раздела «Надежность».",
  "options.yandexApiKey": "API-ключ Yandex Cloud",
  "options.yandexFolderId": "Folder id",
  "options.yandexFolderIdHint": "Нужен, если ключ выдан сервисному аккаунту.",
  "options.endpoint": "Endpoint",
  "options.endpointHint": "Chrome спросит доступ к этому адресу при сохранении.",
  "options.libreTranslateApiKey": "API-ключ",
  "options.libreTranslateApiKeyPlaceholder": "Если endpoint его требует",

  "options.panel.title": "Панель на странице",
  "options.panel.description": "Как всплывающее окно ведет себя поверх сайта.",
  "options.panelOpacity": "Прозрачность панели",
  "options.panelOpacityHint":
    "Просвечивает только фон: текст перевода остается контрастным, а страница за панелью размывается.",
  "options.previewLanguage": "Русский",
  "options.previewText": "Получите более 400 подсказок и веб-сайтов AI",
  "options.showSelectionToolbar": "Показывать кнопки при выделении текста",
  "options.showSelectionToolbarHint":
    "Без них перевод вызывается через контекстное меню.",
  "options.keepPanelOpen": "Не закрывать окно перевода при снятии выделения",

  "options.reliability.title": "Надежность",
  "options.reliability.description":
    "Что делать, когда провайдер отказал или текст слишком длинный.",
  "options.autoFallbackProvider":
    "Переводить через второго провайдера, когда Google ограничил доступ",
  "options.autoFallbackProviderHint":
    "Сработает, если указан ключ Yandex Cloud или свой endpoint.",
  "options.maxCharacters": "Максимум символов за один перевод",
  "options.maxCharactersHint":
    "Длинное выделение обрезается, и панель об этом предупреждает.",

  "options.interface.title": "Интерфейс",
  "options.interface.description": "Язык панели, меню и этой страницы.",
  "options.uiLanguage": "Язык интерфейса",
  "options.uiLanguageAuto": "Автоматически",
  "options.uiLanguageHint":
    "Автоматически берётся язык браузера, если это английский, русский или испанский, иначе английский.",

  "options.reset": "Сбросить",
  "options.save": "Сохранить",
  "options.statusUnsaved": "Есть несохраненные изменения",
  "options.statusThemeSaved": "Тема сохранена",
  "options.statusNoEndpointAccess": "Нет доступа к endpoint",
  "options.statusSaved": "Сохранено",
  "options.statusReset": "Сброшено",
};
