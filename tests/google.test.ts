import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAcceptLanguage,
  GOOGLE_ORIGINS,
  GOOGLE_ROUTES,
  parseGoogleResponse,
} from "../src/google.js";
import { mergeSettings } from "../src/settings.js";

test("google routes start with the endpoint that survives rate limiting", () => {
  const [first, second, third] = GOOGLE_ROUTES;

  assert.equal(GOOGLE_ROUTES.length, 3);
  assert.equal(first?.id, "dict-chrome-ex");
  assert.equal(first?.origin, "https://clients5.google.com");
  assert.equal(second?.origin, "https://translate.googleapis.com");
  assert.equal(third?.id, "dict-chrome-ex-plain");
  assert.deepEqual([...GOOGLE_ORIGINS].sort(), [
    "https://clients5.google.com",
    "https://translate.googleapis.com",
  ]);
});

test("every google route sends the text in a form body, not in the URL", () => {
  const settings = mergeSettings({ targetLanguage: "ru" });
  const text = "П".repeat(5_000);

  for (const route of GOOGLE_ROUTES) {
    const request = route.build(text, settings);

    assert.ok(request.url.length < 300, `${route.id} keeps the URL short`);
    assert.equal(new URL(request.url).searchParams.has("q"), false);
    assert.equal(new URLSearchParams(request.body).get("q"), text);
    assert.match(
      String(request.headers["Content-Type"]),
      /x-www-form-urlencoded/,
    );
    assert.equal(request.headers["Accept-Language"], "ru,ru-RU;q=0.9,en;q=0.8");
  }
});

test("google route uses auto detection unless a source language is pinned", () => {
  const route = GOOGLE_ROUTES[0]!;

  assert.equal(
    new URL(route.build("Hello", mergeSettings({ sourceLanguage: "en" })).url)
      .searchParams.get("sl"),
    "auto",
  );
  assert.equal(
    new URL(
      route.build(
        "Hello",
        mergeSettings({ sourceLanguage: "en", autoDetectSource: false }),
      ).url,
    ).searchParams.get("sl"),
    "en",
  );
});

test("buildAcceptLanguage mirrors the requested language", () => {
  assert.equal(buildAcceptLanguage("de"), "de,de-DE;q=0.9,en;q=0.8");
  assert.equal(buildAcceptLanguage("en"), "en-US,en;q=0.9");
  assert.equal(buildAcceptLanguage("pt-BR"), "pt,pt-PT;q=0.9,en;q=0.8");
  assert.equal(buildAcceptLanguage(""), "en-US,en;q=0.9");
});

test("parseGoogleResponse reads all three answer shapes", () => {
  assert.equal(
    parseGoogleResponse({
      sentences: [{ trans: "Привет, " }, { trans: "мир" }],
      src: "en",
    }),
    "Привет, мир",
  );
  assert.equal(
    parseGoogleResponse([
      [
        ["Привет, ", "Hello ", null, null, 1],
        ["мир", "world", null, null, 1],
      ],
      null,
      "en",
    ]),
    "Привет, мир",
  );
  assert.equal(parseGoogleResponse([["Привет, мир", "en"]]), "Привет, мир");
});

test("parseGoogleResponse returns an empty string for anything else", () => {
  assert.equal(parseGoogleResponse(null), "");
  assert.equal(parseGoogleResponse("<html>Sorry...</html>"), "");
  assert.equal(parseGoogleResponse({ sentences: [] }), "");
  assert.equal(parseGoogleResponse([]), "");
});
