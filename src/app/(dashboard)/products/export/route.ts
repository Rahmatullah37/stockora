import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth/session";
import { cleanSearch } from "@/features/products/queries";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/utils/csv";

const UUID = /^[0-9a-f-]{36}$/;

/** Downloads products as CSV (same filters as the list). Cost columns only for finance.view. */
export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx?.membership) return new NextResponse("Not logged in", { status: 401 });
  const { shop, permissions } = ctx.membership;
  if (!hasPermission(permissions, PERMISSIONS.productsView)) return new NextResponse("Forbidden", { status: 403 });
  const canSeeCost = hasPermission(permissions, PERMISSIONS.financeView);

  const sp = new URL(request.url).searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, sku, unit, selling_price, wholesale_price, min_selling_price, current_stock, min_stock_level, expiry_date, status, category_id, brand_id")
    .eq("shop_id", shop.id).order("name").limit(10000);
  const status = sp.get("status") || "active";
  if (status !== "all") query = query.eq("status", status);
  const category = sp.get("category") ?? "";
  const brand = sp.get("brand") ?? "";
  if (UUID.test(category)) query = query.eq("category_id", category);
  if (UUID.test(brand)) query = query.eq("brand_id", brand);
  const q = cleanSearch(sp.get("q") ?? "");
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);

  const [products, categories, brands] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").eq("shop_id", shop.id),
    supabase.from("brands").select("id, name").eq("shop_id", shop.id),
  ]);
  if (products.error) return new NextResponse("Could not load products", { status: 500 });

  const cat = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const brd = new Map((brands.data ?? []).map((b) => [b.id, b.name]));
  const costs = new Map<string, number>();
  if (canSeeCost) {
    const { data } = await supabase.from("product_costs").select("product_id, purchase_price").eq("shop_id", shop.id).limit(10000);
    for (const c of data ?? []) costs.set(c.product_id, Number(c.purchase_price));
  }

  const headers = ["name", "sku", "category", "brand", "unit", ...(canSeeCost ? ["purchase_price"] : []),
    "selling_price", "wholesale_price", "min_selling_price", "current_stock", "min_stock_level", "expiry_date", "status"];
  const rows = (products.data ?? []).map((p) => [
    p.name, p.sku, p.category_id ? cat.get(p.category_id) ?? "" : "", p.brand_id ? brd.get(p.brand_id) ?? "" : "", p.unit,
    ...(canSeeCost ? [costs.get(p.id) ?? ""] : []),
    p.selling_price, p.wholesale_price ?? "", p.min_selling_price ?? "", p.current_stock, p.min_stock_level, p.expiry_date ?? "", p.status,
  ]);
  return new NextResponse("﻿" + toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
