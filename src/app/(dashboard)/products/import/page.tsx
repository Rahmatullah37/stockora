import type { Metadata } from "next";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { ImportForm } from "@/features/products/components/import-form";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsManage });
  if (gate || !ctx?.membership) return gate;
  const t = await getT();
  return (
    <>
      <PageHeader title={t("products.import.title")} description={t("products.import.subtitle")} />
      <ImportForm canSeeCost={hasPermission(ctx.membership.permissions, PERMISSIONS.financeView)} />
    </>
  );
}
