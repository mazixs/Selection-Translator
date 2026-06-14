# Selection Translator Extension Design

## Goal

Build a Chrome-compatible browser extension that behaves like a lightweight Yandex-style translation helper: when the user selects text on a page, the extension shows a compact floating action menu near the selection with translation and copy actions. Clicking translate opens a small scrollable translation window on the page.

The extension should also work in Yandex Browser if it supports the same Chromium extension APIs.

## User Experience

1. User selects text on any normal web page.
2. A compact floating menu appears near the selected text.
3. The menu includes:
   - extension icon;
   - `Перевести`;
   - copy selected text button;
   - copy translation button when a translation is available;
   - settings button;
   - close button.
4. Clicking `Перевести` opens a floating translation panel near the selection.
5. The translation panel includes:
   - target language selector, default `Русский`;
   - translated text area with internal scrolling for long text;
   - `Скопировать перевод`;
   - close button;
   - loading and error states.
6. The panel remains readable for long selections and does not cover the selected text more than necessary.

## Chrome API Constraints

Native browser context menus added through `chrome.contextMenus` can contain extension menu items and submenus, but they cannot contain arbitrary HTML or a custom translation card. Hover events for native menu items are not exposed to extensions.

Because of that, the Yandex-like visual behavior will be implemented as an in-page floating UI injected by a content script. Native right-click menu support can be added as a secondary entry point, but the primary experience is the selection toolbar.

## Extension Architecture

- `manifest.json`: Manifest V3 extension definition, permissions, content scripts, background service worker, options page.
- `src/content.js`: detects text selection, positions the floating menu, opens/closes the translation panel, sends translation requests, copies text.
- `src/content.css`: isolated styling for the floating menu and panel.
- `src/background.js`: handles extension lifecycle, context menu entries, and translation requests if a background fetch is needed.
- `options/options.html`, `options/options.css`, `options/options.js`: settings screen.
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js`: quick access popup with the same main settings and status.

## Translation Behavior

For the first version, use a configurable translation provider:

- Default provider: public LibreTranslate-compatible endpoint when configured.
- Fallback demo provider: returns a clear message asking the user to configure an API endpoint if no endpoint is set.
- Settings allow the user to set endpoint URL, API key, source language auto-detection, and target language.

This avoids pretending that a paid service is available without credentials while keeping the extension ready for a real provider.

## Settings

Settings saved with `chrome.storage.sync`:

- target language, default `ru`;
- provider endpoint;
- optional API key;
- auto-detect source language, default enabled;
- show selection toolbar, default enabled;
- keep translation panel open after selection changes, default disabled;
- maximum selected characters to translate, default `5000`.

## Error Handling

- Empty selection: hide toolbar.
- Unsupported pages such as browser internal pages: extension UI is not injected.
- Missing provider endpoint: show setup message in the panel.
- Network/API failure: show a concise error and keep the selected text available to copy.
- Too much text: show a warning and trim according to the configured maximum.

## Verification

- Load the unpacked extension in Chromium-based browser.
- Select short text and confirm the floating menu appears.
- Click `Перевести` and confirm the scrollable panel opens.
- Copy selected text and copied translation from the UI.
- Open settings and save target language/provider options.
- Confirm native context menu entries appear for selected text.
