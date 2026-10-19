import assert from "node:assert/strict";
import test from "node:test";

import { createTranslator, isMessageKey } from "../src/i18n.js";
import {
  describeTranslationFailure,
  describeTranslationNote,
  formatCooldown,
} from "../src/translation-messages.js";
import type {
  TranslationErrorCode,
  TranslationFailure,
  TranslationSuccess,
} from "../src/translator.js";

const CODES: TranslationErrorCode[] = [
  "empty_text",
  "missing_endpoint",
  "missing_yandex_api_key",
  "fetch_unavailable",
  "rate_limited",
  "provider_error",
  "network_error",
  "empty_provider_response",
];

const en = createTranslator("en");
const ru = createTranslator("ru");
const es = createTranslator("es");

function failure(
  code: TranslationErrorCode,
  details: Partial<TranslationFailure> = {},
): TranslationFailure {
  return { ok: false, code, originalText: "Hello", ...details };
}

function success(details: Partial<TranslationSuccess> = {}): TranslationSuccess {
  return {
    ok: true,
    translatedText: "Hola",
    originalText: "Hello",
    targetLanguage: "es",
    wasTrimmed: false,
    provider: "google",
    ...details,
  };
}

test("formatCooldown speaks in seconds and minutes", () => {
  assert.equal(formatCooldown(1_500, ru), "2 сек.");
  assert.equal(formatCooldown(45_000, ru), "45 сек.");
  assert.equal(formatCooldown(90_000, ru), "2 мин.");
  assert.equal(formatCooldown(0, en), "1 sec");
  assert.equal(formatCooldown(90_000, es), "2 min");
});

test("every failure code is worded in the UI language", () => {
  const unknown = en("error.unknown");

  for (const code of CODES) {
    const text = describeTranslationFailure(failure(code), en);
    assert.ok(text && text !== unknown, code);
    assert.equal(text.includes("{"), false, `${code}: ${text}`);
  }
});

test("each failure code has its own key, the same in every locale", () => {
  for (const code of CODES) {
    assert.ok(isMessageKey(`error.${code}`), code);
  }
});

test("provider errors name the provider and carry the HTTP status", () => {
  assert.equal(
    describeTranslationFailure(
      failure("provider_error", { provider: "yandex", status: 401 }),
      en,
    ),
    "Yandex Translate returned error 401.",
  );
  assert.equal(
    describeTranslationFailure(
      failure("provider_error", { provider: "google", status: 503 }),
      ru,
    ),
    "Google Переводчик вернул ошибку 503.",
  );
  assert.equal(
    describeTranslationFailure(failure("provider_error", { status: 500 }), es),
    "El traductor devolvió el error 500.",
  );
  assert.match(
    describeTranslationFailure(
      failure("empty_provider_response", { provider: "yandex" }),
      es,
    ),
    /Yandex/,
  );
});

test("the rate limit hint says when to try again", () => {
  assert.match(
    describeTranslationFailure(failure("rate_limited", { retryAfterMs: 90_000 }), en),
    /Google.*2 min/,
  );
});

test("an unexpected code from the message channel still gets a text", () => {
  const strange = failure("network_error", {
    code: "something_new" as TranslationErrorCode,
  });

  assert.equal(describeTranslationFailure(strange, es), es("error.unknown"));
});

test("the note says which provider stood in and that the text was trimmed", () => {
  assert.equal(describeTranslationNote(success(), en), "");
  assert.equal(
    describeTranslationNote(
      success({ provider: "yandex", fallbackFrom: "rate_limited" }),
      en,
    ),
    "Google limited access, so Yandex Translate translated the text.",
  );
  assert.equal(
    describeTranslationNote(
      success({
        provider: "libretranslate",
        fallbackFrom: "provider_error",
        wasTrimmed: true,
      }),
      ru,
    ),
    `${ru("note.fallback", { provider: "LibreTranslate" })} ${ru("panel.trimmed")}`,
  );
});

test("the fallback note blames a rate limit only when there was one", () => {
  assert.equal(
    describeTranslationNote(
      success({ provider: "yandex", fallbackFrom: "network_error" }),
      en,
    ),
    "Google could not translate the text, so Yandex Translate did.",
  );
  assert.match(
    describeTranslationNote(
      success({ provider: "yandex", fallbackFrom: "rate_limited" }),
      ru,
    ),
    /ограничил доступ/,
  );
});
