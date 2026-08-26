import {
  buildCacheKey,
  createTranslationCache,
  type TranslationCache,
} from "./cache.js";
import {
  GOOGLE_ROUTES,
  getSourceLanguage,
  parseGoogleResponse,
} from "./google.js";
import {
  createCooldown,
  createPacer,
  formatCooldownHint,
  getBackoffMs,
  parseRetryAfterMs,
  RATE_LIMIT_COOLDOWN_MS,
  type Clock,
  type Cooldown,
  type Pacer,
  type Random,
  type Sleep,
} from "./pacing.js";
import {
  mergeSettings,
  type Settings,
  type SettingsInput,
  type TranslationProvider,
} from "./settings.js";

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
  provider: TranslationProvider;
  note?: string;
};

export type TranslationFailure = {
  ok: false;
  code: string;
  message: string;
  originalText: string;
  wasTrimmed?: boolean;
  retryAfterMs?: number;
};

export type TranslationResult = TranslationSuccess | TranslationFailure;

type ResponseLike = Pick<Response, "ok" | "status" | "json"> & {
  headers?: { get(name: string): string | null };
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<ResponseLike>;

export type TranslateRuntime = {
  cache: TranslationCache<{
    translatedText: string;
    provider: TranslationProvider;
    note?: string;
  }>;
  cooldown: Cooldown;
  pacer: Pacer;
  inflight: Map<string, Promise<TranslationResult>>;
  sleep: Sleep;
  random: Random;
  now: Clock;
};

type ProviderContext = {
  limited: LimitedText;
  settings: Settings;
  fetchImpl: FetchLike;
  runtime: TranslateRuntime;
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

const GOOGLE_COOLDOWN_KEY = "google";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function createTranslateRuntime(
  options: Partial<TranslateRuntime> = {},
): TranslateRuntime {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;

  return {
    now,
    random,
    sleep: options.sleep ?? defaultSleep,
    cache: options.cache ?? createTranslationCache({ now }),
    cooldown: options.cooldown ?? createCooldown({ now }),
    pacer:
      options.pacer ??
      createPacer({
        now,
        random,
        ...(options.sleep ? { sleep: options.sleep } : {}),
      }),
    inflight: options.inflight ?? new Map(),
  };
}

const defaultRuntime = createTranslateRuntime();

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

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
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

function succeed(
  translatedText: string,
  { limited, settings }: ProviderContext,
  provider: TranslationProvider,
  note?: string,
): TranslationSuccess {
  return {
    ok: true,
    translatedText,
    originalText: limited.text,
    targetLanguage: settings.targetLanguage,
    wasTrimmed: limited.wasTrimmed,
    provider,
    ...(note ? { note } : {}),
  };
}

function fail(
  limited: LimitedText,
  code: string,
  message: string,
  retryAfterMs = 0,
): TranslationFailure {
  return {
    ok: false,
    code,
    message,
    originalText: limited.text,
    wasTrimmed: limited.wasTrimmed,
    ...(retryAfterMs ? { retryAfterMs } : {}),
  };
}

function getRateLimitFailure(
  limited: LimitedText,
  remainingMs: number,
): TranslationFailure {
  return fail(
    limited,
    "rate_limited",
    `Google временно ограничил доступ с этого адреса. Попробуй через ${formatCooldownHint(
      remainingMs,
    )}. Если включен VPN, помогает другой узел или Yandex в настройках.`,
    remainingMs,
  );
}

async function translateWithGoogle(
  context: ProviderContext,
): Promise<TranslationResult> {
  const { limited, settings, fetchImpl, runtime } = context;
  const cooldownLeft = runtime.cooldown.remaining(GOOGLE_COOLDOWN_KEY);

  if (cooldownLeft > 0) {
    return getRateLimitFailure(limited, cooldownLeft);
  }

  let failure = fail(
    limited,
    "network_error",
    "Не удалось получить перевод. Проверь подключение или настройки провайдера.",
  );
  let sawRateLimit = false;
  let retryAfterMs = 0;

  for (let index = 0; index < GOOGLE_ROUTES.length; index += 1) {
    const route = GOOGLE_ROUTES[index]!;

    if (index > 0) {
      await runtime.sleep(getBackoffMs(index - 1, retryAfterMs, runtime.random));
    }

    await runtime.pacer.wait();

    const request = route.build(limited.text, settings);
    let response: ResponseLike;

    try {
      response = await fetchImpl(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
      });
    } catch {
      continue;
    }

    if (response.ok) {
      let translatedText = "";

      try {
        translatedText = parseGoogleResponse(await response.json());
      } catch {
        translatedText = "";
      }

      if (translatedText.trim()) {
        runtime.cooldown.clear(GOOGLE_COOLDOWN_KEY);
        return succeed(translatedText, context, "google");
      }

      failure = fail(
        limited,
        "empty_provider_response",
        "Переводчик не вернул текст перевода.",
      );
      continue;
    }

    if (response.status === 429) {
      sawRateLimit = true;
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      retryAfterMs = Math.max(
        retryAfterMs,
        parseRetryAfterMs(response.headers?.get("Retry-After"), runtime.now),
      );
    }

    failure = fail(
      limited,
      "provider_error",
      `Переводчик вернул ошибку ${response.status}.`,
    );
  }

  if (sawRateLimit) {
    const cooldownMs = Math.max(retryAfterMs, RATE_LIMIT_COOLDOWN_MS);
    runtime.cooldown.block(GOOGLE_COOLDOWN_KEY, cooldownMs);
    return getRateLimitFailure(limited, cooldownMs);
  }

  return failure;
}

async function translateWithYandex(
  context: ProviderContext,
): Promise<TranslationResult> {
  const { limited, settings, fetchImpl, runtime } = context;
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

  await runtime.pacer.wait();

  const response = await fetchImpl(YANDEX_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${settings.yandexApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return fail(
      limited,
      "provider_error",
      `Yandex Translate вернул ошибку ${response.status}.`,
    );
  }

  const translatedText = getYandexTranslatedText(await response.json());

  if (!translatedText.trim()) {
    return fail(
      limited,
      "empty_provider_response",
      "Yandex Translate не вернул текст перевода.",
    );
  }

  return succeed(translatedText, context, "yandex");
}

async function translateWithLibreTranslate(
  context: LibreTranslateContext,
): Promise<TranslationResult> {
  const { limited, settings, endpoint, fetchImpl, runtime } = context;
  const body: LibreTranslateBody = {
    q: limited.text,
    source: getSourceLanguage(settings),
    target: settings.targetLanguage,
    format: "text",
  };

  if (settings.libreTranslateApiKey) {
    body.api_key = settings.libreTranslateApiKey;
  }

  await runtime.pacer.wait();

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return fail(
      limited,
      "provider_error",
      `Переводчик вернул ошибку ${response.status}.`,
    );
  }

  const translatedText = getTranslatedText(await response.json());

  if (!translatedText.trim()) {
    return fail(
      limited,
      "empty_provider_response",
      "Переводчик не вернул текст перевода.",
    );
  }

  return succeed(translatedText, context, "libretranslate");
}

/** Google without a key is the least reliable link, so a configured provider covers it. */
function getFallbackProvider(
  settings: Settings,
  endpoint: string,
): TranslationProvider | null {
  if (!settings.autoFallbackProvider || settings.provider !== "google") {
    return null;
  }

  if (settings.yandexApiKey) {
    return "yandex";
  }

  return endpoint ? "libretranslate" : null;
}

const FALLBACK_CODES = new Set([
  "rate_limited",
  "provider_error",
  "network_error",
  "empty_provider_response",
]);

const FALLBACK_NOTES: Record<string, string> = {
  yandex: "Google ограничил доступ, поэтому перевел через Yandex.",
  libretranslate: "Google ограничил доступ, поэтому перевел через свой endpoint.",
};

function runProvider(
  provider: TranslationProvider,
  context: LibreTranslateContext,
): Promise<TranslationResult> {
  if (provider === "google") {
    return translateWithGoogle(context);
  }

  if (provider === "yandex") {
    return translateWithYandex(context);
  }

  return translateWithLibreTranslate(context);
}

async function translateOnce(
  context: LibreTranslateContext,
): Promise<TranslationResult> {
  const { settings, endpoint, limited } = context;
  const result = await runProvider(settings.provider, context);

  if (result.ok) {
    return result;
  }

  const fallbackProvider = getFallbackProvider(settings, endpoint);

  if (!fallbackProvider || !FALLBACK_CODES.has(result.code)) {
    return result;
  }

  try {
    const fallbackResult = await runProvider(fallbackProvider, context);

    if (fallbackResult.ok) {
      const note = FALLBACK_NOTES[fallbackProvider];

      return note ? { ...fallbackResult, note } : fallbackResult;
    }
  } catch {
    return result;
  }

  return fail(limited, result.code, result.message, result.retryAfterMs);
}

export async function translateText({
  text,
  settings: rawSettings = {},
  fetchImpl = globalThis.fetch,
  runtime = defaultRuntime,
}: {
  text: unknown;
  settings?: SettingsInput;
  fetchImpl?: FetchLike;
  runtime?: TranslateRuntime;
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
    return fail(
      limited,
      "missing_endpoint",
      "Укажи endpoint переводчика в настройках. Подойдёт LibreTranslate-compatible API.",
    );
  }

  if (settings.provider === "yandex" && !settings.yandexApiKey) {
    return fail(
      limited,
      "missing_yandex_api_key",
      "Укажи API-ключ Yandex Cloud Translate в настройках.",
    );
  }

  if (typeof fetchImpl !== "function") {
    return fail(
      limited,
      "fetch_unavailable",
      "В этом окружении недоступен сетевой запрос для перевода.",
    );
  }

  const cacheKey = buildCacheKey({
    provider: settings.provider,
    sourceLanguage: getSourceLanguage(settings),
    targetLanguage: settings.targetLanguage,
    text: limited.text,
  });
  const cached = runtime.cache.get(cacheKey);

  if (cached) {
    return {
      ok: true,
      translatedText: cached.translatedText,
      originalText: limited.text,
      targetLanguage: settings.targetLanguage,
      wasTrimmed: limited.wasTrimmed,
      provider: cached.provider,
      ...(cached.note ? { note: cached.note } : {}),
    };
  }

  const pending = runtime.inflight.get(cacheKey);

  if (pending) {
    return pending;
  }

  const context: LibreTranslateContext = {
    limited,
    settings,
    endpoint,
    fetchImpl,
    runtime,
  };

  const request = translateOnce(context)
    .catch((): TranslationResult => {
      return fail(
        limited,
        "network_error",
        "Не удалось получить перевод. Проверь подключение или настройки провайдера.",
      );
    })
    .then((result) => {
      if (result.ok) {
        runtime.cache.set(cacheKey, {
          translatedText: result.translatedText,
          provider: result.provider,
          ...(result.note ? { note: result.note } : {}),
        });
      }

      return result;
    })
    .finally(() => {
      runtime.inflight.delete(cacheKey);
    });

  runtime.inflight.set(cacheKey, request);

  return request;
}
