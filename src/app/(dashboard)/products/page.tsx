import { Download, Plus, Printer, Tags, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PAGE_SIZE, Pagination, readPage } from "@/components/shared/pagination";
import { checkAccess } from "@/components/shared/plan-gate";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cleanSearch, getProductOptions } from "@/features/products/queries";
import { getAppContext } from "@/lib/auth/session";
import { getFormatter } from "@/lib/format/server";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { productImageUrl } from "@/lib/utils/product-image";
import { marginPercent } from "@/lib/calculations/profit";

export const metadata: Metadata = { title: "Products" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
/** For the "low stock" filter we load up to this many rows and filter in memory. */
const LOW_STOCK_SCAN_LIMIT = 2000;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  const gate = await checkAccess(ctx, { permission: PERMISSIONS.productsView });
  if (gate || !ctx?.membership) return gate;

  const params = await searchParams;
  const t = await getT();
  const fmt = await getFormatter(ctx);
  const { shop, permissions } = ctx.membership;
  const canManage = hasPermission(permissions, PERMISSIONS.productsManage);
  const canSeeCost = hasPermission(permissions, PERMISSIONS.financeView);
  const supabase = await createClient();

  const page = readPage(params.page);
  const q = cleanSearch(one(params.q));
  const category = one(params.category);
  const brand = one(params.brand);
  const status = one(params.status) || "active";
  const lowOnly = one(params.low) === "1";

  const options = await getProductOptions(supabase, shop.id, false);

  let query = supabase
    .from("products")
    .select("id, name, sku, unit, image_path, selling_price, current_stock, min_stock_level, status, category_id", { count: "exact" })
    .eq("shop_id", shop.id)
    .order("name");
  if (status !== "all") query = query.eq("status", status);
  if (/^[0-9a-f-]{36}$/.test(category)) query = query.eq("category_id", category);
  if (/^[0-9a-f-]{36}$/.test(brand)) query = query.eq("brand_id", brand);

  if (q) {
    // Also match a barcode: look up product ids first.
    const { data: byBarcode } = await supabase
      .from("product_barcodes").select("product_id").eq("shop_id", shop.id).ilike("barcode", `%${q}%`).limit(50);
    const ids = (byBarcode ?? []).map((b) => b.product_id);
    query = ids.length
      ? query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,id.in.(${ids.join(",")})`)
      : query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const result = lowOnly ? await query.limit(LOW_STOCK_SCAN_LIMIT) : await query.range(from, from + PAGE_SIZE);
  let rows = result.data ?? [];
  if (lowOnly) rows = rows.filter((p) => Number(p.current_stock) <= Number(p.min_stock_level));
  const hasNext = lowOnly ? rows.length > from + PAGE_SIZE : rows.length > PAGE_SIZE;
  rows = lowOnly ? rows.slice(from, from + PAGE_SIZE) : rows.slice(0, PAGE_SIZE);

  // Costs are only readable with finance.view
  const costs = new Map<string, number>();
  if (canSeeCost && rows.length) {
    const { data } = await supabase.from("product_costs").select("product_id, purchase_price").in("product_id", rows.map((r) => r.id));
    for (const c of data ?? []) costs.set(c.product_id, Number(c.purchase_price));
  }
  const categoryName = new Map(options.categories.map((c) => [c.id, c.name]));
  const hasFilters = !!(q || category || brand || lowOnly || one(params.status));
  const stockBadge = (p: { current_stock: number; min_stock_level: number }) => {
    const stock = Number(p.current_stock);
    if (stock <= 0) return <Badge variant="danger">{t("products.stock.out")}</Badge>;
    if (stock <= Number(p.min_stock_level)) return <Badge variant="warning">{t("products.stock.low")}</Badge>;
    return <Badge variant="success">{t("products.stock.ok")}</Badge>;
  };

  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") exportQuery.set(k, v);

  return (
    <>
      <PageHeader
        title={t("products.title")}
        description={t("products.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/categories" className={buttonVariants({ variant: "outline", size: "sm" })}><Tags className="size-4" aria-hidden />{t("products.manageCategories")}</Link>
            <a href={`/products/export?${exportQuery.toString()}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="size-4" aria-hidden />{t("products.export")}</a>
            <Link href={`/products/labels?${exportQuery.toString()}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Printer className="size-4" aria-hidden />{t("products.labels")}</Link>
            {canManage && <Link href="/products/import" className={buttonVariants({ variant: "outline", size: "sm" })}><Upload className="size-4" aria-hidden />{t("products.import")}</Link>}
            {canManage && <Link href="/products/new" className={buttonVariants({ size: "sm" })}><Plus className="size-4" aria-hidden />{t("products.add")}</Link>}
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <SearchInput placeholder={t("products.search")} />
      </form>
      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        {q && <input type="hidden" name="q" value={q} />}
        <Select name="category" defaultValue={category} aria-label={t("products.filter.category")} className="w-auto">
          <option value="">{t("products.filter.category")}: {t("common.all")}</option>
          {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="brand" defaultValue={brand} aria-label={t("products.filter.brand")} className="w-auto">
          <option value="">{t("products.filter.brand")}: {t("common.all")}</option>
          {options.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status} aria-label={t("products.filter.status")} className="w-auto">
          <option value="active">{t("products.status.active")}</option>
          <option value="inactive">{t("products.status.inactive")}</option>
          <option value="archived">{t("products.status.archived")}</option>
          <option value="all">{t("common.all")}</option>
        </Select>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-4 accent-[var(--primary)]" />
          {t("products.filter.lowStock")}
        </label>
        <Button type="submit" variant="outline">{t("products.filter.apply")}</Button>
        {hasFilters && <Link href="/products" className={buttonVariants({ variant: "ghost" })}>{t("products.filter.clear")}</Link>}
      </form>

      {result.error ? (
        <Alert variant="error">{t("products.loadError")}</Alert>
      ) : rows.length === 0 ? (
        hasFilters ? (
          <EmptyState title={t("products.noMatch.title")} description={t("products.noMatch.body")} />
        ) : (
          <EmptyState
            title={t("products.empty.title")}
            description={t("products.empty.body")}
            action={canManage ? <Link href="/products/new" className={buttonVariants()}>{t("products.add")}</Link> : undefined}
          />
        )
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>{t("products.col.product")}</Th>
                  <Th>{t("products.col.category")}</Th>
                  <Th>{t("products.col.stock")}</Th>
                  <Th>{t("products.col.price")}</Th>
                  {canSeeCost && <Th>{t("products.col.cost")}</Th>}
                  {canSeeCost && <Th>{t("products.col.margin")}</Th>}
                  <Th>{t("products.col.status")}</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((p) => {
                  const image = productImageUrl(p.image_path);
                  const cost = costs.get(p.id);
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <Link href={`/products/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-xs text-muted-foreground">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {image ? <img src={image} alt="" className="size-full object-cover" /> : p.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span><span className="block">{p.name}</span><span className="block text-xs font-normal text-muted-foreground">{p.sku}</span></span>
                        </Link>
                      </Td>
                      <Td>{p.category_id ? categoryName.get(p.category_id) ?? "—" : "—"}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span>{fmt.quantity(p.current_stock)} {p.unit}</span>
                          {stockBadge(p)}
                        </div>
                      </Td>
                      <Td>{fmt.money(p.selling_price)}</Td>
                      {canSeeCost && <Td>{cost === undefined ? "—" : fmt.money(cost)}</Td>}
                      {canSeeCost && <Td>{cost === undefined ? "—" : fmt.percent(marginPercent(cost, Number(p.selling_price)))}</Td>}
                      <Td><Badge variant={p.status === "active" ? "success" : "neutral"}>{t(`products.status.${p.status as "active" | "inactive" | "archived"}`)}</Badge></Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination basePath="/products" searchParams={params} page={page} hasNext={hasNext} />
        </>
      )}
    </>
  );
}
