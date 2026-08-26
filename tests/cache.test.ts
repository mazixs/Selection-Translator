import test from "node:test";
import assert from "node:assert/strict";

import { buildCacheKey, createTranslationCache } from "../src/cache.js";

test("buildCacheKey separates provider and language pair", () => {
  const base = {
    provider: "google",
    sourceLanguage: "auto",
    targetLanguage: "ru",
    text: "Hello",
  };

  assert.notEqual(
    buildCacheKey(base),
    buildCacheKey({ ...base, targetLanguage: "de" }),
  );
  assert.notEqual(
    buildCacheKey(base),
    buildCacheKey({ ...base, provider: "yandex" }),
  );
  assert.equal(buildCacheKey(base), buildCacheKey({ ...base }));
});

test("createTranslationCache returns a stored value and drops it after the TTL", () => {
  let clock = 0;
  const cache = createTranslationCache<string>({
    ttlMs: 1_000,
    now: () => clock,
  });

  cache.set("key", "Привет");
  assert.equal(cache.get("key"), "Привет");

  clock += 999;
  assert.equal(cache.get("key"), "Привет");

  clock += 1;
  assert.equal(cache.get("key"), undefined);
  assert.equal(cache.size(), 0);
});

test("createTranslationCache evicts the least recently used entry", () => {
  const cache = createTranslationCache<string>({
    maxEntries: 2,
    now: () => 0,
  });

  cache.set("a", "1");
  cache.set("b", "2");
  cache.get("a");
  cache.set("c", "3");

  assert.equal(cache.size(), 2);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), "1");
  assert.equal(cache.get("c"), "3");
});
