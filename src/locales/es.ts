import type { Messages } from "./en.js";

export const es: Messages = {
  "locale.autonym": "Español",
  "app.name": "Selection Translator",
  "manifest.description": "Un menú flotante que traduce y copia el texto seleccionado.",

  "language.ru": "Ruso",
  "language.en": "Inglés",
  "language.de": "Alemán",
  "language.fr": "Francés",
  "language.es": "Español",
  "language.it": "Italiano",
  "language.tr": "Turco",
  "language.uk": "Ucraniano",

  "common.close": "Cerrar",
  "common.settings": "Ajustes",

  "toolbar.translate": "Traducir",
  "toolbar.copySelection": "Copiar la selección",
  "toolbar.translateAndCopy": "Traducir y copiar",
  "toolbar.copied": "Copiado",
  "toolbar.copyFailed": "Error",

  "panel.label": "Traducción",
  "panel.targetLanguage": "Idioma de destino",
  "panel.copyTranslation": "Copiar la traducción",
  "panel.loading": "Traduciendo...",
  "panel.trimmed": "El texto se recortó al límite fijado en los ajustes.",
  "panel.noConnection": "No se pudo contactar con la extensión.",
  "panel.noConnectionHint": "Prueba a recargar la página y repetir.",
  "panel.unfocused":
    "La pestaña no tenía el foco, así que la traducción no se copió. Pulsa ⧉ en el panel.",
  "panel.copied": "Traducción copiada",
  "panel.copyBlocked":
    "La página bloqueó el acceso al portapapeles. Selecciona la traducción con el ratón y pulsa Ctrl+C.",

  "error.empty_text": "No hay texto para traducir.",
  "error.missing_endpoint":
    "Indica el endpoint del traductor en los ajustes. Sirve cualquier API compatible con LibreTranslate.",
  "error.missing_yandex_api_key":
    "Indica la clave API de Yandex Cloud Translate en los ajustes.",
  "error.fetch_unavailable":
    "Aquí no están disponibles las solicitudes de red para traducir.",
  "error.network_error":
    "No se pudo obtener la traducción. Revisa la conexión o los ajustes del proveedor.",
  "error.provider_error": "{provider} devolvió el error {status}.",
  "error.empty_provider_response": "{provider} no devolvió ninguna traducción.",
  "error.rate_limited":
    "Google ha limitado temporalmente el acceso desde esta dirección. Vuelve a intentarlo en {time}. Si usas una VPN, ayuda cambiar de servidor o elegir Yandex en los ajustes.",
  "error.unknown": "No se pudo traducir el texto.",

  "provider.google": "Google Translate",
  "provider.yandex": "Yandex Translate",
  "provider.libretranslate": "LibreTranslate",
  "provider.unknown": "El traductor",

  "time.seconds": "{count} s",
  "time.minutes": "{count} min",

  "note.fallback": "Google no pudo traducir el texto, así que lo tradujo {provider}.",
  "note.fallbackRateLimited": "Google limitó el acceso, así que tradujo {provider}.",

  "menu.parent": "Traducción",
  "menu.translate": "Traducir",
  "menu.copy": "Copiar",

  "popup.loading": "Cargando...",
  "popup.language": "Idioma",
  "popup.provider": "Proveedor",
  "popup.providerGoogle": "Google web",
  "popup.providerYandex": "Yandex Cloud",
  "popup.providerYandexNoKey": "Yandex: falta la clave",
  "popup.providerLibreTranslate": "LibreTranslate",
  "popup.providerNotConfigured": "Sin configurar",
  "popup.panelOn": "Panel activado",
  "popup.panelOff": "Panel desactivado",

  "options.pageTitle": "Selection Translator - ajustes",
  "options.tagline": "Un panel de traducción para el texto seleccionado.",
  "options.themeToDark": "Activar el tema oscuro",
  "options.themeToLight": "Activar el tema claro",

  "options.translation.title": "Traducción",
  "options.translation.description":
    "A qué idioma traducir el texto seleccionado y desde cuál.",
  "options.targetLanguage": "Idioma de destino",
  "options.sourceLanguage": "Idioma de origen",
  "options.sourceLanguageHint": "Código de idioma: en, de, tr.",
  "options.autoDetectSource": "Detectar el idioma automáticamente",
  "options.autoDetectSourceHint":
    "Desactívalo si un sitio mezcla dos idiomas en el mismo párrafo.",

  "options.provider.title": "Proveedor",
  "options.provider.description":
    "Google funciona sin clave, los demás necesitan sus propias credenciales.",
  "options.providerService": "Servicio de traducción",
  "options.providerGoogle": "Google web, sin clave",
  "options.providerYandex": "Yandex Cloud Translate",
  "options.providerLibreTranslate": "Endpoint de LibreTranslate",
  "options.googleHint":
    "No hace falta clave. El acceso se limita por dirección IP, así que ante el error 429 ayuda el segundo proveedor de la sección Fiabilidad.",
  "options.yandexApiKey": "Clave API de Yandex Cloud",
  "options.yandexFolderId": "Folder id",
  "options.yandexFolderIdHint":
    "Necesario si la clave pertenece a una cuenta de servicio.",
  "options.endpoint": "Endpoint",
  "options.endpointHint": "Chrome pedirá acceso a esta dirección al guardar.",
  "options.libreTranslateApiKey": "Clave API",
  "options.libreTranslateApiKeyPlaceholder": "Si el endpoint la exige",

  "options.panel.title": "Panel en la página",
  "options.panel.description": "Cómo se comporta la ventana emergente sobre un sitio.",
  "options.panelOpacity": "Opacidad del panel",
  "options.panelOpacityHint":
    "Solo se transparenta el fondo: la traducción sigue nítida y la página detrás del panel se difumina.",
  "options.previewLanguage": "Español",
  "options.previewText": "Consigue más de 400 indicaciones y sitios web de IA",
  "options.showSelectionToolbar": "Mostrar botones al seleccionar texto",
  "options.showSelectionToolbarHint":
    "Sin ellos, la traducción está disponible en el menú contextual.",
  "options.keepPanelOpen":
    "Mantener abierta la ventana de traducción al quitar la selección",

  "options.reliability.title": "Fiabilidad",
  "options.reliability.description":
    "Qué hacer cuando un proveedor falla o el texto es demasiado largo.",
  "options.autoFallbackProvider":
    "Traducir con un segundo proveedor cuando Google limite el acceso",
  "options.autoFallbackProviderHint":
    "Funciona si hay una clave de Yandex Cloud o un endpoint propio.",
  "options.maxCharacters": "Máximo de caracteres por traducción",
  "options.maxCharactersHint":
    "Una selección más larga se recorta y el panel avisa de ello.",

  "options.interface.title": "Interfaz",
  "options.interface.description": "El idioma del panel, los menús y esta página.",
  "options.uiLanguage": "Idioma de la interfaz",
  "options.uiLanguageAuto": "Automático",
  "options.uiLanguageHint":
    "Automático sigue el idioma del navegador si es inglés, ruso o español; si no, usa inglés.",

  "options.reset": "Restablecer",
  "options.save": "Guardar",
  "options.statusUnsaved": "Hay cambios sin guardar",
  "options.statusThemeSaved": "Tema guardado",
  "options.statusNoEndpointAccess": "Sin acceso al endpoint",
  "options.statusSaved": "Guardado",
  "options.statusReset": "Restablecido",
};
