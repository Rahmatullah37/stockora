"use client";

import { LogOut, Menu, Store, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { logoutAction } from "@/features/auth/actions";
import { useT } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "./language-switcher";
import { SidebarNav } from "./sidebar-nav";

interface AppShellProps {
  shopName: string;
  userName: string;
  userEmail: string;
  roleName: string;
  permissions: string[];
  features: string[];
  isSuperAdmin: boolean;
  /** Extra controls for the top bar (e.g. the shop switcher). */
  topBarExtra?: ReactNode;
  children: ReactNode;
}

/**
 * The frame around every logged-in page:
 *   - Desktop: fixed sidebar on the left + top bar.
 *   - Mobile: top bar with a menu button that opens the sidebar as a drawer.
 */
export function AppShell({
  shopName,
  userName,
  userEmail,
  roleName,
  permissions,
  features,
  isSuperAdmin,
  topBarExtra,
  children,
}: AppShellProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const brand = (
    <div className="flex items-center gap-2 px-3 font-semibold text-primary">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="size-5" aria-hidden />
      </span>
      <span className="text-lg">{siteConfig.name}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-e border-border bg-card px-3 py-5 lg:flex">
        {brand}
        <SidebarNav permissions={permissions} features={features} isSuperAdmin={isSuperAdmin} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMenu} aria-hidden />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-card px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              {brand}
              <Button variant="ghost" size="sm" onClick={closeMenu} aria-label={t("nav.closeMenu")}>
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <SidebarNav permissions={permissions} features={features} isSuperAdmin={isSuperAdmin} onNavigate={closeMenu} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.openMenu")}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{shopName}</p>
            <Badge variant="green" className="mt-0.5">
              {roleName}
            </Badge>
          </div>

          {topBarExtra}
          <LanguageSwitcher />

          <div className="hidden text-end text-xs leading-tight sm:block">
            <p className="font-medium">{userName}</p>
            <p className="text-muted-foreground">{userEmail}</p>
          </div>

          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" aria-label={t("common.logout")}>
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </Button>
          </form>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
