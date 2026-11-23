"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { translate, type Messages, type MessageKey } from "./index";

interface I18nValue {
  locale: Locale;
  messages: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Makes translations available to Client Components (forms, menus, ...). */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT must be used inside <I18nProvider>.");
  return value;
}

/** In a Client Component: `const t = useT(); t("common.save")` */
export function useT() {
  const { messages } = useI18n();
  return (key: MessageKey, params?: Record<string, string | number>) =>
    translate(messages, key, params);
}

export function useLocale(): Locale {
  return useI18n().locale;
}
