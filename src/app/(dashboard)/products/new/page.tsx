import type { Metadata } from "next";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/features/products/components/product-form";
import { getProductOptions } from "@/features/products/queries";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { emptyProductForm } from "@/lib/validations/products";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsManage });
  if (gate || !ctx?.membership) return gate;
  const t = await getT();
  const supabase = await createClient();
  const options = await getProductOptions(supabase, ctx.membership.shop.id);
  return (
    <>
      <PageHeader title={t("products.form.addTitle")} />
      <ProductForm
        mode="create" shopId={ctx.membership.shop.id} defaultValues={emptyProductForm}
        {...options} canSeeCost={hasPermission(ctx.membership.permissions, PERMISSIONS.financeView)}
      />
    </>
  );
}
