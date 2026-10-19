/**
 * The toolbar button that translates and copies in one click copies only after
 * the provider answers, and that can take many seconds (pacing, 429 backoff,
 * fallback). By then the translation may be stale or dismissed, and the tab may
 * have lost focus, so the copy has to be conditional.
 */

export type CopyOutcome =
  /** There is no current translation on screen, so the clipboard is untouched. */
  | "not-ready"
  /** The document lost focus while waiting, so the clipboard is untouched. */
  | "unfocused"
  | "copied"
  | "failed";

export type TranslateCopySteps = {
  /** Resolves to true only when this request's translation is the one on screen. */
  translate: () => Promise<boolean>;
  hasFocus: () => boolean;
  copy: () => Promise<boolean>;
};

export async function translateAndCopy(steps: TranslateCopySteps): Promise<CopyOutcome> {
  if (!(await steps.translate())) {
    return "not-ready";
  }

  // Without focus the clipboard API rejects, and the textarea fallback would
  // steal focus from a page the user is not looking at. A late write could
  // also overwrite something the user copied meanwhile, so it is skipped.
  if (!steps.hasFocus()) {
    return "unfocused";
  }

  return (await steps.copy()) ? "copied" : "failed";
}
