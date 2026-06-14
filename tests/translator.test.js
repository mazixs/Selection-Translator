import test from "node:test";
import assert from "node:assert/strict";

import {
  limitTextForTranslation,
  normalizeLibreTranslateUrl,
  translateText,
} from "../src/translator.js";

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
  const calls = [];
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
    fetchImpl: async (url, init) => {
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

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(calls[0].url, "https://translate.example.com/translate");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    q: "Hello world",
    source: "en",
    target: "ru",
    format: "text",
    api_key: "secret",
  });
});

test("translateText uses Google web provider by default and parses nested response", async () => {
  const calls = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
    },
    fetchImpl: async (url, init) => {
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

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.match(calls[0].url, /^https:\/\/translate\.googleapis\.com\/translate_a\/single\?/);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(new URL(calls[0].url).searchParams.get("sl"), "en");
  assert.equal(new URL(calls[0].url).searchParams.get("tl"), "ru");
});

test("translateText posts Yandex Cloud payload and parses translations", async () => {
  const calls = [];
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
    fetchImpl: async (url, init) => {
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

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(
    calls[0].url,
    "https://translate.api.cloud.yandex.net/translate/v2/translate",
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Api-Key yandex-secret");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
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
  const calls = [];
  const result = await translateText({
    text: "Hello world",
    settings: {
      provider: "yandex-web",
      targetLanguage: "ru",
      sourceLanguage: "en",
      autoDetectSource: false,
    },
    fetchImpl: async (url, init) => {
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

  assert.equal(result.ok, true);
  assert.equal(result.translatedText, "Привет, мир");
  assert.equal(
    calls[0].url,
    "https://translate.yandex.ru/props/api/v1.0/sessions?srv=tr-text",
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Referer, "https://translate.yandex.ru/");
  assert.equal(calls[0].init.headers.Origin, "https://translate.yandex.ru");
  assert.equal(calls[0].init.referrer, "https://translate.yandex.ru/");
  assert.equal(
    calls[1].url,
    "https://translate.yandex.net/api/v1/tr.json/translateSentence",
  );
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.referrer, "https://translate.yandex.ru/");
  assert.equal(calls[1].init.headers.Referer, "https://translate.yandex.ru/");
  assert.equal(calls[1].init.headers.Origin, "https://translate.yandex.ru");
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(calls[1].init.body)),
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
