import type { Settings } from "./settings.js";

export type GoogleRequest = {
  url: string;
  body: string;
  headers: Record<string, string>;
};

export type GoogleRoute = {
  id: string;
  origin: string;
  build(text: string, settings: Settings): GoogleRequest;
};

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded;charset=UTF-8";

/**
 * Routes are ordered by observed availability: the Chrome dictionary endpoint
 * still answers from addresses where the widget endpoint already replies 429.
 */
const ROUTE_DEFINITIONS: ReadonlyArray<{
  id: string;
  endpoint: string;
  params: Record<string, string>;
}> = [
  {
    id: "dict-chrome-ex",
    endpoint: "https://clients5.google.com/translate_a/single",
    params: { client: "dict-chrome-ex", dj: "1", dt: "t" },
  },
  {
    id: "gtx-bubble",
    endpoint: "https://translate.googleapis.com/translate_a/single",
    params: { client: "gtx", dj: "1", dt: "t", source: "bubble" },
  },
  {
    id: "dict-chrome-ex-plain",
    endpoint: "https://clients5.google.com/translate_a/t",
    params: { client: "dict-chrome-ex" },
  },
];

export function getSourceLanguage(settings: Settings): string {
  return settings.autoDetectSource ? "auto" : settings.sourceLanguage || "auto";
}

/**
 * A browser always announces its language preferences, so the request looks
 * less synthetic when the header matches the language the user asked for.
 */
export function buildAcceptLanguage(targetLanguage: string): string {
  const primary = (targetLanguage || "en").toLowerCase().split("-")[0] || "en";

  if (primary === "en") {
    return "en-US,en;q=0.9";
  }

  return `${primary},${primary}-${primary.toUpperCase()};q=0.9,en;q=0.8`;
}

export const GOOGLE_ROUTES: ReadonlyArray<GoogleRoute> = ROUTE_DEFINITIONS.map(
  ({ id, endpoint, params }) => ({
    id,
    origin: new URL(endpoint).origin,
    build(text: string, settings: Settings): GoogleRequest {
      const query = new URLSearchParams({
        ...params,
        sl: getSourceLanguage(settings),
        tl: settings.targetLanguage,
        hl: settings.targetLanguage,
        ie: "UTF-8",
        oe: "UTF-8",
      });

      return {
        url: `${endpoint}?${query.toString()}`,
        // The text travels in the body: a GET URL longer than ~10 KB is
        // rejected with 400, and non-latin text hits that at ~2500 characters.
        body: new URLSearchParams({ q: text }).toString(),
        headers: {
          "Content-Type": FORM_CONTENT_TYPE,
          Accept: "*/*",
          "Accept-Language": buildAcceptLanguage(settings.targetLanguage),
        },
      };
    },
  }),
);

export const GOOGLE_ORIGINS: ReadonlyArray<string> = [
  ...new Set(GOOGLE_ROUTES.map((route) => route.origin)),
];

function joinStrings(values: unknown[]): string {
  return values
    .map((value) => (typeof value === "string" ? value : ""))
    .join("");
}

/** `dj=1` answers with `{ sentences: [{ trans }] }`. */
function parseSentences(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const sentences = (payload as { sentences?: unknown }).sentences;

  if (!Array.isArray(sentences)) {
    return "";
  }

  return joinStrings(
    sentences.map((sentence) =>
      typeof sentence === "object" && sentence !== null
        ? (sentence as { trans?: unknown }).trans
        : "",
    ),
  );
}

/** The classic answer is `[[["перевод", "original", …], …], …]`. */
function parseNestedArray(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return "";
  }

  return joinStrings(
    payload[0].map((part: unknown) => (Array.isArray(part) ? part[0] : "")),
  );
}

/** `translate_a/t` answers with `[["перевод", "en"]]`. */
function parseFlatArray(payload: unknown): string {
  if (!Array.isArray(payload)) {
    return "";
  }

  return joinStrings(
    payload.map((part: unknown) =>
      Array.isArray(part) ? part[0] : typeof part === "string" ? part : "",
    ),
  );
}

export function parseGoogleResponse(payload: unknown): string {
  return (
    parseSentences(payload) ||
    parseNestedArray(payload) ||
    parseFlatArray(payload)
  );
}
