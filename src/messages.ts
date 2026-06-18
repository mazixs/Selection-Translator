import type { TranslationResult } from "./translator.js";

export type ContextTranslateMessage = {
  type: "ST_CONTEXT_TRANSLATE";
  text: string;
};

export type ContextCopySelectionMessage = {
  type: "ST_CONTEXT_COPY_SELECTION";
  text: string;
};

export type TranslateMessage = {
  type: "ST_TRANSLATE";
  text: string;
};

export type GetSettingsMessage = {
  type: "ST_GET_SETTINGS";
};

export type OpenOptionsMessage = {
  type: "ST_OPEN_OPTIONS";
};

export type RuntimeMessage =
  | ContextTranslateMessage
  | ContextCopySelectionMessage
  | TranslateMessage
  | GetSettingsMessage
  | OpenOptionsMessage;

export type OpenOptionsResponse = {
  ok: true;
};

export type RuntimeResponse = TranslationResult | OpenOptionsResponse;

export function getRuntimeMessage(message: unknown): RuntimeMessage | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const record = message as Record<string, unknown>;

  if (record.type === "ST_GET_SETTINGS" || record.type === "ST_OPEN_OPTIONS") {
    return { type: record.type };
  }

  if (
    (record.type === "ST_CONTEXT_TRANSLATE" ||
      record.type === "ST_CONTEXT_COPY_SELECTION" ||
      record.type === "ST_TRANSLATE") &&
    typeof record.text === "string"
  ) {
    return {
      type: record.type,
      text: record.text,
    };
  }

  return null;
}
