"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import { namedEntitySchema } from "@/lib/validations/inventory";
import {
  IMPORT_COLUMNS, MAX_IMPORT_ROWS, productFormSchema, toNumber, toNumberOrNull, toRpcPayload,
  type ImportRow, type ProductFormValues,
} from "@/lib/validations/products";
import type { ActionResult } from "@/hooks/use-form-action";

/** Create a product (and its QR code, barcode and opening stock) in one database call. */
export async function createProductAction(values: ProductFormValues): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const canSeeCost = g.ctx.membership.permissions.includes(PERMISSIONS.financeView);
  const { data, error } = await g.supabase.rpc("create_product", {
    p_shop_id: g.shopId,
    p: toRpcPayload(parsed.data, { includeCost: canSeeCost, includeOpening: canSeeCost }),
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/products");
  redirect(`/products/${data as string}`);
}

export async function updateProductAction(productId: string, values: ProductFormValues): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  if (!z.uuid().safeParse(productId).success) return { error: "Product not found." };
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const canSeeCost = g.ctx.membership.permissions.includes(PERMISSIONS.financeView);
  const { error } = await g.supabase.rpc("update_product", {
    p_shop_id: g.shopId,
    p_product_id: productId,
    p: toRpcPayload(parsed.data, { includeCost: canSeeCost, includeOpening: false }),
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

/** Archive / reactivate. (Archived products cannot be sold but keep their history.) */
export async function setProductStatusAction(productId: string, status: "active" | "archived"): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  if (!z.uuid().safeParse(productId).success) return { error: "Product not found." };

  // Read the current product so update_product keeps every other field as it is.
  const { data: p, error: readError } = await g.supabase
    .from("products").select("*").eq("id", productId).eq("shop_id", g.shopId).single();
  if (readError || !p) return { error: "Product not found." };

  const { error } = await g.supabase.rpc("update_product", {
    p_shop_id: g.shopId,
    p_product_id: productId,
    p: {
      name: p.name, sku: p.sku, category_id: p.category_id ?? "", brand_id: p.brand_id ?? "",
      supplier_id: p.supplier_id ?? "", description: p.description ?? "", unit: p.unit,
      selling_price: p.selling_price, wholesale_price: p.wholesale_price, min_selling_price: p.min_selling_price,
      min_stock_level: p.min_stock_level, expiry_date: p.expiry_date ?? "", status,
    },
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

/** Permanent delete. Only possible if the product has no history (the database enforces this). */
export async function deleteProductAction(productId: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  if (!z.uuid().safeParse(productId).success) return { error: "Product not found." };
  const { error } = await g.supabase.from("products").delete().eq("id", productId).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/products");
  redirect("/products");
}

// ---------------------------------------------------------------------------
// Categories & brands
// ---------------------------------------------------------------------------
type Kind = "category" | "brand";
const tableFor = (kind: Kind) => (kind === "category" ? "categories" : "brands");

export async function createNamedAction(kind: Kind, name: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  const parsed = namedEntitySchema.safeParse({ name });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { error } = await g.supabase.from(tableFor(kind)).insert({ shop_id: g.shopId, name: parsed.data.name });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/categories");
}

export async function renameNamedAction(kind: Kind, id: string, name: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  const parsed = namedEntitySchema.safeParse({ name });
  if (!parsed.success || !z.uuid().safeParse(id).success) return { error: parsed.error?.issues[0]?.message ?? "Invalid item." };
  const { error } = await g.supabase.from(tableFor(kind)).update({ name: parsed.data.name }).eq("id", id).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/categories");
}

export async function deleteNamedAction(kind: Kind, id: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { error: g.error };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid item." };
  const { error } = await g.supabase.from(tableFor(kind)).delete().eq("id", id).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/categories");
}

// ---------------------------------------------------------------------------
// CSV import (called in chunks by the browser)
// ---------------------------------------------------------------------------
export interface ImportRowResult { row: number; ok: boolean; error?: string }

/**
 * Creates the products of one chunk of the CSV. `startRow` is the row number in
 * the file (for error messages). Every row goes through create_product, so
 * QR codes, barcodes, opening stock and plan limits all behave exactly like the form.
 */
export async function importProductsAction(rows: ImportRow[], startRow: number): Promise<{ results: ImportRowResult[]; error?: string }> {
  const g = await actionContext(PERMISSIONS.productsManage);
  if (!g.ok) return { results: [], error: g.error };
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) return { results: [], error: "Invalid import chunk." };
  if (startRow + rows.length > MAX_IMPORT_ROWS + 2) return { results: [], error: "Too many rows." };

  const canSeeCost = g.ctx.membership.permissions.includes(PERMISSIONS.financeView);
  const { supabase, shopId } = g;

  // Existing categories/brands by lower-case name; missing ones are created on demand.
  const lookups: Record<Kind, Map<string, string>> = { category: new Map(), brand: new Map() };
  for (const kind of ["category", "brand"] as Kind[]) {
    const { data } = await supabase.from(tableFor(kind)).select("id, name").eq("shop_id", shopId);
    for (const item of data ?? []) lookups[kind].set(String(item.name).toLowerCase(), item.id as string);
  }
  async function resolveName(kind: Kind, raw: string): Promise<string> {
    const name = raw.trim();
    if (!name) return "";
    const key = name.toLowerCase();
    const known = lookups[kind].get(key);
    if (known) return known;
    const { data, error } = await supabase.from(tableFor(kind)).insert({ shop_id: shopId, name }).select("id").single();
    if (error || !data) return "";
    lookups[kind].set(key, data.id as string);
    return data.id as string;
  }

  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = startRow + i;
    const clean = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, String(row[c] ?? "").trim()])) as ImportRow;
    if (!clean.name) { results.push({ row: rowNumber, ok: false, error: "Name is empty." }); continue; }
    const selling = toNumberOrNull(clean.selling_price);
    if (selling === null || selling < 0) { results.push({ row: rowNumber, ok: false, error: "Selling price must be a number." }); continue; }

    const payload: Record<string, unknown> = {
      name: clean.name, sku: clean.sku, barcode: clean.barcode,
      category_id: await resolveName("category", clean.category),
      brand_id: await resolveName("brand", clean.brand),
      description: clean.description, unit: clean.unit || "pcs",
      selling_price: selling,
      wholesale_price: toNumberOrNull(clean.wholesale_price),
      min_selling_price: toNumberOrNull(clean.min_selling_price),
      min_stock_level: toNumber(clean.min_stock_level),
      expiry_date: /^\d{4}-\d{2}-\d{2}$/.test(clean.expiry_date) ? clean.expiry_date : "",
      status: "active",
    };
    if (canSeeCost && clean.purchase_price) payload.purchase_price = toNumber(clean.purchase_price);
    if (canSeeCost && clean.opening_stock) payload.opening_stock = toNumber(clean.opening_stock);

    const { error } = await supabase.rpc("create_product", { p_shop_id: shopId, p: payload });
    results.push(error ? { row: rowNumber, ok: false, error: friendlyDbError(error) } : { row: rowNumber, ok: true });
  }
  revalidatePath("/products");
  return { results };
}
