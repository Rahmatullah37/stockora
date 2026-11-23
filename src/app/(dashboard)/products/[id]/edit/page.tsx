import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/features/products/components/product-form";
import { getProductOptions } from "@/features/products/queries";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ProductFormValues } from "@/lib/validations/products";

export const metadata: Metadata = { title: "Edit product" };

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsManage });
  if (gate || !ctx?.membership) return gate;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const t = await getT();
  const supabase = await createClient();
  const { shop, permissions } = ctx.membership;
  const canSeeCost = hasPermission(permissions, PERMISSIONS.financeView);

  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!p) notFound();
  const [options, barcode, cost] = await Promise.all([
    getProductOptions(supabase, shop.id),
    supabase.from("product_barcodes").select("barcode").eq("product_id", id).limit(1).maybeSingle(),
    canSeeCost
      ? supabase.from("product_costs").select("purchase_price").eq("product_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const defaultValues: ProductFormValues = {
    name: p.name, sku: p.sku, barcode: text(barcode.data?.barcode), categoryId: text(p.category_id),
    brandId: text(p.brand_id), supplierId: text(p.supplier_id), description: text(p.description), unit: p.unit,
    purchasePrice: text(cost.data?.purchase_price), sellingPrice: text(p.selling_price),
    wholesalePrice: text(p.wholesale_price), minSellingPrice: text(p.min_selling_price),
    minStockLevel: text(p.min_stock_level), openingStock: "", expiryDate: text(p.expiry_date),
    status: p.status, imagePath: text(p.image_path),
  };

  return (
    <>
      <PageHeader title={t("products.form.editTitle")} description={p.name} />
      <ProductForm
        mode="edit" productId={id} shopId={shop.id} defaultValues={defaultValues}
        {...options} canSeeCost={canSeeCost}
      />
    </>
  );
}
