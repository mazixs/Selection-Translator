import {
  createTranslator,
  getUiLocale,
  isMessageKey,
  isUiLocale,
  type Translate,
  type UiLocale,
} from "./i18n.js";
import { getLanguageNameKey, TARGET_LANGUAGES } from "./languages.js";

/**
 * Markup names its texts by key instead of carrying them:
 * `data-i18n` fills the text, the other attributes fill the attribute of the
 * same name. An unknown key stays visible as the key itself.
 */
const ATTRIBUTE_BINDINGS = [
  ["data-i18n-title", "title"],
  ["data-i18n-aria-label", "aria-label"],
  ["data-i18n-placeholder", "placeholder"],
] as const;

function translateKey(key: string | null, t: Translate): string {
  return isMessageKey(key) ? t(key) : String(key);
}

/** `root` itself counts too: the panel carries its own aria-label key. */
function findAll(root: ParentNode, selector: string): Element[] {
  const found = [...root.querySelectorAll(selector)];
  return root instanceof Element && root.matches(selector) ? [root, ...found] : found;
}

export function localizeTree(root: ParentNode, t: Translate): void {
  for (const element of findAll(root, "[data-i18n]")) {
    element.textContent = translateKey(element.getAttribute("data-i18n"), t);
  }

  for (const [source, target] of ATTRIBUTE_BINDINGS) {
    for (const element of findAll(root, `[${source}]`)) {
      element.setAttribute(target, translateKey(element.getAttribute(source), t));
    }
  }
}

const REMEMBERED_LOCALE_KEY = "selection-translator:ui-locale";

/**
 * The locale an extension page can show before the settings arrive. Storage
 * reads are asynchronous, and waiting for one would leave the page without
 * texts for a moment, so the page localizes at once from the locale it showed
 * last time (or from the browser language) and corrects itself if the settings
 * say otherwise. Only extension pages use this: the copy lives in the
 * extension's own `localStorage`, and `chrome.storage` stays the source of truth.
 */
export function getInitialUiLocale(): UiLocale {
  try {
    const remembered = globalThis.localStorage?.getItem(REMEMBERED_LOCALE_KEY);

    if (isUiLocale(remembered)) {
      return remembered;
    }
  } catch {
    // Storage may be blocked; the browser language is a fine first guess.
  }

  return getUiLocale("auto");
}

/** Shows an extension page in `locale`. */
export function localizePage(locale: UiLocale): Translate {
  const t = createTranslator(locale);
  document.documentElement.lang = locale;
  localizeTree(document, t);
  return t;
}

/**
 * Remembers the locale of the saved settings for the next first render.
 * A preview of an unsaved choice must not get here.
 */
export function rememberUiLocale(locale: UiLocale): void {
  try {
    globalThis.localStorage?.setItem(REMEMBERED_LOCALE_KEY, locale);
  } catch {
    // Not remembering only costs a possible relabel on the next open.
  }
}

/** Fills a select with the target languages; `localizeTree` then names them. */
export function appendLanguageOptions(select: HTMLSelectElement): void {
  for (const code of TARGET_LANGUAGES) {
    const option = document.createElement("option");
    option.value = code;
    option.dataset.i18n = getLanguageNameKey(code);
    select.append(option);
  }
}
