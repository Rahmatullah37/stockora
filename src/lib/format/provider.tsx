"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createFormatter, type FormatSettings, type Formatter } from "./index";

const FormatContext = createContext<Formatter | null>(null);

/** Gives Client Components the shop's money/date formatting: `const { money } = useFormat()`. */
export function FormatProvider({ settings, children }: { settings: FormatSettings; children: ReactNode }) {
  const formatter = useMemo(
    () => createFormatter(settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.currency, settings.dateFormat, settings.locale, settings.timezone],
  );
  return <FormatContext value={formatter}>{children}</FormatContext>;
}

export function useFormat(): Formatter {
  const value = useContext(FormatContext);
  if (!value) throw new Error("useFormat must be used inside <FormatProvider>.");
  return value;
}
