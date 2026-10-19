import { isMessageKey, type MessageKey, type Translate } from "./i18n.js";
import type {
  TranslationErrorCode,
  TranslationFailure,
  TranslationSuccess,
} from "./translator.js";

/**
 * Words translation results for the user in the UI language. The background
 * returns codes only: each code has its own catalog key `error.<code>`, and
 * the details fill the placeholders. The reply crosses a message boundary, so
 * an unexpected code still gets a generic text instead of nothing.
 */

/** Typed as `MessageKey`, so a code without a catalog text fails typecheck. */
function getFailureMessageKey(code: TranslationErrorCode): MessageKey {
  return `error.${code}`;
}

function getProviderName(provider: unknown, t: Translate): string {
  const key = `provider.${String(provider)}`;
  return t(isMessageKey(key) ? key : "provider.unknown");
}

export function formatCooldown(remainingMs: number, t: Translate): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));

  if (seconds < 60) {
    return t("time.seconds", { count: seconds });
  }

  return t("time.minutes", { count: Math.ceil(seconds / 60) });
}

export function describeTranslationFailure(
  failure: TranslationFailure,
  t: Translate,
): string {
  const key = getFailureMessageKey(failure.code);

  // The code came over the message channel, so check it at runtime as well.
  if (!isMessageKey(key)) {
    return t("error.unknown");
  }

  return t(key, {
    provider: getProviderName(failure.provider, t),
    status: failure.status ?? "?",
    time: formatCooldown(failure.retryAfterMs ?? 0, t),
  });
}

/** What the panel says under a successful translation, or an empty string. */
export function describeTranslationNote(
  success: TranslationSuccess,
  t: Translate,
): string {
  const notes = [
    success.fallbackFrom
      ? t(
          success.fallbackFrom === "rate_limited"
            ? "note.fallbackRateLimited"
            : "note.fallback",
          { provider: getProviderName(success.provider, t) },
        )
      : "",
    success.wasTrimmed ? t("panel.trimmed") : "",
  ];

  return notes.filter(Boolean).join(" ");
}
