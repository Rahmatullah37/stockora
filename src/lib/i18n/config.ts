/**
 * Language configuration.
 *
 * How translations work in Stockora:
 *   - Every piece of visible text has a KEY (like "nav.dashboard").
 *   - The text for each language lives in src/lib/i18n/messages/<lang>.ts
 *   - English (en.ts) is the master list. If a key is missing in Urdu or
 *     Pashto, the English text is shown instead — nothing ever breaks.
 *
 * To add a language: add its code here, create messages/<code>.ts, and register
 * it in src/lib/i18n/index.ts.
 */
export const locales = ["en", "ur", "ps"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Names shown in the language picker (each in its own language). */
export const localeNames: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
  ps: "پښتو",
};

/** Urdu and Pashto are written right-to-left. */
const rtlLocales: readonly Locale[] = ["ur", "ps"];
export const isRtl = (locale: Locale) => rtlLocales.includes(locale);

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

/** Name of the cookie that remembers the chosen language. */
export const LOCALE_COOKIE = "stockora_locale";
