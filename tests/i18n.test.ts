import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createTranslator,
  DEFAULT_LOCALE,
  getMessages,
  isMessageKey,
  matchUiLocale,
  resolveUiLocale,
  UI_LOCALES,
} from "../src/i18n.js";
import {
  getLanguageName,
  getLanguageNameKey,
  TARGET_LANGUAGES,
} from "../src/languages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLACEHOLDER = /\{(\w+)\}/g;

function readProjectFile(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "").sort();
}

test("auto picks the browser language when it is English, Russian or Spanish", () => {
  assert.equal(resolveUiLocale("auto", "ru"), "ru");
  assert.equal(resolveUiLocale("auto", "ru-RU"), "ru");
  assert.equal(resolveUiLocale("auto", "es-419"), "es");
  assert.equal(resolveUiLocale("auto", "es_MX"), "es");
  assert.equal(resolveUiLocale("auto", "en-GB"), "en");
});

test("auto falls back to English for any other or missing browser language", () => {
  assert.equal(DEFAULT_LOCALE, "en");

  for (const language of ["de-DE", "zh-CN", "uk", "pt-BR", "", undefined, 42]) {
    assert.equal(resolveUiLocale("auto", language), "en", String(language));
  }
});

test("an explicit choice wins over the browser language", () => {
  assert.equal(resolveUiLocale("es", "ru-RU"), "es");
  assert.equal(resolveUiLocale("ru", "de-DE"), "ru");
  assert.equal(resolveUiLocale("en", "es-ES"), "en");
});

test("matchUiLocale reads the primary subtag only", () => {
  assert.equal(matchUiLocale("RU"), "ru");
  assert.equal(matchUiLocale("english"), null);
  assert.equal(matchUiLocale(null), null);
});

test("every locale has exactly the English keys, filled, with the same placeholders", () => {
  const reference = getMessages("en");
  const keys = Object.keys(reference).sort();

  for (const locale of UI_LOCALES) {
    const messages = getMessages(locale);

    assert.deepEqual(Object.keys(messages).sort(), keys, locale);

    for (const key of keys) {
      assert.ok(isMessageKey(key));
      const text = messages[key];
      assert.ok(text.trim(), `${locale}: ${key} is empty`);
      assert.deepEqual(
        placeholdersOf(text),
        placeholdersOf(reference[key]),
        `${locale}: ${key} placeholders`,
      );
    }
  }
});

test("each locale names itself, and the Russian and Spanish catalogs are translated", () => {
  assert.equal(getMessages("en")["locale.autonym"], "English");
  assert.equal(getMessages("ru")["locale.autonym"], "Русский");
  assert.equal(getMessages("es")["locale.autonym"], "Español");
  assert.equal(createTranslator("ru")("toolbar.translate"), "Перевести");
  assert.equal(createTranslator("es")("toolbar.translate"), "Traducir");
});

test("createTranslator fills placeholders and leaves unknown ones visible", () => {
  const t = createTranslator("en");

  assert.equal(
    t("error.provider_error", { provider: "LibreTranslate", status: 503 }),
    "LibreTranslate returned error 503.",
  );
  assert.equal(
    t("error.provider_error", { provider: "LibreTranslate" }),
    "LibreTranslate returned error {status}.",
  );
  assert.equal(t("time.seconds", { count: 5, extra: "x" }), "5 sec");
});

test("the clipboard hint tells how to copy by hand in every language", () => {
  for (const locale of UI_LOCALES) {
    assert.match(getMessages(locale)["panel.copyBlocked"], /Ctrl\+C/, locale);
  }
});

test("every target language has a name in the catalogs", () => {
  const t = createTranslator("es");

  for (const code of TARGET_LANGUAGES) {
    assert.ok(isMessageKey(getLanguageNameKey(code)), code);
  }

  assert.equal(getLanguageName("de", t), "Alemán");
  assert.equal(getLanguageName("pt", t), "pt");
});

const LOCALIZED_SOURCES = [
  "src/content.ts",
  "options/options.html",
  "options/options.ts",
  "popup/popup.html",
  "popup/popup.ts",
];

test("markup refers only to keys that exist in the catalogs", () => {
  const reference =
    /data-i18n(?:-[a-z-]+)?="([^"]+)"|\bi18n(?:Title|AriaLabel)? = "([^"]+)"/g;

  for (const path of LOCALIZED_SOURCES) {
    for (const match of readProjectFile(path).matchAll(reference)) {
      const key = match[1] ?? match[2];
      assert.equal(isMessageKey(key), true, `${path}: unknown key ${key}`);
    }
  }
});

test("headings, labels and buttons of the pages get their text from a key", () => {
  for (const path of ["options/options.html", "popup/popup.html"]) {
    const html = readProjectFile(path);

    for (const [element] of html.matchAll(/<(h1|h2|button)\b[^>]*>[^<]*<\/\1>/g)) {
      if (element.includes('id="theme-toggle"')) {
        continue;
      }

      assert.match(element, /data-i18n="/, `${path}: ${element}`);
    }

    for (const [label] of html.matchAll(/<label\b[\s\S]*?<\/label>/g)) {
      assert.match(label, /data-i18n="/, `${path}: ${label}`);
    }
  }
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(ts|html|css)$/.test(name))
    .map((name) => join(directory, name).replaceAll("\\", "/"));
}

test("no user-facing Russian text is left outside the Russian catalog", () => {
  const files = ["src", "options", "popup"]
    .flatMap(listSourceFiles)
    .filter((path) => path !== "src/locales/ru.ts");

  for (const path of files) {
    assert.equal(/[А-Яа-яЁё]/.test(readProjectFile(path)), false, path);
  }
});
