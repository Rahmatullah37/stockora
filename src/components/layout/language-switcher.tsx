"use client";

import { Languages } from "lucide-react";
import { useTransition } from "react";
import { localeNames, locales, type Locale } from "@/lib/i18n/config";
import { setLocaleAction } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/provider";

/** Dropdown to switch between English, Urdu and Pashto. */
export function LanguageSwitcher() {
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) =>
          startTransition(() => setLocaleAction(event.target.value as Locale))
        }
        className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
