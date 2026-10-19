import assert from "node:assert/strict";
import test from "node:test";

import { getRuntimeMessage } from "../src/messages.js";

test("a translate request carries only the text: settings come from storage", () => {
  assert.deepEqual(
    getRuntimeMessage({ type: "ST_TRANSLATE", text: "Hello", targetLanguage: "de" }),
    { type: "ST_TRANSLATE", text: "Hello" },
  );
  assert.equal(getRuntimeMessage({ type: "ST_TRANSLATE" }), null);
});
