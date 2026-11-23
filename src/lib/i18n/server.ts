import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, translate, type MessageKey } from "./index";

/** The language chosen by the visitor (from a cookie), or English. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/** Translation function for Server Components: `const t = await getT(); t("nav.dashboard")` */
export async function getT() {
  const messages = getMessages(await getLocale());
  return (key: MessageKey, params?: Record<string, string | number>) =>
    translate(messages, key, params);
}
