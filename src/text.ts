/**
 * Text picked from a page carries its layout: table pipes, list bullets,
 * soft hyphens and line breaks from a narrow column. Both the provider and
 * the panel read better without them.
 */

const LEADING_MARKERS = /^[\s ]*(?:[|•·‣▪◦*>»]+|[-–—](?=[\s ]))[\s ]*/;
const TRAILING_MARKERS = /[\s ]*[|•·‣▪◦*«»]+[\s ]*$/;
const INLINE_SPACES = /[^\S\n]+/g;
const SOFT_HYPHEN = /­/g;
const HYPHEN_LINE_BREAK = /(\p{Ll})-\n(\p{Ll})/gu;
const BLANK_LINES = /\n{3,}/g;

export function normalizeSelectionText(raw: unknown): string {
  return String(raw ?? "")
    .replace(SOFT_HYPHEN, "")
    .replace(/\r\n?/g, "\n")
    .replace(INLINE_SPACES, " ")
    // A word split across two lines by hyphenation is one word again.
    .replace(HYPHEN_LINE_BREAK, "$1$2")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(BLANK_LINES, "\n\n")
    .replace(LEADING_MARKERS, "")
    .replace(TRAILING_MARKERS, "")
    .trim();
}
