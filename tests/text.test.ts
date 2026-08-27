import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSelectionText } from "../src/text.js";

test("normalizeSelectionText drops a leading table pipe", () => {
  assert.equal(
    normalizeSelectionText("| Get 400+ AI prompts and websites"),
    "Get 400+ AI prompts and websites",
  );
});

test("normalizeSelectionText drops list bullets and quote marks", () => {
  assert.equal(normalizeSelectionText("• Первый пункт"), "Первый пункт");
  assert.equal(normalizeSelectionText("> цитата"), "цитата");
  assert.equal(normalizeSelectionText("— вводное слово"), "вводное слово");
  assert.equal(normalizeSelectionText("текст |"), "текст");
});

test("normalizeSelectionText keeps a minus that belongs to the text", () => {
  assert.equal(normalizeSelectionText("-5 градусов"), "-5 градусов");
  assert.equal(normalizeSelectionText("e-mail рассылка"), "e-mail рассылка");
});

test("normalizeSelectionText collapses column layout into readable lines", () => {
  assert.equal(
    normalizeSelectionText("  Первая   строка \n\n\n\n  вторая  \t строка  "),
    "Первая строка\n\nвторая строка",
  );
});

test("normalizeSelectionText joins a word broken by hyphenation", () => {
  assert.equal(
    normalizeSelectionText("пере-\nвод готов"),
    "перевод готов",
  );
  assert.equal(normalizeSelectionText("Из-\nмерение"), "Измерение");
});

test("normalizeSelectionText removes soft hyphens", () => {
  assert.equal(normalizeSelectionText("сло­vo"), "слоvo");
});

test("normalizeSelectionText survives empty and non-string input", () => {
  assert.equal(normalizeSelectionText(""), "");
  assert.equal(normalizeSelectionText("   \n  "), "");
  assert.equal(normalizeSelectionText(null), "");
  assert.equal(normalizeSelectionText(undefined), "");
  assert.equal(normalizeSelectionText(42), "42");
});
