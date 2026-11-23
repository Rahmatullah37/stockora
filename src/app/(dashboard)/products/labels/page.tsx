import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { LabelSheet } from "@/features/products/components/label-sheet";
import { cleanSearch } from "@/features/products/queries";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QR labels" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/;
const MAX_LABELS = 120;

/** /products/labels?ids=a,b,c  (specific products)  or the same filters as the product list. */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsView });
  if (gate || !ctx?.membership) return gate;
  const params = await searchParams;
  const t = await getT();
  const { shop } = ctx.membership;
  const supabase = await createClient();

  let query = supabase.from("products").select("id, name, sku, selling_price").eq("shop_id", shop.id).order("name").limit(MAX_LABELS + 1);
  const ids = one(params.ids).split(",").filter((x) => UUID.test(x));
  if (ids.length) query = query.in("id", ids);
  else {
    const status = one(params.status) || "active";
    if (status !== "all") query = query.eq("status", status);
    if (UUID.test(one(params.category))) query = query.eq("category_id", one(params.category));
    if (UUID.test(one(params.brand))) query = query.eq("brand_id", one(params.brand));
    const q = cleanSearch(one(params.q));
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  const { data: products } = await query;
  const list = (products ?? []).slice(0, MAX_LABELS);
  const { data: codes } = list.length
    ? await supabase.from("product_qr_codes").select("product_id, code").in("product_id", list.map((p) => p.id))
    : { data: [] };
  const codeOf = new Map((codes ?? []).map((c) => [c.product_id, c.code as string]));
  const labels = list.filter((p) => codeOf.has(p.id)).map((p) => ({
    id: p.id, name: p.name, sku: p.sku, sellingPrice: Number(p.selling_price), qrCode: codeOf.get(p.id)!,
  }));

  return (
    <>
      <PageHeader
        title={t("products.labels.title")}
        description={`${t("products.labels.subtitle")} ${t("products.labels.count", { count: labels.length })}`}
      />
      {(products ?? []).length > MAX_LABELS && (
        <p className="mb-3 text-sm text-warning">{t("products.labels.limit", { count: MAX_LABELS })}</p>
      )}
      {labels.length === 0 ? <EmptyState title={t("products.labels.empty")} /> : <LabelSheet shopName={shop.name} products={labels} />}
    </>
  );
}
