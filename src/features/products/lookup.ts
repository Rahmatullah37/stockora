"use server";

import { PERMISSIONS } from "@/lib/permissions";
import { actionContext } from "@/lib/auth/guards";
import { friendlyDbError } from "@/lib/supabase/errors";
import { productImageUrl } from "@/lib/utils/product-image";
import type { Product } from "@/types/domain";

/**
 * Product data the scanner and the POS need. Cost prices are included ONLY when
 * the user has finance.view (the database hides them from everyone else).
 */
export interface LookupProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  imageUrl: string | null;
  sellingPrice: number;
  wholesalePrice: number | null;
  minSellingPrice: number | null;
  currentStock: number;
  /** Stock available at the main branch (what a sale can use). */
  status: Product["status"];
  expiryDate: string | null;
  purchasePrice: number | null;
}

export type LookupResult =
  | { ok: true; product: LookupProduct }
  | { ok: false; error: string; notFound?: boolean };

const PRODUCT_COLUMNS =
  "id, name, sku, unit, image_path, selling_price, wholesale_price, min_selling_price, current_stock, status, expiry_date";

type Row = Pick<Product, "id" | "name" | "sku" | "unit" | "image_path" | "selling_price" | "wholesale_price" |
  "min_selling_price" | "current_stock" | "status" | "expiry_date">;

function toLookupProduct(row: Row, purchasePrice: number | null): LookupProduct {
  return {
    id: row.id, name: row.name, sku: row.sku, unit: row.unit,
    imageUrl: productImageUrl(row.image_path),
    sellingPrice: Number(row.selling_price),
    wholesalePrice: row.wholesale_price === null ? null : Number(row.wholesale_price),
    minSellingPrice: row.min_selling_price === null ? null : Number(row.min_selling_price),
    currentStock: Number(row.current_stock),
    status: row.status, expiryDate: row.expiry_date, purchasePrice,
  };
}

/**
 * Finds a product from whatever was scanned: a Stockora QR code ("STK:..."),
 * a barcode, or a SKU typed by a USB scanner. The latest data is read from the database.
 */
export async function lookupProductByCodeAction(code: string): Promise<LookupResult> {
  const g = await actionContext(PERMISSIONS.productsView);
  if (!g.ok) return { ok: false, error: g.error };
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 200) return { ok: false, error: "Empty code.", notFound: true };

  const { data: id, error } = await g.supabase.rpc("find_product_by_code", {
    p_shop_id: g.shopId, p_code: trimmed,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!id) return { ok: false, error: "No product matches this code.", notFound: true };

  const { data: row, error: rowError } = await g.supabase
    .from("products").select(PRODUCT_COLUMNS).eq("id", id).eq("shop_id", g.shopId).single();
  if (rowError || !row) return { ok: false, error: "No product matches this code.", notFound: true };

  let purchasePrice: number | null = null;
  if (g.ctx.membership.permissions.includes(PERMISSIONS.financeView)) {
    const { data: cost } = await g.supabase.from("product_costs").select("purchase_price").eq("product_id", id).maybeSingle();
    purchasePrice = cost ? Number(cost.purchase_price) : null;
  }
  return { ok: true, product: toLookupProduct(row as Row, purchasePrice) };
}

/** Manual search by name, SKU or barcode (up to 12 results). Only active products. */
export async function searchProductsAction(query: string): Promise<{ products: LookupProduct[]; error?: string }> {
  const g = await actionContext(PERMISSIONS.productsView);
  if (!g.ok) return { products: [], error: g.error };
  // Remove characters that have a special meaning in the filter syntax.
  const q = query.trim().replace(/[%,()*\\]/g, " ").slice(0, 60);
  if (q.length < 1) return { products: [] };

  const { data: barcodeRows } = await g.supabase
    .from("product_barcodes").select("product_id").eq("shop_id", g.shopId).ilike("barcode", `${q}%`).limit(12);
  const barcodeIds = (barcodeRows ?? []).map((r) => r.product_id);

  let request = g.supabase.from("products").select(PRODUCT_COLUMNS)
    .eq("shop_id", g.shopId).eq("status", "active").order("name").limit(12);
  request = barcodeIds.length
    ? request.or(`name.ilike.%${q}%,sku.ilike.%${q}%,id.in.(${barcodeIds.join(",")})`)
    : request.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  const { data, error } = await request;
  if (error) return { products: [], error: friendlyDbError(error) };
  return { products: (data as Row[]).map((row) => toLookupProduct(row, null)) };
}
