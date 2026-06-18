import test from "node:test";
import assert from "node:assert/strict";

import { shouldRefreshSelectionForKey } from "../src/keyboard.js";

test("shouldRefreshSelectionForKey ignores non-string keys without throwing", () => {
  assert.equal(shouldRefreshSelectionForKey(undefined), false);
  assert.equal(shouldRefreshSelectionForKey(null), false);
  assert.equal(shouldRefreshSelectionForKey({}), false);
});

test("shouldRefreshSelectionForKey refreshes only for arrow keys and shift", () => {
  assert.equal(shouldRefreshSelectionForKey("ArrowLeft"), true);
  assert.equal(shouldRefreshSelectionForKey("ArrowRight"), true);
  assert.equal(shouldRefreshSelectionForKey("Shift"), true);
  assert.equal(shouldRefreshSelectionForKey("a"), false);
  assert.equal(shouldRefreshSelectionForKey(""), false);
});
