import assert from "node:assert/strict";
import test from "node:test";

import { type TranslateCopySteps, translateAndCopy } from "../src/translate-copy.js";

/** Steps that succeed by default and record the order in which they ran. */
function createSteps(overrides: Partial<TranslateCopySteps> = {}) {
  const calls: string[] = [];
  const steps: TranslateCopySteps = {
    translate: async () => {
      calls.push("translate");
      return true;
    },
    hasFocus: () => {
      calls.push("hasFocus");
      return true;
    },
    copy: async () => {
      calls.push("copy");
      return true;
    },
    ...overrides,
  };

  return { calls, steps };
}

test("translateAndCopy copies a current translation while the page has focus", async () => {
  const { calls, steps } = createSteps();

  assert.equal(await translateAndCopy(steps), "copied");
  assert.deepEqual(calls, ["translate", "hasFocus", "copy"]);
});

test("translateAndCopy never copies an error, stale or dismissed translation", async () => {
  let copyCalls = 0;
  const { steps } = createSteps({
    translate: async () => false,
    copy: async () => {
      copyCalls += 1;
      return true;
    },
  });

  assert.equal(await translateAndCopy(steps), "not-ready");
  assert.equal(copyCalls, 0);
});

test("translateAndCopy leaves the clipboard alone when focus was lost while waiting", async () => {
  let focused = true;
  let copyCalls = 0;
  const { steps } = createSteps({
    translate: async () => {
      focused = false;
      return true;
    },
    hasFocus: () => focused,
    copy: async () => {
      copyCalls += 1;
      return true;
    },
  });

  assert.equal(await translateAndCopy(steps), "unfocused");
  assert.equal(copyCalls, 0);
});

test("translateAndCopy reports a clipboard failure", async () => {
  const { steps } = createSteps({ copy: async () => false });

  assert.equal(await translateAndCopy(steps), "failed");
});
