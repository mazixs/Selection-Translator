import test from "node:test";
import assert from "node:assert/strict";

import {
  limitTextForTranslation,
  normalizeLibreTranslateUrl,
  translateText,
} from "../src/translator.js";

type FetchCall = {
  url: string | URL | Request;
  init: RequestInit;
};

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
    settings: {
      provider: "libretranslate",
      endpoint: "https://translate.example.com",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
      apiKey: "secret",
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
    api_key: "secret",
  });
});

test("translateText uses Google web provider by default and parses nested response", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      return {
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
      };
    },
  });

  const firstCall = getCall(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.match(String(firstCall.url), /^https:\/\/translate\.googleapis\.com\/translate_a\/single\?/);
  assert.equal(firstCall.init.method, "GET");
  assert.equal(new URL(String(firstCall.url)).searchParams.get("sl"), "en");
  assert.equal(new URL(String(firstCall.url)).searchParams.get("tl"), "ru");
});

test("translateText posts Yandex Cloud payload and parses translations", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      provider: "yandex",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
      apiKey: "yandex-secret",
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
      apiKey: "",
    },
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "missing_yandex_api_key");
  assert.match(result.message, /Yandex/i);
});

test("translateText uses Yandex web session and translateSentence endpoint", async () => {
  const calls: FetchCall[] = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      provider: "yandex-web",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });

      if (String(url).includes("/props/api/v1.0/sessions")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              session: {
                id: "web-session",
              },
            };
          },
        };
      }

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            code: 200,
            lang: "en-ru",
            text: ["Привет, мир"],
          };
        },
      };
    },
  });

  const firstCall = getCall(calls, 0);
  const secondCall = getCall(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(
    firstCall.url,
    "https://translate.yandex.ru/props/api/v1.0/sessions?srv=tr-text",
  );
  assert.equal(firstCall.init.method, "POST");
  assert.equal(new Headers(firstCall.init.headers).get("Referer"), "https://translate.yandex.ru/");
  assert.equal(new Headers(firstCall.init.headers).get("Origin"), "https://translate.yandex.ru");
  assert.equal(firstCall.init.referrer, "https://translate.yandex.ru/");
  assert.equal(
    secondCall.url,
    "https://translate.yandex.net/api/v1/tr.json/translateSentence",
  );
  assert.equal(secondCall.init.method, "POST");
  assert.equal(secondCall.init.referrer, "https://translate.yandex.ru/");
  assert.equal(new Headers(secondCall.init.headers).get("Referer"), "https://translate.yandex.ru/");
  assert.equal(new Headers(secondCall.init.headers).get("Origin"), "https://translate.yandex.ru");
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(String(secondCall.init.body))),
    {
      id: "web-session-0-0",
      srv: "tr-text",
      source_lang: "en",
      target_lang: "ru",
      reason: "auto",
      format: "text",
      text: "Hello world",
      options: "0",
    },
  );
});
