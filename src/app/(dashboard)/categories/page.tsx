import type { Metadata } from "next";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxonomyManager } from "@/features/products/components/taxonomy-manager";
import { getProductOptions } from "@/features/products/queries";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories & brands" };

export default async function CategoriesPage() {
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsView });
  if (gate || !ctx?.membership) return gate;
  const t = await getT();
  const supabase = await createClient();
  const { categories, brands } = await getProductOptions(supabase, ctx.membership.shop.id, false);
  const canEdit = hasPermission(ctx.membership.permissions, PERMISSIONS.productsManage);
  return (
    <>
      <PageHeader title={t("categories.title")} description={t("categories.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>{t("categories.categories")}</CardTitle></CardHeader>
          <CardContent><TaxonomyManager kind="category" items={categories} canEdit={canEdit} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("categories.brands")}</CardTitle></CardHeader>
          <CardContent><TaxonomyManager kind="brand" items={brands} canEdit={canEdit} /></CardContent></Card>
      </div>
    </>
  );
}
