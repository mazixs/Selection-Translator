import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("translation panel avoids semantic page tags that inherit site styles", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.equal(contentScript.includes('document.createElement("section")'), false);
  assert.equal(contentScript.includes("<header"), false);
  assert.equal(contentScript.includes("</header>"), false);
  assert.equal(contentScript.includes("<footer"), false);
  assert.equal(contentScript.includes("</footer>"), false);
});

test("content script guards against stale translation responses", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(contentScript, /let activeTranslationRequestId = 0;/);
  assert.match(contentScript, /const requestId = \+\+activeTranslationRequestId;/);
  assert.match(contentScript, /requestId !== activeTranslationRequestId/);
});

test("content script caches settings and listens for storage changes", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /let cachedSettings: Settings = \{ \.\.\.DEFAULT_SETTINGS \};/,
  );
  assert.match(contentScript, /async function refreshSettings/);
  assert.equal(contentScript.includes("chrome.storage.onChanged.addListener"), true);
  assert.equal(contentScript.includes("changes?.targetLanguage"), true);
  assert.equal(contentScript.includes("cachedSettings = mergeSettings"), true);
});

test("selection toolbar uses the extension icon instead of a Yandex-like letter", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.equal(contentScript.includes('badge.textContent = "Y"'), false);
  assert.equal(contentScript.includes('chrome.runtime.getURL("assets/icon.svg")'), true);
});

test("content script ignores synthetic page events for privileged UI actions", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /function isTrustedUserEvent\(event: Event\): boolean \{\s+return event\.isTrusted === true;\s+\}/s,
  );
  assert.match(
    contentScript,
    /toolbar\.addEventListener\("click", \(event\) => \{\s+if \(!isTrustedUserEvent\(event\)\)/s,
  );
  assert.match(
    contentScript,
    /async function handleLanguageChange\(event: Event\) \{\s+if \(!isTrustedUserEvent\(event\)\)/s,
  );
  assert.equal(
    (contentScript.match(/if \(!isTrustedUserEvent\(event\)\)/g) || []).length >= 4,
    true,
  );
});

test("panel text can be selected by hand while the toolbar keeps the page selection", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const contentStyles = readFileSync(join(ROOT, "src/content.css"), "utf8");

  assert.match(
    contentScript,
    /if \(!isSelectableTarget\(event\.target\)\) \{\s+event\.preventDefault\(\);/s,
  );
  assert.match(
    contentScript,
    /async function updateSelectionFromPage[\s\S]{0,220}isSelectionInsideUi\(window\.getSelection\(\)\)/,
  );
  assert.match(contentStyles, /\.stx-panel-text \{[^}]*cursor: text;/);
  assert.match(contentStyles, /\.stx-panel-text \{[^}]*user-select: text;/);
});

test("copying falls back to a textarea and reports a failure", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /async function copyText\(text: unknown\): Promise<boolean>/,
  );
  assert.match(
    contentScript,
    /await navigator\.clipboard\.writeText\(value\);\s+return true;\s+\} catch \{/s,
  );
  assert.match(contentScript, /return copyThroughTextarea\(value\);/);
  assert.match(contentScript, /copied = document\.execCommand\("copy"\);/);
  assert.match(contentScript, /Ctrl\+C/);
});

test("panel surface follows the opacity setting and blurs only when translucent", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const contentStyles = readFileSync(join(ROOT, "src/content.css"), "utf8");

  assert.match(contentScript, /function applyAppearance/);
  assert.match(contentScript, /setProperty\("--stx-alpha", String\(opacity \/ 100\)\)/);
  assert.match(contentScript, /dataset\.translucent = String\(opacity < 100\)/);
  assert.match(contentStyles, /--stx-surface: rgb\(255 255 255 \/ var\(--stx-alpha\)\)/);
  assert.match(
    contentStyles,
    /\[data-translucent="true"\][\s\S]{0,200}backdrop-filter: blur/,
  );
});

test("panel shows a skeleton while translating and respects reduced motion", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const contentStyles = readFileSync(join(ROOT, "src/content.css"), "utf8");

  assert.equal(contentScript.includes('class="stx-skeleton"'), true);
  assert.match(contentStyles, /\[data-state="loading"\] \.stx-skeleton \{/);
  assert.match(contentStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("selection text is normalized before it reaches the provider", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /const text = normalizeSelectionText\(forcedText \|\| selection\?\.toString\(\)\);/,
  );
});

/** Source of a named function in the content script, found by balancing braces. */
function getFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} not found`);

  const open = source.indexOf("{", start + signature.length);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, index + 1);
      }
    }
  }

  assert.fail(`${signature} has unbalanced braces`);
}

test("dismissing the panel invalidates the translation still in flight", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const body = getFunctionBody(contentScript, "function hidePanel(");

  assert.match(body, /activeTranslationRequestId(\+\+| \+= 1)/);
});

test("openTranslationPanel reports success only after a current, successful translation", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const body = getFunctionBody(contentScript, "async function openTranslationPanel(");
  const successReturn = body.indexOf("return true;");

  assert.equal(body.indexOf("return true;", successReturn + 1), -1);
  assert.match(body, /setPanelState\("ready"[^;]*;\s+return true;/);
  assert.ok(body.indexOf("requestId !== activeTranslationRequestId") < successReturn);
});

test("translate-and-copy goes through the guarded flow, and panel copy has one entry point", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");

  assert.match(
    contentScript,
    /await translateAndCopy\(\{\s+translate: \(\) => openTranslationPanel\(\)/,
  );
  assert.match(contentScript, /hasFocus: \(\) => document\.hasFocus\(\)/);
  assert.match(
    contentScript,
    /function handlePanelCopyClick\(event: Event\) \{\s+if \(!isTrustedUserEvent\(event\)\)/s,
  );
  assert.equal((contentScript.match(/void copyTranslation\(\)/g) || []).length, 1);
});

test("flashes restore the resting state instead of reading back what they overwrote", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const panelFlash = getFunctionBody(contentScript, "function flashPanel(");
  const toolbarFlash = getFunctionBody(contentScript, "function flashToolbar(");
  const textRead = /\.textContent(?!\s*=[^=])/;

  assert.equal(textRead.test(panelFlash), false);
  assert.equal(textRead.test(toolbarFlash), false);
  assert.match(panelFlash, /= panelNote;/);
  assert.match(toolbarFlash, /= TRANSLATE_LABEL;/);
});

test("a new resting note or panel state cancels a pending flash", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const setNote = getFunctionBody(contentScript, "function setPanelNote(");
  const setState = getFunctionBody(contentScript, "function setPanelState(");

  assert.match(setNote, /clearTimeout\(panelFlashTimer\);/);
  assert.match(setNote, /panelNote = note;/);
  assert.match(setState, /setPanelNote\(/);
});

test("every copy attempt from the panel clears the not-copied hint", () => {
  const contentScript = readFileSync(join(ROOT, "src/content.ts"), "utf8");
  const clearHint = getFunctionBody(contentScript, "function clearCopyHint(");

  assert.match(clearHint, /setPanelNote\(resultNote\);/);
  assert.match(contentScript, /case "copied":\s+clearCopyHint\(\);/);
  assert.match(contentScript, /case "failed":\s+clearCopyHint\(\);/);
});
