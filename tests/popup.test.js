import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

test("popup header uses the extension icon instead of a Yandex-like letter", () => {
  const popupHtml = readFileSync(join(ROOT, "popup/popup.html"), "utf8");

  assert.equal(popupHtml.includes('<div class="brand-mark">Y</div>'), false);
  assert.equal(popupHtml.includes('src="../assets/icon-48.png"'), true);
});
