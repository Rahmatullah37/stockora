"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

const TABS: { href: string; labelKey: MessageKey }[] = [
  { href: "/settings", labelKey: "settings.tab.shop" },
  { href: "/settings/regional", labelKey: "settings.tab.regional" },
  { href: "/settings/account", labelKey: "settings.tab.account" },
];

/** Links between the three Settings pages. Scrolls sideways on small phones. */
export function SettingsTabs() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
