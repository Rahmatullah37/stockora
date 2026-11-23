import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShopProfileForm } from "@/features/settings/components/shop-profile-form";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import type { BusinessCategoryKey } from "@/config/business-categories";

export const metadata: Metadata = { title: "Shop profile" };

export default async function ShopProfilePage() {
  const ctx = await getAppContext();
  if (!ctx?.membership) redirect("/dashboard");
  const t = await getT();
  const { shop, permissions } = ctx.membership;

  // Only people with "settings.manage" (the shop owner) can edit; others see it read-only.
  // This is just the user-friendly side — the server action and database enforce it for real.
  const canEdit = hasPermission(permissions, PERMISSIONS.settingsManage);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.shop.title")}</CardTitle>
        <CardDescription>{t("settings.shop.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ShopProfileForm
          canEdit={canEdit}
          defaultValues={{
            name: shop.name,
            email: shop.email ?? "",
            phone: shop.phone ?? "",
            address: shop.address ?? "",
            businessCategory: shop.business_category as BusinessCategoryKey,
          }}
        />
      </CardContent>
    </Card>
  );
}
