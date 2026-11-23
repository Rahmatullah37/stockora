import type { Locale } from "./config";
import { en, type MessageKey } from "./messages/en";
import { ps } from "./messages/ps";
import { ur } from "./messages/ur";

export type { MessageKey };
export type Messages = Record<MessageKey, string>;

const overrides: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en: {},
  ur,
  ps,
};

/** All messages for a language. Missing translations fall back to English. */
export function getMessages(locale: Locale): Messages {
  return { ...en, ...overrides[locale] } as Messages;
}

/** Looks up a key and fills in {placeholders}. */
export function translate(
  messages: Messages,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = messages[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
