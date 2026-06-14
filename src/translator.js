import { mergeSettings } from "./settings.js";

const YANDEX_TRANSLATE_URL =
  "https://translate.api.cloud.yandex.net/translate/v2/translate";
const YANDEX_WEB_SESSION_URL =
  "https://translate.yandex.ru/props/api/v1.0/sessions?srv=tr-text";
const YANDEX_WEB_TRANSLATE_URL =
  "https://translate.yandex.net/api/v1/tr.json/translateSentence";

export function normalizeLibreTranslateUrl(endpoint) {
  const trimmed = String(endpoint || "").trim();

  if (!trimmed) {
    return "";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  if (withoutTrailingSlash.endsWith("/translate")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/translate`;
}

export function limitTextForTranslation(text, limit) {
  const sourceText = String(text || "");
  const normalizedLimit = Math.max(1, Number(limit) || 1);

  return {
    text: sourceText.slice(0, normalizedLimit),
    wasTrimmed: sourceText.length > normalizedLimit,
    originalLength: sourceText.length,
    limit: normalizedLimit,
  };
}

function buildGoogleTranslateUrl(text, settings) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: settings.autoDetectSource ? "auto" : settings.sourceLanguage,
    tl: settings.targetLanguage,
    dt: "t",
    q: text,
  });

  return `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
}

function getGoogleTranslatedText(payload) {
  if (!Array.isArray(payload?.[0])) {
    return "";
  }

  return payload[0]
    .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
    .join("");
}

function getTranslatedText(payload) {
  if (typeof payload?.translatedText === "string") {
    return payload.translatedText;
  }

  if (typeof payload?.translation === "string") {
    return payload.translation;
  }

  if (typeof payload?.data?.translatedText === "string") {
    return payload.data.translatedText;
  }

  return "";
}

function getYandexTranslatedText(payload) {
  const firstTranslation = payload?.translations?.[0];
  return typeof firstTranslation?.text === "string" ? firstTranslation.text : "";
}

function getYandexWebTranslatedText(payload) {
  if (!Array.isArray(payload?.text)) {
    return "";
  }

  return payload.text.filter((part) => typeof part === "string").join("\n");
}

async function translateWithGoogle({ limited, settings, fetchImpl }) {
  const response = await fetchImpl(buildGoogleTranslateUrl(limited.text, settings), {
    method: "GET",
  });

  if (!response.ok) {
    return {
      ok: false,
      code: "provider_error",
      message: `Переводчик вернул ошибку ${response.status}.`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const payload = await response.json();
  const translatedText = getGoogleTranslatedText(payload);

  if (!translatedText.trim()) {
    return {
      ok: false,
      code: "empty_provider_response",
      message: "Переводчик не вернул текст перевода.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  return {
    ok: true,
    translatedText,
    originalText: limited.text,
    targetLanguage: settings.targetLanguage,
    wasTrimmed: limited.wasTrimmed,
  };
}

async function translateWithYandex({ limited, settings, fetchImpl }) {
  const body = {
    targetLanguageCode: settings.targetLanguage,
    format: "PLAIN_TEXT",
    texts: [limited.text],
  };

  if (!settings.autoDetectSource && settings.sourceLanguage !== "auto") {
    body.sourceLanguageCode = settings.sourceLanguage;
  }

  if (settings.yandexFolderId) {
    body.folderId = settings.yandexFolderId;
  }

  const response = await fetchImpl(YANDEX_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      code: "provider_error",
      message: `Yandex Translate вернул ошибку ${response.status}.`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const payload = await response.json();
  const translatedText = getYandexTranslatedText(payload);

  if (!translatedText.trim()) {
    return {
      ok: false,
      code: "empty_provider_response",
      message: "Yandex Translate не вернул текст перевода.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  return {
    ok: true,
    translatedText,
    originalText: limited.text,
    targetLanguage: settings.targetLanguage,
    wasTrimmed: limited.wasTrimmed,
  };
}

async function translateWithYandexWeb({ limited, settings, fetchImpl }) {
  const sessionResponse = await fetchImpl(YANDEX_WEB_SESSION_URL, {
    method: "POST",
    referrer: "https://translate.yandex.ru/",
    referrerPolicy: "origin",
    headers: {
      Referer: "https://translate.yandex.ru/",
      Origin: "https://translate.yandex.ru",
    },
  });

  if (!sessionResponse.ok) {
    return {
      ok: false,
      code: "yandex_web_session_error",
      message: `Yandex web не выдал сессию: ${sessionResponse.status}.`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const sessionPayload = await sessionResponse.json();
  const sessionId = sessionPayload?.session?.id;

  if (!sessionId) {
    return {
      ok: false,
      code: "yandex_web_missing_session",
      message: "Yandex web не вернул id сессии.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const body = new URLSearchParams({
    id: `${sessionId}-0-0`,
    srv: "tr-text",
    source_lang: settings.autoDetectSource ? "auto" : settings.sourceLanguage,
    target_lang: settings.targetLanguage,
    reason: "auto",
    format: "text",
    text: limited.text,
    options: "0",
  });

  const response = await fetchImpl(YANDEX_WEB_TRANSLATE_URL, {
    method: "POST",
    referrer: "https://translate.yandex.ru/",
    referrerPolicy: "origin",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://translate.yandex.ru/",
      Origin: "https://translate.yandex.ru",
    },
    body,
  });

  if (!response.ok) {
    return {
      ok: false,
      code: "provider_error",
      message: `Yandex web вернул ошибку ${response.status}.`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const payload = await response.json();
  const translatedText = getYandexWebTranslatedText(payload);

  if (!translatedText.trim()) {
    return {
      ok: false,
      code: "empty_provider_response",
      message: "Yandex web не вернул текст перевода.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  return {
    ok: true,
    translatedText,
    originalText: limited.text,
    targetLanguage: settings.targetLanguage,
    wasTrimmed: limited.wasTrimmed,
  };
}

async function translateWithLibreTranslate({ limited, settings, endpoint, fetchImpl }) {
  const body = {
    q: limited.text,
    source: settings.autoDetectSource ? "auto" : settings.sourceLanguage,
    target: settings.targetLanguage,
    format: "text",
  };

  if (settings.apiKey) {
    body.api_key = settings.apiKey;
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      code: "provider_error",
      message: `Переводчик вернул ошибку ${response.status}.`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  const payload = await response.json();
  const translatedText = getTranslatedText(payload);

  if (!translatedText.trim()) {
    return {
      ok: false,
      code: "empty_provider_response",
      message: "Переводчик не вернул текст перевода.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  return {
    ok: true,
    translatedText,
    originalText: limited.text,
    targetLanguage: settings.targetLanguage,
    wasTrimmed: limited.wasTrimmed,
  };
}

export async function translateText({
  text,
  settings: rawSettings = {},
  fetchImpl = globalThis.fetch,
}) {
  const settings = mergeSettings(rawSettings);
  const endpoint = normalizeLibreTranslateUrl(settings.endpoint);
  const limited = limitTextForTranslation(text, settings.maxCharacters);

  if (!limited.text.trim()) {
    return {
      ok: false,
      code: "empty_text",
      message: "Нет текста для перевода.",
      originalText: "",
    };
  }

  if (settings.provider === "libretranslate" && !endpoint) {
    return {
      ok: false,
      code: "missing_endpoint",
      message:
        "Укажи endpoint переводчика в настройках. Подойдёт LibreTranslate-compatible API.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  if (settings.provider === "yandex" && !settings.apiKey) {
    return {
      ok: false,
      code: "missing_yandex_api_key",
      message: "Укажи API-ключ Yandex Cloud Translate в настройках.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      code: "fetch_unavailable",
      message: "В этом окружении недоступен сетевой запрос для перевода.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }

  try {
    if (settings.provider === "google") {
      return await translateWithGoogle({ limited, settings, fetchImpl });
    }

    if (settings.provider === "yandex") {
      return await translateWithYandex({ limited, settings, fetchImpl });
    }

    if (settings.provider === "yandex-web") {
      return await translateWithYandexWeb({ limited, settings, fetchImpl });
    }

    return await translateWithLibreTranslate({
      limited,
      settings,
      endpoint,
      fetchImpl,
    });
  } catch (error) {
    return {
      ok: false,
      code: "network_error",
      message: `Не удалось получить перевод: ${error.message}`,
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }
}
