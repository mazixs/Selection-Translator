import test from "node:test";
import assert from "node:assert/strict";

import {
  createTranslateRuntime,
  limitTextForTranslation,
  normalizeLibreTranslateUrl,
  translateText,
  type TranslateRuntime,
} from "../src/translator.js";

type FetchCall = {
  url: string | URL | Request;
  init: RequestInit;
};

/** Requests must not really wait in tests, and the clock must not really move. */
function createTestRuntime(): TranslateRuntime {
  return createTranslateRuntime({
    now: () => 1_700_000_000_000,
    random: () => 0.5,
    sleep: async () => {},
  });
}

function getCall(calls: FetchCall[], index: number): FetchCall {
  const call = calls[index];
  assert.ok(call);
  return call;
}

test("normalizeLibreTranslateUrl accepts full translate endpoint", () => {
  assert.equal(
    normalizeLibreTranslateUrl("https://translate.example.com/translate"),
    "https://translate.example.com/translate",
  );
});

test("normalizeLibreTranslateUrl appends translate path to base URL", () => {
  assert.equal(
    normalizeLibreTranslateUrl("https://translate.example.com/"),
    "https://translate.example.com/translate",
  );
});

test("normalizeLibreTranslateUrl rejects unsafe endpoint URLs", () => {
  assert.equal(
    normalizeLibreTranslateUrl("https://user:secret@translate.example.com"),
    "",
  );
  assert.equal(normalizeLibreTranslateUrl("ftp://translate.example.com"), "");
  assert.equal(normalizeLibreTranslateUrl("not a url"), "");
});

test("limitTextForTranslation trims text and reports trimming", () => {
  const result = limitTextForTranslation("abcdef", 4);

  assert.deepEqual(result, {
    text: "abcd",
    wasTrimmed: true,
    originalLength: 6,
    limit: 4,
  });
});

test("translateText asks for provider setup when LibreTranslate endpoint is missing", async () => {
  const result = await translateText({
    text: "Hello",
    settings: { provider: "libretranslate", endpoint: "" },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_endpoint");
  assert.match(result.message, /endpoint/i);
});

test("translateText posts LibreTranslate-compatible payload and parses translatedText", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    runtime: createTestRuntime(),
    settings: {
      provider: "libretranslate",
      endpoint: "https://translate.example.com",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
      yandexApiKey: "yandex-secret",
      libreTranslateApiKey: "libre-secret",
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return { translatedText: "Привет, мир" };
        },
      };
    },
  });

  const firstCall = getCall(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(firstCall.url, "https://translate.example.com/translate");
  assert.equal(firstCall.init.method, "POST");
  assert.deepEqual(JSON.parse(String(firstCall.init.body)), {
    q: "Hello world",
    source: "en",
    target: "ru",
    format: "text",
    api_key: "libre-secret",
  });
});

test("translateText rejects credentialed LibreTranslate endpoint before fetch", async () => {
  const result = await translateText({
    text: "Hello",
    settings: {
      provider: "libretranslate",
      endpoint: "https://user:secret@translate.example.com",
      libreTranslateApiKey: "libre-secret",
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_endpoint");
});

test("translateText posts the selection to the Chrome dictionary endpoint first", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
    },
    runtime: createTestRuntime(),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            sentences: [{ trans: "Привет, " }, { trans: "мир" }],
            src: "en",
          };
        },
      };
    },
  });

  const firstCall = getCall(calls, 0);
  const requestUrl = new URL(String(firstCall.url));

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(result.provider, "google");
  assert.equal(calls.length, 1);
  assert.equal(requestUrl.origin, "https://clients5.google.com");
  assert.equal(requestUrl.pathname, "/translate_a/single");
  assert.equal(requestUrl.searchParams.get("client"), "dict-chrome-ex");
  assert.equal(requestUrl.searchParams.get("dj"), "1");
  assert.equal(requestUrl.searchParams.get("sl"), "en");
  assert.equal(requestUrl.searchParams.get("tl"), "ru");
  assert.equal(requestUrl.searchParams.get("hl"), "ru");
  assert.equal(requestUrl.searchParams.has("q"), false);
  assert.equal(firstCall.init.method, "POST");
  assert.equal(
    new URLSearchParams(String(firstCall.init.body)).get("q"),
    "Hello world",
  );
  assert.equal(
    new Headers(firstCall.init.headers).get("Accept-Language"),
    "ru,ru-RU;q=0.9,en;q=0.8",
  );
});

test("translateText still parses the classic Google array response", async () => {
  const result = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "ru" },
    runtime: createTestRuntime(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return [
          [
            ["Привет, ", "Hello ", null, null, 1],
            ["мир", "world", null, null, 1],
          ],
          null,
          "en",
        ];
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
});

test("translateText walks to the next Google route after 429", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "ru" },
    runtime: createTestRuntime(),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });

      if (calls.length === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "1" }),
          async json() {
            return {};
          },
        };
      }

      return {
        ok: true,
        status: 200,
        async json() {
          return { sentences: [{ trans: "Привет, мир" }] };
        },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(calls.length, 2);
  assert.equal(
    new URL(String(getCall(calls, 1).url)).origin,
    "https://translate.googleapis.com",
  );
});

test("translateText reports a rate limit and stops calling Google during cooldown", async () => {
  let requests = 0;
  const runtime = createTestRuntime();
  const fetchImpl = async () => {
    requests += 1;
    return {
      ok: false,
      status: 429,
      headers: new Headers(),
      async json() {
        return {};
      },
    };
  };

  const first = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "ru" },
    runtime,
    fetchImpl,
  });

  assert.equal(first.ok, false);
  assert.equal(first.code, "rate_limited");
  assert.match(first.message, /Google/);
  assert.ok((first.retryAfterMs || 0) > 0);
  assert.equal(requests, 3);

  const second = await translateText({
    text: "Another selection",
    settings: { targetLanguage: "ru" },
    runtime,
    fetchImpl,
  });

  assert.equal(second.ok, false);
  assert.equal(second.code, "rate_limited");
  assert.equal(requests, 3);
});

test("translateText falls back to Yandex when Google is rate limited", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      yandexApiKey: "yandex-secret",
    },
    runtime: createTestRuntime(),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });

      if (String(url).includes("cloud.yandex.net")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { translations: [{ text: "Привет, мир" }] };
          },
        };
      }

      return {
        ok: false,
        status: 429,
        headers: new Headers(),
        async json() {
          return {};
        },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(result.provider, "yandex");
  assert.match(String(result.note), /Yandex/);
});

test("translateText keeps the Google failure when the fallback also fails", async () => {
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      yandexApiKey: "yandex-secret",
    },
    runtime: createTestRuntime(),
    fetchImpl: async (url) => ({
      ok: false,
      status: String(url).includes("cloud.yandex.net") ? 401 : 429,
      headers: new Headers(),
      async json() {
        return {};
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "rate_limited");
});

test("translateText does not fall back when the setting is off", async () => {
  const calls: string[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      yandexApiKey: "yandex-secret",
      autoFallbackProvider: false,
    },
    runtime: createTestRuntime(),
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: false,
        status: 429,
        headers: new Headers(),
        async json() {
          return {};
        },
      };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "rate_limited");
  assert.equal(
    calls.some((url) => url.includes("cloud.yandex.net")),
    false,
  );
});

test("translateText serves a repeated selection from cache", async () => {
  let requests = 0;
  const runtime = createTestRuntime();
  const fetchImpl = async () => {
    requests += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { sentences: [{ trans: "Привет, мир" }] };
      },
    };
  };

  const first = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "ru" },
    runtime,
    fetchImpl,
  });
  const second = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "ru" },
    runtime,
    fetchImpl,
  });
  const other = await translateText({
    text: "Hello world",
    settings: { targetLanguage: "de" },
    runtime,
    fetchImpl,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(other.ok, true);
  assert.equal(requests, 2);
});

test("translateText shares one request between parallel identical selections", async () => {
  let requests = 0;
  const runtime = createTestRuntime();
  const fetchImpl = async () => {
    requests += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { sentences: [{ trans: "Привет, мир" }] };
      },
    };
  };
  const settings = { targetLanguage: "ru" };

  const [first, second] = await Promise.all([
    translateText({ text: "Hello world", settings, runtime, fetchImpl }),
    translateText({ text: "Hello world", settings, runtime, fetchImpl }),
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(requests, 1);
});

test("translateText posts Yandex Cloud payload and parses translations", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    runtime: createTestRuntime(),
    settings: {
      provider: "yandex",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
      yandexApiKey: "yandex-secret",
      libreTranslateApiKey: "libre-secret",
      yandexFolderId: "folder-123",
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            translations: [
              {
                text: "Привет, мир",
                detectedLanguageCode: "en",
              },
            ],
          };
        },
      };
    },
  });

  const firstCall = getCall(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(
    firstCall.url,
    "https://translate.api.cloud.yandex.net/translate/v2/translate",
  );
  assert.equal(firstCall.init.method, "POST");
  assert.equal(
    new Headers(firstCall.init.headers).get("Authorization"),
    "Api-Key yandex-secret",
  );
  assert.deepEqual(JSON.parse(String(firstCall.init.body)), {
    targetLanguageCode: "ru",
    sourceLanguageCode: "en",
    format: "PLAIN_TEXT",
    texts: ["Hello world"],
    folderId: "folder-123",
  });
});

test("translateText asks for Yandex API key before calling provider", async () => {
  const result = await translateText({
    text: "Hello world",
    settings: {
      provider: "yandex",
      targetLanguage: "ru",
      yandexApiKey: "",
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_yandex_api_key");
  assert.match(result.message, /Yandex/i);
});

test("translateText hides raw network error details from the result message", async () => {
  const result = await translateText({
    text: "Hello world",
    runtime: createTestRuntime(),
    settings: {
      provider: "libretranslate",
      endpoint: "https://translate.example.com",
      targetLanguage: "ru",
      libreTranslateApiKey: "libre-secret",
    },
    fetchImpl: async () => {
      throw new Error("failed for https://user:secret@translate.example.com");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "network_error");
  assert.equal(result.message.includes("user:secret"), false);
  assert.equal(result.message.includes("translate.example.com"), false);
});
