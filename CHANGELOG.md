# Changelog

This file collects the user-visible changes of Selection Translator. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [SemVer](https://semver.org/).

A version's section becomes the GitHub Release description, so every version needs a section headed `## X.Y.Z - YYYY-MM-DD` with content. The tests and CD check this.

## Unreleased

### Added

- The interface is available in English, Russian and Spanish: the panel, the context menu, the popup and the settings page. By default it follows the browser language and falls back to English for any other language. The language can be chosen by hand in the new Interface section of the settings, and the change applies at once, including the panels on open tabs and the context menu.
- The extension name and description in the browser are localized as well.
- Translation errors name the provider that failed, for example "Google Translate returned error 503.", and the note after an automatic switch names the provider that stood in.
- The translation in the panel is marked with its own language, so screen readers, hyphenation and spell-check treat it correctly.

### Changed

- The interface language now follows the browser. If your browser is not in Russian, the extension switches to English after the update; Russian can be chosen in Settings → Interface → Interface language.
- English is now the main language of the project and its documentation. The Russian README is in `README.ru.md`.

### Fixed

- After an automatic switch to another provider, the note mentions a Google access limit only when there was one. On a Google error or a network failure it says that Google could not translate the text.
- Changing the language in the translation panel no longer writes the whole settings back, so it cannot undo a change saved on the settings page at the same moment.

### For developers

- Interface texts moved from the code to the catalogs in `src/locales/` (`en.ts`, `ru.ts`, `es.ts`). Markup refers to them with `data-i18n` attributes, code with `t("key")`.
- Translation failures carry a code and details (`provider`, `status`, `retryAfterMs`) instead of a ready message, and a successful fallback carries `fallbackFrom`, the code the main provider failed with. The UI words them in its language through `src/translation-messages.ts`.
- The build writes `_locales/<locale>/messages.json` for the manifest from the same catalogs.
- Each failure code has its own catalog key `error.<code>`, and provider names come from `provider.<id>`, so a new code without a text fails typecheck.
- The settings page and the popup put their texts in place before reading the settings, from the locale shown last time or the browser language, so they never open blank.
- When the interface language changes, the service worker rebuilds the context menu from the change itself, without reading the settings. If the settings cannot be read at install or startup, the menu is still created, in the browser language.

## 1.4.0 - 2026-10-19

### Added

- The `⇄` button on the action toolbar now translates and copies the selected text with one press. Before, it copied an already finished translation, was unavailable while there was none, and the translation panel opened over it.
- New extension icons. On the settings page the logo is no longer in a round frame, in the popup it has no rounded corners, and the icon on the toolbar above the selection has no dark backing.

### Changed

- The default panel opacity is 75 % with the page behind it blurred. The slider in the settings now goes from 25 to 100 %, and 100 % turns the blur off completely. If you never saved the settings, the panel becomes translucent by itself. If you did (on the settings page, by switching the theme, or just by changing the language in the translation window), the previous value stays: the 1.3.0 default was 100 %, that is, no blur, and any of these actions wrote it in full. If the panel stayed opaque, move the opacity slider on the settings page.
- The extension package is smaller: it contains only the icons the extension loads. The Chrome Web Store listing file and the SVG source of the 16 px icon stay in the repository.

### Fixed

- The `⇄` button copies only the translation that arrived for the currently open window:
  - if the translation window was closed before the reply came, the reply is ignored and the clipboard does not change;
  - if the tab lost focus while waiting, the translation is not copied, so that it does not overwrite what you copied meanwhile, and the window suggests pressing `⧉`.
- Short copy messages on the `Translate` button and in the translation window no longer get stuck on quick repeated presses, and a translation that arrived meanwhile keeps its note.

### For developers

- The Biome linter and formatter are part of `npm run verify`.
- Tests that read project files no longer fail on Windows.
- The cache key is built without a raw NUL byte in the source, so git shows diffs of `src/cache.ts` again.
- `package-lock.json` matches the package version. The versions in `package.json`, `manifest.json` and `package-lock.json` are now checked by a test.
- The GitHub Release text now comes from the version's section in `CHANGELOG.md`.

## 1.3.0 - 2026-08-27

Includes the changes of 1.2.0, which was not released separately.

### Added

- A panel opacity setting from 50 to 100 % with a blurred background. Only the background shows through: text, borders and shadows stay opaque.
- The settings page is split into four sections with descriptions. The provider fields are shown only for the chosen service, and the source language appears when auto-detection is off. The Save button is active when there are unsaved changes, the action bar is pinned to the bottom of the window, and the opacity slider comes with a live preview of the panel.
- Before translation, the selected text is cleaned of table pipes, list markers, soft hyphens and line breaks, and words split by hyphenation are joined back.

### Changed

- The translation panel is redesigned: the text is set at 15 pixels with a 1.55 line height, a three-line skeleton shows while the request runs instead of a lone caption, buttons have pressed and keyboard focus states, and the panel opens with a short 170 ms appearance that `prefers-reduced-motion` turns off.

### Fixed

- The translation text can be selected with the mouse. A selection inside the panel no longer counts as a selection on the page, so it does not reset the buttons or close the panel, and a page that forbids selection cannot take it away.
- If the page denied clipboard access, copying goes a fallback way, and when that fails too, the extension says what to do.

## 1.2.0 - 2026-08-27

Not released separately; the changes went into 1.3.0.

### Changed

- The Google provider withstands access limits per IP (a 429 reply with a "Sorry... automated queries" page):
  - the request goes along a chain of three Google addresses, starting with `clients5.google.com`, which answers even where `translate.googleapis.com` already returns 429;
  - the text is sent in the body of a POST request, not in the URL: Google rejected a long GET address with error 400 from about 2500 Cyrillic characters;
  - requests are spaced out in time with jitter, `Retry-After` is respected, and after a 429 a pause starts instead of repeated requests to the blocked address;
  - translations are cached for 30 minutes, and identical parallel requests are merged into one.
- The limit is reported as a separate error with a hint instead of a bare status code.

### Added

- An automatic switch to Yandex Cloud Translate or your own LibreTranslate endpoint when Google limits access and a key or an endpoint is set. It is turned off with a switch in the settings.

### Permissions

- `https://clients5.google.com/*` is added to `host_permissions`, so Chrome asks to confirm the updated permissions.

## 1.1.1 - 2026-07-03

### Removed

- The experimental Yandex web provider: it needed network header rewriting. Yandex Cloud Translate stays the main Yandex provider.
- The `declarativeNetRequestWithHostAccess` permission and access to `translate.yandex.ru` and `translate.yandex.net`: without Yandex web they are not needed. There are fewer permissions now.

### Changed

- Yandex Cloud and LibreTranslate now have separate API key fields. If a shared key was saved before, the extension moves it to the key of the active provider, and removes the old field from storage after the settings are saved.
- A LibreTranslate endpoint address with a login and password in the URL itself is rejected: only `http` and `https` without credentials are accepted.

### Security

- Clicks on the panel and language changes are handled only for real user actions, not for events created by a page script.
- The background script accepts messages only from this extension's content script.

## 1.1.0 - 2026-06-18

### Changed

- The extension is rewritten in TypeScript and built with esbuild into the `dist/` folder. Development now needs `npm ci` and `npm run build`, and the browser loads `dist/`.

## 1.0.0 - 2026-06-15

The first release.

### Added

- A floating action toolbar next to the selected text.
- Translation in a small window that scrolls for long fragments.
- Copying the source text and the finished translation.
- Browser context menu items for selected text.
- Settings for the provider, the target language, the character limit and the panel behavior, and a light and dark theme of the settings page.
- Providers: Google web, Yandex web, Yandex Cloud Translate and a LibreTranslate-compatible endpoint.
