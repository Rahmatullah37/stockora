import { Ban, Store } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { StatusScreen } from "@/components/shared/status-screen";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { logoutAction } from "@/features/auth/actions";
import { getAppContext } from "@/lib/auth/session";
import { getT, getLocale } from "@/lib/i18n/server";
import { FormatProvider } from "@/lib/format/provider";
import { ShopSwitcher } from "@/features/shops/components/shop-switcher";
import { createClient } from "@/lib/supabase/server";

/**
 * Wraps every logged-in page. It checks, on the server, that:
 *   1. someone is logged in,
 *   2. they belong to a shop,
 *   3. the shop is not suspended.
 * Then it draws the sidebar + top bar around the page.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  const t = await getT();

  const logoutButton = (
    <form action={logoutAction}>
      <Button type="submit" variant="outline">
        {t("common.logout")}
      </Button>
    </form>
  );

  if (!ctx.membership) {
    // Maybe the owner invited this email: turn pending invitations into memberships.
    const supabase = await createClient();
    const { data: accepted } = await supabase.rpc("accept_pending_invitations");
    if (Number(accepted) > 0) redirect("/dashboard");
    return (
      <StatusScreen icon={Store} title={t("noShop.title")} description={t("noShop.body")}>
        {logoutButton}
      </StatusScreen>
    );
  }

  if (!ctx.membership.shop.is_active) {
    return (
      <StatusScreen icon={Ban} title={t("suspended.title")} description={t("suspended.body")}>
        {logoutButton}
      </StatusScreen>
    );
  }

  const locale = await getLocale();
  const { shop, settings } = ctx.membership;

  return (
    <FormatProvider
      settings={{
        currency: shop.currency,
        dateFormat: settings?.date_format ?? "dd/MM/yyyy",
        locale,
        timezone: settings?.timezone ?? "UTC",
      }}
    >
      <AppShell
        shopName={shop.name}
        userName={ctx.profile.full_name}
        userEmail={ctx.user.email}
        roleName={ctx.membership.role.name}
        permissions={ctx.membership.permissions}
        features={ctx.membership.features}
        isSuperAdmin={ctx.profile.is_super_admin}
        topBarExtra={ctx.shops.length > 1 ? <ShopSwitcher shops={ctx.shops} activeShopId={shop.id} /> : null}
      >
        {children}
      </AppShell>
    </FormatProvider>
  );
}
