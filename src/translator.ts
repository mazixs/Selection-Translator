import { mergeSettings, type Settings, type SettingsInput } from "./settings.js";

export type LimitedText = {
  text: string;
  wasTrimmed: boolean;
  originalLength: number;
  limit: number;
};

export type TranslationSuccess = {
  ok: true;
  translatedText: string;
  originalText: string;
  targetLanguage: string;
  wasTrimmed: boolean;
};

export type TranslationFailure = {
  ok: false;
  code: string;
  message: string;
  originalText: string;
  wasTrimmed?: boolean;
};

export type TranslationResult = TranslationSuccess | TranslationFailure;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

type ProviderContext = {
  limited: LimitedText;
  settings: Settings;
  fetchImpl: FetchLike;
};

type LibreTranslateContext = ProviderContext & {
  endpoint: string;
};

type YandexCloudBody = {
  targetLanguageCode: string;
  sourceLanguageCode?: string;
  format: "PLAIN_TEXT";
  texts: string[];
  folderId?: string;
};

type LibreTranslateBody = {
  q: string;
  source: string;
  target: string;
  format: "text";
  api_key?: string;
};

const YANDEX_TRANSLATE_URL =
  "https://translate.api.cloud.yandex.net/translate/v2/translate";

export function normalizeLibreTranslateUrl(endpoint: unknown): string {
  if (typeof endpoint !== "string") {
    return "";
  }

  const trimmed = endpoint.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return "";
    }

    url.hash = "";
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname.endsWith("/translate")
      ? pathname
      : `${pathname}/translate`;

    return url.toString();
  } catch {
    return "";
  }
}

export function limitTextForTranslation(text: unknown, limit: unknown): LimitedText {
  const sourceText = String(text || "");
  const normalizedLimit = Math.max(1, Number(limit) || 1);

  return {
    text: sourceText.slice(0, normalizedLimit),
    wasTrimmed: sourceText.length > normalizedLimit,
    originalLength: sourceText.length,
    limit: normalizedLimit,
  };
}

function buildGoogleTranslateUrl(text: string, settings: Settings): string {
  const params = new URLSearchParams({
    client: "gtx",
    sl: settings.autoDetectSource ? "auto" : settings.sourceLanguage,
    tl: settings.targetLanguage,
    dt: "t",
    q: text,
  });

  return `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
}

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getGoogleTranslatedText(payload: unknown): string {
  if (!Array.isArray(payload)) {
    return "";
  }

  const parts = payload[0];

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part: unknown) =>
      Array.isArray(part) && typeof part[0] === "string" ? part[0] : "",
    )
    .join("");
}

function getTranslatedText(payload: unknown): string {
  const payloadRecord = getObjectRecord(payload);
  if (!payloadRecord) {
    return "";
  }

  if (typeof payloadRecord.translatedText === "string") {
    return payloadRecord.translatedText;
  }

  if (typeof payloadRecord.translation === "string") {
    return payloadRecord.translation;
  }

  const data = getObjectRecord(payloadRecord.data);
  if (typeof data?.translatedText === "string") {
    return data.translatedText;
  }

  return "";
}

function getYandexTranslatedText(payload: unknown): string {
  const payloadRecord = getObjectRecord(payload);
  const translations = payloadRecord?.translations;
  if (!Array.isArray(translations)) {
    return "";
  }

  const firstTranslation = getObjectRecord(translations[0]);
  return typeof firstTranslation?.text === "string" ? firstTranslation.text : "";
}

async function translateWithGoogle({
  limited,
  settings,
  fetchImpl,
}: ProviderContext): Promise<TranslationResult> {
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

async function translateWithYandex({
  limited,
  settings,
  fetchImpl,
}: ProviderContext): Promise<TranslationResult> {
  const body: YandexCloudBody = {
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
      Authorization: `Api-Key ${settings.yandexApiKey}`,
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

async function translateWithLibreTranslate({
  limited,
  settings,
  endpoint,
  fetchImpl,
}: LibreTranslateContext): Promise<TranslationResult> {
  const body: LibreTranslateBody = {
    q: limited.text,
    source: settings.autoDetectSource ? "auto" : settings.sourceLanguage,
    target: settings.targetLanguage,
    format: "text",
  };

  if (settings.libreTranslateApiKey) {
    body.api_key = settings.libreTranslateApiKey;
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
}: {
  text: unknown;
  settings?: SettingsInput;
  fetchImpl?: FetchLike;
}): Promise<TranslationResult> {
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

  if (settings.provider === "yandex" && !settings.yandexApiKey) {
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

    return await translateWithLibreTranslate({
      limited,
      settings,
      endpoint,
      fetchImpl,
    });
  } catch {
    return {
      ok: false,
      code: "network_error",
      message:
        "Не удалось получить перевод. Проверь подключение или настройки провайдера.",
      originalText: limited.text,
      wasTrimmed: limited.wasTrimmed,
    };
  }
}
