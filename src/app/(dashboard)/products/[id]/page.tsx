import { ArrowLeft, Pencil, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { ProductActions } from "@/features/products/components/product-actions";
import { ProfitPreview } from "@/features/products/components/profit-preview";
import { QrImage } from "@/features/products/components/qr-image";
import { getAppContext } from "@/lib/auth/session";
import { getFormatter } from "@/lib/format/server";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { productImageUrl } from "@/lib/utils/product-image";

export const metadata: Metadata = { title: "Product" };

/** One "label ... value" line. Defined outside the page so it is not re-created on every render. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt><dd className="text-end font-medium">{value}</dd>
    </div>
  );
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsView });
  if (gate || !ctx?.membership) return gate;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const t = await getT();
  const fmt = await getFormatter(ctx);
  const supabase = await createClient();
  const { shop, permissions } = ctx.membership;
  const canManage = hasPermission(permissions, PERMISSIONS.productsManage);
  const canSeeCost = hasPermission(permissions, PERMISSIONS.financeView);
  const canSeeMovements = hasPermission(permissions, PERMISSIONS.inventoryView);

  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!p) notFound();

  const [qr, barcodes, cost, category, brand, purchases, movements] = await Promise.all([
    supabase.from("product_qr_codes").select("code").eq("product_id", id).maybeSingle(),
    supabase.from("product_barcodes").select("barcode").eq("product_id", id),
    canSeeCost ? supabase.from("product_costs").select("purchase_price, avg_cost").eq("product_id", id).maybeSingle() : Promise.resolve({ data: null }),
    p.category_id ? supabase.from("categories").select("name").eq("id", p.category_id).maybeSingle() : Promise.resolve({ data: null }),
    p.brand_id ? supabase.from("brands").select("name").eq("id", p.brand_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("purchase_items").select("quantity, unit_price, purchases(purchase_no, ordered_at)").eq("product_id", id).order("created_at", { ascending: false }).limit(10),
    canSeeMovements
      ? supabase.from("inventory_movements").select("id, movement_type, quantity_change, stock_after, reason, created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(15)
      : Promise.resolve({ data: [] }),
  ]);

  const image = productImageUrl(p.image_path);
  const stock = Number(p.current_stock);
  const avgCost = cost.data ? Number(cost.data.avg_cost) : null;
  const status = p.status as "active" | "inactive" | "archived";

  return (
    <>
      <PageHeader
        title={p.name}
        description={p.sku}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm" })}><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />{t("common.back")}</Link>
            <Link href={`/products/labels?ids=${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Printer className="size-4" aria-hidden />{t("products.detail.printLabel")}</Link>
            {canManage && <Link href={`/products/${id}/edit`} className={buttonVariants({ size: "sm" })}><Pencil className="size-4" aria-hidden />{t("common.edit")}</Link>}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
              <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-3xl text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {image ? <img src={image} alt={p.name} className="size-full object-cover" /> : p.name.slice(0, 1).toUpperCase()}
              </div>
              <dl className="flex-1">
                <Row label={t("products.field.category")} value={category.data?.name ?? "—"} />
                <Row label={t("products.field.brand")} value={brand.data?.name ?? "—"} />
                <Row label={t("products.field.barcode")} value={(barcodes.data ?? []).map((b) => b.barcode).join(", ") || "—"} />
                <Row label={t("products.field.status")} value={<Badge variant={status === "active" ? "success" : "neutral"}>{t(`products.status.${status}`)}</Badge>} />
                <Row label={t("products.field.expiry")} value={p.expiry_date ? fmt.date(p.expiry_date) : "—"} />
                <Row label={t("products.detail.created")} value={fmt.date(p.created_at)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("products.detail.stock")}</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Row label={t("products.detail.stock")} value={`${fmt.quantity(stock)} ${p.unit}`} />
                <Row label={t("products.detail.minStock")} value={`${fmt.quantity(p.min_stock_level)} ${p.unit}`} />
                {avgCost !== null && <Row label={t("products.detail.avgCost")} value={fmt.money(avgCost)} />}
                {/* Stock value = quantity x weighted average cost (only for people who may see costs) */}
                {avgCost !== null && <Row label={t("products.detail.stockValue")} value={fmt.money(stock * avgCost)} />}
              </dl>
            </CardContent>
          </Card>

          {canSeeCost && cost.data && (
            <ProfitPreview cost={Number(cost.data.purchase_price)} price={Number(p.selling_price)} />
          )}

          <Card>
            <CardHeader><CardTitle>{t("products.detail.purchaseHistory")}</CardTitle></CardHeader>
            <CardContent>
              {(purchases.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("products.detail.noPurchases")}</p>
              ) : (
                <TableWrap>
                  <Table>
                    <THead><Tr><Th>{t("products.detail.col.date")}</Th><Th>{t("products.detail.col.ref")}</Th><Th>{t("products.detail.col.qty")}</Th><Th>{t("products.detail.col.price")}</Th></Tr></THead>
                    <TBody>
                      {(purchases.data ?? []).map((row, i) => {
                        const header = (Array.isArray(row.purchases) ? row.purchases[0] : row.purchases) as { purchase_no: string; ordered_at: string } | null;
                        return (
                          <Tr key={i}>
                            <Td>{header ? fmt.date(header.ordered_at) : "—"}</Td><Td>{header?.purchase_no ?? "—"}</Td>
                            <Td>{fmt.quantity(row.quantity)}</Td><Td>{fmt.money(row.unit_price)}</Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>

          {canSeeMovements && (
            <Card>
              <CardHeader><CardTitle>{t("products.detail.movements")}</CardTitle></CardHeader>
              <CardContent>
                {(movements.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("products.detail.noMovements")}</p>
                ) : (
                  <TableWrap>
                    <Table>
                      <THead><Tr><Th>{t("products.detail.col.date")}</Th><Th>{t("products.detail.col.type")}</Th><Th>{t("products.detail.col.qty")}</Th><Th>{t("products.detail.col.after")}</Th><Th>{t("products.detail.col.reason")}</Th></Tr></THead>
                      <TBody>
                        {(movements.data ?? []).map((m) => (
                          <Tr key={m.id}>
                            <Td>{fmt.dateTime(m.created_at)}</Td><Td>{m.movement_type}</Td>
                            <Td className={Number(m.quantity_change) < 0 ? "text-danger" : "text-success"}>{Number(m.quantity_change) > 0 ? "+" : ""}{fmt.quantity(m.quantity_change)}</Td>
                            <Td>{fmt.quantity(m.stock_after)}</Td><Td>{m.reason}</Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </TableWrap>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("products.detail.qr")}</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              {qr.data ? <QrImage text={`STK:${qr.data.code}`} size={180} alt={`QR ${p.name}`} /> : <p className="text-sm text-muted-foreground">—</p>}
              <p className="text-xs text-muted-foreground">{t("products.detail.qrHint")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Row label={t("products.col.price")} value={fmt.money(p.selling_price)} />
              {p.wholesale_price !== null && <Row label={t("products.field.wholesalePrice")} value={fmt.money(p.wholesale_price)} />}
              {p.min_selling_price !== null && <Row label={t("products.field.minSellingPrice")} value={fmt.money(p.min_selling_price)} />}
              {canManage && <ProductActions productId={id} status={p.status} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
