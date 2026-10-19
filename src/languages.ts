import type { MessageKey, Translate } from "./i18n.js";

/** Languages offered as translation targets, in the order the selects list them. */
export const TARGET_LANGUAGES = ["ru", "en", "de", "fr", "es", "it", "tr", "uk"] as const;

export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

/** Typed as `MessageKey`, so a target language without a catalog name fails typecheck. */
export function getLanguageNameKey(code: TargetLanguage): MessageKey {
  return `language.${code}`;
}

function isTargetLanguage(code: string): code is TargetLanguage {
  return (TARGET_LANGUAGES as readonly string[]).includes(code);
}

/** A code typed by hand may be outside the list, and then it is shown as is. */
export function getLanguageName(code: string, t: Translate): string {
  return isTargetLanguage(code) ? t(getLanguageNameKey(code)) : code;
}
