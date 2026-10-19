import { en, type MessageKey, type Messages } from "./locales/en.js";
import { es } from "./locales/es.js";
import { ru } from "./locales/ru.js";

export type { MessageKey, Messages };

export const UI_LOCALES = ["en", "ru", "es"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

/** "auto" follows the browser, any other value is the user's explicit choice. */
export type UiLanguagePreference = "auto" | UiLocale;

/** Used whenever the browser language is not one the extension speaks. */
export const DEFAULT_LOCALE: UiLocale = "en";

const CATALOGS: Readonly<Record<UiLocale, Messages>> = { en, ru, es };

export type MessageParams = Readonly<Record<string, string | number>>;

export type Translate = (key: MessageKey, params?: MessageParams) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}

export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === "string" && Object.hasOwn(en, value);
}

/** The supported locale of a BCP 47 tag, by its primary subtag: "es-419" is "es". */
export function matchUiLocale(languageTag: unknown): UiLocale | null {
  if (typeof languageTag !== "string") {
    return null;
  }

  const primary = languageTag.trim().toLowerCase().split(/[-_]/)[0];
  return isUiLocale(primary) ? primary : null;
}

/** A stored or typed preference; anything unknown means "auto". */
export function parseUiLanguagePreference(value: unknown): UiLanguagePreference {
  return value === "auto" || isUiLocale(value) ? value : "auto";
}

export function resolveUiLocale(
  preference: UiLanguagePreference,
  browserLanguage: unknown,
): UiLocale {
  if (preference !== "auto") {
    return preference;
  }

  return matchUiLocale(browserLanguage) ?? DEFAULT_LOCALE;
}

/**
 * The browser UI language, which follows the system unless the user changed
 * it. Only this one counts: the list of accepted page languages often carries
 * a language the user reads but does not want the interface in.
 */
export function getBrowserLanguage(): string {
  try {
    const uiLanguage = globalThis.chrome?.i18n?.getUILanguage?.();

    if (uiLanguage) {
      return uiLanguage;
    }
  } catch {
    // Outside an extension context the API may be missing or throw.
  }

  return globalThis.navigator?.language ?? "";
}

/** The locale to show for a preference in the current browser. */
export function getUiLocale(preference: UiLanguagePreference): UiLocale {
  return resolveUiLocale(preference, getBrowserLanguage());
}

export function createTranslator(locale: UiLocale): Translate {
  const messages = CATALOGS[locale];

  return (key, params) => {
    const template = messages[key] || en[key] || key;

    if (!params) {
      return template;
    }

    return template.replace(PLACEHOLDER, (placeholder, name: string) => {
      const value = params[name];
      return value === undefined ? placeholder : String(value);
    });
  };
}

export function getMessages(locale: UiLocale): Messages {
  return CATALOGS[locale];
}
