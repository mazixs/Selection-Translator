import test from "node:test";
import assert from "node:assert/strict";

import {
  createCooldown,
  createPacer,
  formatCooldownHint,
  getBackoffMs,
  MAX_COOLDOWN_MS,
  parseRetryAfterMs,
} from "../src/pacing.js";

test("createPacer keeps a jittered gap between requests", async () => {
  let clock = 0;
  const delays: number[] = [];
  const pacer = createPacer({
    minIntervalMs: 400,
    jitterMs: 200,
    now: () => clock,
    random: () => 0.5,
    sleep: async (ms) => {
      delays.push(ms);
      clock += ms;
    },
  });

  await pacer.wait();
  await pacer.wait();
  await pacer.wait();

  assert.deepEqual(delays, [100, 500, 500]);
});

test("createCooldown counts down and forgets an expired block", () => {
  let clock = 1_000;
  const cooldown = createCooldown({ now: () => clock });

  cooldown.block("google", 5_000);
  assert.equal(cooldown.remaining("google"), 5_000);

  clock += 4_000;
  assert.equal(cooldown.remaining("google"), 1_000);

  clock += 1_000;
  assert.equal(cooldown.remaining("google"), 0);
});

test("createCooldown never shortens an active block and can be cleared", () => {
  const cooldown = createCooldown({ now: () => 0 });

  cooldown.block("google", 10_000);
  cooldown.block("google", 1_000);
  assert.equal(cooldown.remaining("google"), 10_000);

  cooldown.clear("google");
  assert.equal(cooldown.remaining("google"), 0);
});

test("createCooldown caps a block at the maximum", () => {
  const cooldown = createCooldown({ now: () => 0 });

  cooldown.block("google", 60 * 60_000);
  assert.equal(cooldown.remaining("google"), MAX_COOLDOWN_MS);
});

test("parseRetryAfterMs reads both seconds and HTTP dates", () => {
  const now = () => Date.parse("2026-08-27T10:00:00Z");

  assert.equal(parseRetryAfterMs("30", now), 30_000);
  assert.equal(parseRetryAfterMs("Thu, 27 Aug 2026 10:00:45 GMT", now), 45_000);
  assert.equal(parseRetryAfterMs("Thu, 27 Aug 2026 09:59:00 GMT", now), 0);
  assert.equal(parseRetryAfterMs("", now), 0);
  assert.equal(parseRetryAfterMs(null, now), 0);
  assert.equal(parseRetryAfterMs("nonsense", now), 0);
});

test("getBackoffMs grows, stays capped and respects Retry-After", () => {
  const random = () => 0;

  assert.equal(getBackoffMs(0, 0, random), 350);
  assert.equal(getBackoffMs(1, 0, random), 700);
  assert.equal(getBackoffMs(20, 0, random), 4_000);
  assert.equal(getBackoffMs(0, 9_000, random), 9_000);
  assert.ok(getBackoffMs(0, 0, () => 1) > getBackoffMs(0, 0, random));
});

test("formatCooldownHint speaks in seconds and minutes", () => {
  assert.equal(formatCooldownHint(1_500), "2 сек.");
  assert.equal(formatCooldownHint(45_000), "45 сек.");
  assert.equal(formatCooldownHint(90_000), "2 мин.");
});
