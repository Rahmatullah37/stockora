import { Store } from "lucide-react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { siteConfig } from "@/config/site";

/** Shared look for login, register and password pages: centered card on a light-gray page. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" aria-hidden />
          </span>
          <span className="text-lg">{siteConfig.name}</span>
        </div>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        {siteConfig.tagline}
      </footer>
    </div>
  );
}
