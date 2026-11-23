"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/hooks/use-form-action";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import {
  checkoutSchema,
  salePaymentSchema,
  salesReturnSchema,
  type CheckoutInput,
  type SalePaymentInput,
  type SalesReturnInput,
} from "@/lib/validations/sales";

const FORM_INVALID = "Please check the form and try again.";

export interface CheckoutResult extends ActionResult {
  saleId?: string;
  invoiceNo?: string;
}

/**
 * Completes a sale. The browser sends ONLY product ids, quantities, the price
 * type, the discount request and the payments. Prices, totals, tax and stock
 * are decided by the database function complete_sale().
 */
export async function completeSaleAction(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FORM_INVALID };
  const g = await actionContext(PERMISSIONS.salesCreate);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { data: saleId, error } = await g.supabase.rpc("complete_sale", {
    p_shop_id: g.shopId,
    p_idempotency_key: v.idempotencyKey,
    p_customer_id: v.customerId,
    p_items: v.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, price_type: i.priceType })),
    p_discount_type: v.discountType,
    p_discount_value: v.discountValue,
    p_payments: v.payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null })),
    p_notes: v.notes || null,
  });
  if (error) return { error: friendlyDbError(error) };

  const { data: sale } = await g.supabase.from("sales").select("invoice_no").eq("id", saleId as string).maybeSingle();
  revalidatePath("/sales/history");
  revalidatePath("/dashboard");
  return { success: "sold", saleId: saleId as string, invoiceNo: sale?.invoice_no };
}

export async function addSalePaymentAction(input: SalePaymentInput): Promise<ActionResult> {
  const parsed = salePaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FORM_INVALID };
  const g = await actionContext(PERMISSIONS.salesCreate);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { error } = await g.supabase.rpc("add_sale_payment", {
    p_shop_id: g.shopId, p_sale_id: v.saleId, p_method: v.method, p_amount: v.amount, p_reference: v.reference || null,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/sales/${v.saleId}`);
  revalidatePath("/sales/history");
  revalidatePath("/customers", "layout");
  return { success: "saved" };
}

export async function completeSalesReturnAction(input: SalesReturnInput): Promise<ActionResult> {
  const parsed = salesReturnSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FORM_INVALID };
  const g = await actionContext(PERMISSIONS.salesRefund);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { error } = await g.supabase.rpc("complete_sales_return", {
    p_shop_id: g.shopId,
    p_sale_id: v.saleId,
    p_items: v.items.map((i) => ({ sale_item_id: i.saleItemId, quantity: i.quantity })),
    p_refund_method: v.refundMethod,
    p_reason: v.reason,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/sales/${v.saleId}`);
  revalidatePath("/sales/history");
  revalidatePath("/customers", "layout");
  revalidatePath("/dashboard");
  return { success: "returned" };
}

export interface CustomerOption { id: string; name: string; phone: string | null }

/** Customer search for the POS picker (name or phone). */
export async function searchCustomersAction(query: string): Promise<{ customers: CustomerOption[]; error?: string }> {
  const g = await actionContext(PERMISSIONS.salesCreate);
  if (!g.ok) return { customers: [], error: g.error };
  const q = query.trim().replace(/[%,()*\\]/g, " ").slice(0, 60);
  let request = g.supabase.from("customers").select("id, name, phone")
    .eq("shop_id", g.shopId).eq("is_active", true).order("name").limit(8);
  if (q) request = request.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, error } = await request;
  if (error) return { customers: [], error: friendlyDbError(error) };
  return { customers: (data ?? []) as CustomerOption[] };
}

/** Quick "new customer" from the POS (needs customers.manage). */
export async function quickCreateCustomerAction(input: {
  name: string; phone: string;
}): Promise<{ customer?: CustomerOption; error?: string }> {
  const g = await actionContext(PERMISSIONS.customersManage);
  if (!g.ok) return { error: g.error };
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (name.length < 1 || name.length > 120) return { error: "Enter the customer name" };
  if (!/^(\+?[0-9\s-]*)$/.test(phone) || phone.length > 30) return { error: "Use digits only, e.g. +92 300 1234567" };

  const { data, error } = await g.supabase.from("customers")
    .insert({ shop_id: g.shopId, name, phone: phone || null })
    .select("id, name, phone").single();
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/customers");
  return { customer: data as CustomerOption };
}
