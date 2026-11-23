import type { Metadata } from "next";
import { Geist, Noto_Naskh_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { isRtl } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Arabic-script font used for Urdu and Pashto.
const arabicFont = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: { default: `${siteConfig.name} — ${siteConfig.tagline}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The language comes from a cookie. Urdu/Pashto switch the page to right-to-left.
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${arabicFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
