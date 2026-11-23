import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DATE_FORMATS } from "@/config/regional";
import { RegionalSettingsForm } from "@/features/settings/components/regional-settings-form";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Regional & tax" };

export default async function RegionalSettingsPage() {
  const ctx = await getAppContext();
  if (!ctx?.membership) redirect("/dashboard");
  const t = await getT();
  const { shop, settings, permissions } = ctx.membership;
  const canEdit = hasPermission(permissions, PERMISSIONS.settingsManage);

  // Fall back to the database defaults if a value is somehow missing.
  const dateFormat = DATE_FORMATS.find((f) => f === settings?.date_format) ?? "dd/MM/yyyy";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.regional.title")}</CardTitle>
        <CardDescription>{t("settings.regional.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegionalSettingsForm
          canEdit={canEdit}
          defaultValues={{
            country: shop.country,
            currency: shop.currency,
            timezone: settings?.timezone ?? "UTC",
            dateFormat,
            language: settings?.language ?? "en",
            taxEnabled: settings?.tax_enabled ?? false,
            taxName: settings?.tax_name ?? "Tax",
            taxRate: Number(settings?.tax_rate ?? 0),
          }}
        />
      </CardContent>
    </Card>
  );
}
