import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { createFormatter } from "./index";

/** Formatter for Server Components: `const fmt = await getFormatter(ctx); fmt.money(12.5)` */
export async function getFormatter(ctx: AppContext) {
  const locale = await getLocale();
  const shop = ctx.membership?.shop;
  const settings = ctx.membership?.settings;
  return createFormatter({
    currency: shop?.currency ?? "USD",
    dateFormat: settings?.date_format ?? "dd/MM/yyyy",
    locale,
    timezone: settings?.timezone ?? "UTC",
  });
}
