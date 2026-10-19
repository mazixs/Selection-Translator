# Selection Translator

**English** | [Русский](README.ru.md)

Selection Translator is a compact extension for Chromium browsers that translates selected text right on the page. Select a fragment and press `Translate` or `Copy`: the result shows up in a neat floating panel, without going to a separate site.

<p align="center">
  <img src="docs/images/selection-toolbar.png" alt="The Selection Translator floating toolbar" width="410">
</p>

The project is a Manifest V3 extension and works in Chrome, Yandex Browser and other Chromium browsers that support the extension APIs it needs.

## Features

- A floating action toolbar next to the selected text.
- Translation in a small window that scrolls for long fragments.
- Copying the source text and the finished translation, including translate-and-copy with one `⇄` button. It copies only a translation that arrived for the current selection. If the translation window was closed before the reply came, the clipboard stays as it was. If the tab lost focus meanwhile, the translation is not copied either, and the window suggests pressing `⧉`.
- The browser's native context menu for selected text.
- Settings for the provider, the target language, the character limit and the panel behavior.
- Google web, Yandex Cloud Translate and a LibreTranslate-compatible endpoint.
- Resilience to Google's access limits: a chain of addresses, a cache, pauses and a switch to a second provider.
- Adjustable panel opacity with a blurred background.
- An interface in English, Russian and Spanish.

## Interface language

The panel, the context menu, the popup and the settings page speak English, Russian and Spanish.

- By default the language follows the browser interface language, which usually matches the system one.
- If the browser speaks another language, for example German or Chinese, the extension uses English.
- The language can be set by hand under **Settings → Interface → Interface language**. The choice applies at once to the settings page and to the panels on open tabs.

The extension name and description in `chrome://extensions` and in the store are localized by Chrome itself, always by the browser language.

## Workflow

1. Select text on any regular web page.
2. Press `Translate` on the floating toolbar.
3. Read the translation in the small window next to the selection.
4. Copy the source text or the translation with one button.
5. If needed, change the provider and the language in the extension settings.

## Development setup

1. Clone the repository.
2. Install the dependencies: `npm ci`.
3. Build the extension: `npm run build`.
4. Open `chrome://extensions` in the browser.
5. Turn on developer mode.
6. Press `Load unpacked`.
7. Pick the `dist/` folder.

After changes to the TypeScript code or `manifest.json`, run `npm run build` and reload the extension on the extensions page.

## Commands

| Command | What it does |
| --- | --- |
| `npm run lint` | Checks the code with Biome: linter, formatting and import order |
| `npm run lint:fix` | Formats the code and applies Biome's safe fixes |
| `npm run typecheck` | Checks TypeScript in strict mode without writing files |
| `npm test` | Runs the tests with the built-in Node.js test runner and `tsx` |
| `npm run build` | Builds the working Manifest V3 extension into `dist/` |
| `npm run verify` | Runs lint, typecheck, tests and build |
| `npm run release-notes -- 1.4.0` | Prints a version's section of `CHANGELOG.md`: this is how CD gets the GitHub Release text |
| `npm run pack` | Builds the extension and packs `dist/` into a zip archive in `outputs/` |
| `npm run zip` | Packs an already built `dist/` without rebuilding, as CI does |

The finished archive appears here:

```text
outputs/selection-translator-extension.zip
```

The `dist/` and `outputs/` folders are not versioned.

## Translations

The texts live in `src/locales/`: `en.ts` is the reference catalog, `ru.ts` and `es.ts` follow its keys. TypeScript fails the build when a catalog misses a key or has an extra one, and the tests check that every text is filled and keeps the same `{placeholders}`.

- Pages and the panel refer to texts by key: `data-i18n` fills the text of an element, `data-i18n-title`, `data-i18n-aria-label` and `data-i18n-placeholder` fill the attribute.
- Code gets texts through `t("key")` from `createTranslator()` in `src/i18n.ts`.
- The background returns translation errors as codes, and the interface words them in its own language (`src/translation-messages.ts`).
- The build writes `_locales/<locale>/messages.json` for the manifest from the same catalogs.

To add a language, create a catalog in `src/locales/`, register it in `UI_LOCALES` and `CATALOGS` in `src/i18n.ts`, and run `npm run verify`.

## CI/CD

Checks and the release are described by one GitHub Actions workflow: `.github/workflows/ci.yml`. The Node.js version comes from `.nvmrc`, currently 24 LTS. The extension is built once, and the finished archive is passed along the workflow.

### CI

CI runs on pull requests, pushes to `main`, pushes of a version tag and by hand. The `Verify extension` job:

- installs the dependencies with `npm ci`, reusing the npm cache between runs until `package-lock.json` changes;
- runs lint, typecheck, tests and build as separate steps, so the log shows right away which check failed;
- packs the built `dist/` into a zip without building again;
- keeps the archive as a run artifact for 14 days: it can be downloaded and installed without building the extension locally.

### CD

CD runs only when a version git tag is pushed, for example `v1.0.0` or `v1.0`.

On a tag the `Verify extension` job also:

- turns a short tag like `v1.0` into the version `1.0.0`;
- checks the tag version against `version` in `package.json` and `manifest.json`, before installing the dependencies;
- takes the release text from this version's section in `CHANGELOG.md`.

Then the `Publish release` job downloads the artifact and publishes a GitHub Release. It builds nothing again, so the release gets exactly the archive that passed the checks. Only this job can write to the repository.

Before a release, add a `## X.Y.Z - YYYY-MM-DD` section for the new version to `CHANGELOG.md`: its text becomes the GitHub Release description. The tests check that such a section exists for the version in `package.json`, and that the versions in `package.json`, `package-lock.json` and `manifest.json` match.

A release example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

If the tag number does not match the versions in `package.json` and `manifest.json`, or `CHANGELOG.md` has no section for this version or it is empty, the release stops.

## Project structure

| Path | Purpose |
| --- | --- |
| `CHANGELOG.md` | The change log by version, the source of the GitHub Release text |
| `manifest.json` | The Manifest V3 configuration, points to the JS files in the built `dist/` |
| `src/` | TypeScript code of the content script, the background service worker, the settings and the translators |
| `src/locales/` | Interface texts in English, Russian and Spanish |
| `popup/` | The extension popup: HTML/CSS and a TypeScript entry point |
| `options/` | The settings page: HTML/CSS and a TypeScript entry point |
| `assets/` | Extension icons: SVG sources and PNGs rendered from them. Only files the extension loads go into the build |
| `scripts/` | Building the TypeScript sources into a working `dist/`, the list of assets it includes, the manifest `_locales`, and extracting the release text from `CHANGELOG.md` |
| `tests/` | Tests of the manifest, the build contents, the UI scripts, the translations, the settings and the translators |
| `docs/` | README screenshots and design specifications |
| `.github/workflows/` | The GitHub Actions workflow: checks, build and release publishing |
| `.nvmrc` | The Node.js version for development and CI |

## Translation providers

The extension works with several providers:

- Google web;
- Yandex Cloud Translate;
- a LibreTranslate-compatible endpoint.

For providers that need keys or their own endpoint, the values are set in the extension settings and are not stored in the repository.

## Google provider resilience

Google web works without a key, so access is limited per IP address, and Google answers 429 with a "Sorry... automated queries" page. To keep translation working, the extension:

- sends the request along a chain of three Google addresses, starting with `clients5.google.com` and the `dict-chrome-ex` client, which answers even where `translate.googleapis.com` already returns 429;
- sends the text in the body of a POST request, not in the URL: Google rejects a long GET address with error 400 from about 2500 Cyrillic characters;
- spaces requests out in time with jitter, and pauses after a 429 instead of hammering the address again;
- caches translations for 30 minutes and merges identical parallel requests into one;
- when Google limits access and the settings have a Yandex Cloud key or your own endpoint, sends the translation there automatically. This is turned off with the "Translate with a second provider when Google limits access" switch.

The extension does not replace the `User-Agent` and `Referer` headers: `fetch` forbids it, and `declarativeNetRequest` would need extra permissions.

## Appearance

The translation panel and the settings page are designed for the task: the translation reads first, and the rest stays out of the way.

- The translation is set at 15 pixels with a 1.55 line height, and the selection from the page is cleaned of table pipes, list markers, soft hyphens and line breaks;
- while the request runs, the panel shows a three-line skeleton instead of a lone caption, and it also keeps the panel from jumping when the reply arrives;
- buttons have pressed and keyboard focus states, and the panel opens with a short 170 ms appearance that `prefers-reduced-motion` turns off;
- the panel opacity is adjustable from 25 to 100 percent, 75 by default. Only the background shows through: text, borders and shadows stay opaque, and the page under the panel is blurred, so the translation reads well even on a busy site. At 100 percent the blur is off completely, an option for computers without hardware graphics acceleration. The load measurement and the sources behind the decision are in the [specification](docs/specs/2026-10-19-panel-translucency-design.md).

The settings page has five sections with descriptions, the provider fields are shown only for the chosen service, and the source language appears when auto-detection is off. The Save button is active only when there are unsaved changes, and the action bar is pinned to the bottom of the window. The opacity slider comes with a live preview of the panel over a page mockup.

## Upgrading to 1.5.0

Version 1.5.0 makes the interface available in English, Russian and Spanish. By default it follows the browser language, and any other language gets English. If your browser is not in Russian and you want the Russian interface back, choose it in **Settings → Interface → Interface language**. Translation errors now also name the provider that failed. The permissions do not change. See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

## Upgrading to 1.4.0

Version 1.4.0 changes the `⇄` button on the action toolbar: now it translates the selected text and copies the translation with one press. The translation is copied only if the window is still open and the tab is in focus, otherwise the window suggests pressing `⧉`.

The default panel opacity is now 75 %, and the slider in the settings goes from 25 to 100 %. If you saved the settings before or changed the language in the translation window, the previous value stays: in 1.3.0 it was 100 %, that is, no blur. If the panel stayed opaque, move the opacity slider on the settings page; 100 % turns the background blur off. The extension icons are updated too. See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

## Upgrading to 1.3.0

Version 1.3.0 adds the panel opacity setting, the redesigned translation panel and settings page, and the cleanup of the selected text before translation.

## Upgrading to 1.2.0

Version 1.2.0 moves the Google provider to a chain of addresses and POST requests, and adds a cache, pauses after 429 and an automatic switch to a second provider. `https://clients5.google.com/*` is added to `host_permissions`, so Chrome asks to confirm the updated permissions.

## Upgrading to 1.1.1

Version 1.1.1 removes the experimental Yandex web provider, because it needed network header rewriting. Yandex Cloud Translate stays available as the main Yandex provider.

If a shared API key was saved before, the extension moves it to the key of the active provider: Yandex Cloud or LibreTranslate. After the settings are saved, the old shared key field is removed from storage.

Third-party service names are used only to choose a translation provider. The extension icons and design are the project's own assets.

## License

Apache-2.0. See [LICENSE](LICENSE) for details.
