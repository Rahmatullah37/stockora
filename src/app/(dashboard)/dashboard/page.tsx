import { format } from "date-fns";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUSINESS_CATEGORIES } from "@/config/business-categories";
import { findCountry } from "@/config/regional";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Dashboard" };

/** One "label: value" line inside a card. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const membership = ctx?.membership;
  // The layout already handles "not logged in" and "no shop"; this just keeps TypeScript happy.
  if (!ctx || !membership) return null;

  const t = await getT();
  const { shop, settings, subscription, role, permissions } = membership;

  const category = BUSINESS_CATEGORIES.find((c) => c.key === shop.business_category);
  const country = findCountry(shop.country);
  // Dates follow the date format the owner chose in Settings.
  const registeredOn = format(new Date(shop.created_at), settings?.date_format ?? "dd/MM/yyyy");

  const plan = subscription?.plan;
  const limit = (value: number | null | undefined) =>
    value === null || value === undefined ? t("dashboard.field.unlimited") : String(value);

  return (
    <>
      <PageHeader
        title={t("dashboard.welcome", { name: ctx.profile.full_name.split(" ")[0] })}
        description={t("dashboard.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Shop details (real data from the shops table) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.shopCard")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label={t("auth.field.shopName")} value={shop.name} />
              <Row label={t("dashboard.field.category")} value={category?.label ?? shop.business_category} />
              <Row label={t("dashboard.field.country")} value={country?.name ?? shop.country} />
              <Row label={t("dashboard.field.currency")} value={shop.currency} />
              <Row label={t("dashboard.field.address")} value={shop.address ?? "—"} />
              <Row label={t("dashboard.field.registered")} value={registeredOn} />
            </dl>
          </CardContent>
        </Card>

        {/* Subscription plan and its limits */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.planCard")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label={t("dashboard.field.plan")} value={plan?.name ?? "—"} />
              <div className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">{t("dashboard.field.status")}</dt>
                <dd>
                  <Badge variant={subscription?.status === "past_due" ? "warning" : "success"}>
                    {subscription?.status ?? "—"}
                  </Badge>
                </dd>
              </div>
              <Row label={t("dashboard.field.products")} value={limit(plan?.max_products)} />
              <Row label={t("dashboard.field.staff")} value={limit(plan?.max_employees)} />
              <Row label={t("dashboard.field.branches")} value={limit(plan?.max_branches)} />
            </dl>
          </CardContent>
        </Card>

        {/* The signed-in person's role */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.accessCard")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Row label={t("dashboard.field.role")} value={role.name} />
              <Row label={t("dashboard.field.permissions")} value={String(permissions.length)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Honest placeholder: the live business figures come with later phases. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("dashboard.nextCard")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("dashboard.nextBody")}</p>
        </CardContent>
      </Card>
    </>
  );
}
