import { format as formatWithDateFns } from "date-fns";

/**
 * Number and date formatting that follows the SHOP's settings
 * (currency, date format, language). Use it instead of calling toFixed() or
 * toLocaleString() by hand, so every screen shows money the same way.
 */
export interface FormatSettings {
  currency: string;     // ISO 4217, e.g. "PKR"
  dateFormat: string;   // "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd"
  locale: string;       // "en" | "ur" | "ps"
  timezone: string;
}

export function createFormatter(settings: FormatSettings) {
  // Use Latin digits for every language so numbers stay easy to compare.
  const numberLocale = settings.locale === "en" ? "en-US" : `${settings.locale}-u-nu-latn`;

  const money = (value: number | string | null | undefined): string => {
    const amount = Number(value ?? 0);
    try {
      return new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: settings.currency,
        currencyDisplay: "code",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(amount) ? amount : 0);
    } catch {
      return `${settings.currency} ${amount.toFixed(2)}`;
    }
  };

  /** Quantities: up to 3 decimals, no trailing zeros. */
  const quantity = (value: number | string | null | undefined): string =>
    new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 3 }).format(Number(value ?? 0));

  const percent = (value: number | string | null | undefined): string =>
    `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(Number(value ?? 0))}%`;

  const date = (value: string | Date | null | undefined): string => {
    if (!value) return "—";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "—";
    // Show the date in the shop's own time zone.
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).format(d); // yyyy-MM-dd
      const [y, m, day] = parts.split("-").map(Number);
      return formatWithDateFns(new Date(y, m - 1, day), settings.dateFormat);
    } catch {
      return formatWithDateFns(d, settings.dateFormat);
    }
  };

  const dateTime = (value: string | Date | null | undefined): string => {
    if (!value) return "—";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "—";
    let time = "";
    try {
      time = new Intl.DateTimeFormat("en-GB", {
        timeZone: settings.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(d);
    } catch {
      time = formatWithDateFns(d, "HH:mm");
    }
    return `${date(d)} ${time}`;
  };

  return { money, quantity, percent, date, dateTime, settings };
}

export type Formatter = ReturnType<typeof createFormatter>;
