import "server-only";
import { headers } from "next/headers";

/**
 * The public address of this website, used in email links (verify email,
 * reset password). Set NEXT_PUBLIC_SITE_URL in production; locally we fall
 * back to the address the browser used.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
