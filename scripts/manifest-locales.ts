import { getMessages, UI_LOCALES, type UiLocale } from "../src/i18n.js";

/**
 * Chrome localizes `manifest.json` only through `_locales/<locale>/messages.json`,
 * by the browser UI language. The build writes those files from the same
 * catalogs as the rest of the UI, so the texts live in one place.
 */

type ChromeMessages = Record<string, { message: string }>;

export function getManifestMessages(locale: UiLocale): ChromeMessages {
  const messages = getMessages(locale);

  return {
    extName: { message: messages["app.name"] },
    extDescription: { message: messages["manifest.description"] },
  };
}

export function getManifestLocaleFiles(): Array<{ path: string; content: string }> {
  return UI_LOCALES.map((locale) => ({
    path: `_locales/${locale}/messages.json`,
    content: `${JSON.stringify(getManifestMessages(locale), null, 2)}\n`,
  }));
}
