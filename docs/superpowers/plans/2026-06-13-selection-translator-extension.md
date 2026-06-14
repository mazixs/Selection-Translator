# Selection Translator Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 extension with a Yandex-like floating translate/copy toolbar for selected text.

**Architecture:** A content script owns the in-page floating UI. A background service worker owns native context menu entries and translation requests. Options and popup pages read/write shared settings through `chrome.storage.sync`.

**Tech Stack:** Chrome Extensions Manifest V3, plain JavaScript modules, Node built-in test runner.

---

### Task 1: Testable Translation Core

**Files:**
- Create: `package.json`
- Create: `tests/translator.test.js`
- Create: `tests/settings.test.js`
- Create: `src/settings.js`
- Create: `src/translator.js`

- [ ] Write tests for settings merge, text length limiting, LibreTranslate URL normalization, missing provider handling, and successful translation response parsing.
- [ ] Run `npm test` and confirm tests fail because implementation files do not exist.
- [ ] Implement `src/settings.js` and `src/translator.js`.
- [ ] Run `npm test` and confirm the tests pass.

### Task 2: Extension Shell

**Files:**
- Create: `manifest.json`
- Create: `src/background.js`

- [ ] Add Manifest V3 metadata, content script registration, options page, popup, permissions, and host permissions.
- [ ] Add native selection context menu entries: `Перевод`, `Перевести`, `Скопировать`, `Настройки`.
- [ ] Route context menu clicks to the active tab content script.

### Task 3: Selection Toolbar and Translation Panel

**Files:**
- Create: `src/content.js`
- Create: `src/content.css`

- [ ] Detect selected text on mouse and keyboard selection changes.
- [ ] Show a compact floating menu with `Перевести`, `Скопировать`, settings, and close controls.
- [ ] Open a scrollable translation panel with loading, success, empty, and error states.
- [ ] Support copy selected text and copy translated text.

### Task 4: Settings and Popup UI

**Files:**
- Create: `options/options.html`
- Create: `options/options.css`
- Create: `options/options.js`
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

- [ ] Add settings for target language, provider endpoint, API key, auto-detect, toolbar visibility, panel behavior, and maximum characters.
- [ ] Add a small popup that shows setup status and opens settings.

### Task 5: Verification

**Files:**
- Use all created extension files.

- [ ] Run `npm test`.
- [ ] Parse `manifest.json` with Node to catch JSON errors.
- [ ] Check that all files referenced by the manifest exist.
- [ ] Report how to load the unpacked extension in Chrome or Yandex Browser.
