"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV_ITEM, NAV_ITEMS } from "@/config/navigation";
import { useT } from "@/lib/i18n/provider";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

/**
 * The list of menu links. Shows only the items this user's role may use.
 * `onNavigate` lets the mobile drawer close itself after a link is tapped.
 */
export function SidebarNav({
  permissions,
  features,
  isSuperAdmin,
  onNavigate,
}: {
  permissions: string[];
  features: string[];
  isSuperAdmin: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const pathname = usePathname();

  const visibleItems = [
    ...NAV_ITEMS.filter((item) => item.permission === null || hasPermission(permissions, item.permission)),
    ...(isSuperAdmin ? [{ ...ADMIN_NAV_ITEM, permission: null, ready: true, feature: undefined }] : []),
  ];

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const locked = Boolean(item.feature) && !features.includes(item.feature as string);

        // Module not built yet: show it greyed out, not clickable.
        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/70"
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              <Badge>{t("nav.soon")}</Badge>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {locked && <Badge title={t("nav.lockedHint")}>Plan</Badge>}
          </Link>
        );
      })}
    </nav>
  );
}
