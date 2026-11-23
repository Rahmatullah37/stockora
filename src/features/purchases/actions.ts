"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import {
  addPaymentSchema,
  createPurchaseSchema,
  purchaseReturnSchema,
  type AddPaymentInput,
  type CreatePurchaseInput,
  type PurchaseReturnInput,
} from "@/lib/validations/purchases";
import type { ActionResult } from "@/hooks/use-form-action";

const FORM_INVALID = "Please check the form and try again.";

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? FORM_INVALID;
}

/**
 * Saves a purchase. Prices of the products come from the supplier's invoice, so
 * they ARE entered by the user — but totals, discounts allocation and landed
 * costs are all calculated by the database function.
 */
export async function createPurchaseAction(values: CreatePurchaseInput): Promise<ActionResult | void> {
  const parsed = createPurchaseSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };

  const { data: id, error } = await g.supabase.rpc("create_purchase", {
    p_shop_id: g.shopId,
    p_idempotency_key: input.idempotencyKey,
    p_supplier_id: input.supplierId,
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice })),
    p_discount: input.discount,
    p_additional_costs: input.additionalCosts,
    p_payments: input.payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null })),
    p_receive: input.receiveNow,
    p_supplier_invoice: input.supplierInvoice || null,
    p_notes: input.notes || null,
  });
  if (error || !id) return { error: friendlyDbError(error ?? { message: "" }) };

  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  revalidatePath("/products");
  revalidatePath("/inventory");
  redirect(`/purchases/${id}`);
}

/** Last purchase price of products — only for users who may see costs (finance.view). */
export async function getLastPurchasePricesAction(productIds: string[]): Promise<Record<string, number>> {
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok || !g.ctx.membership.permissions.includes(PERMISSIONS.financeView) || productIds.length === 0) return {};
  const { data } = await g.supabase
    .from("product_costs").select("product_id, purchase_price")
    .eq("shop_id", g.shopId).in("product_id", productIds.slice(0, 100));
  const result: Record<string, number> = {};
  for (const row of data ?? []) result[row.product_id] = Number(row.purchase_price);
  return result;
}

function refreshPurchase(id: string) {
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/suppliers");
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function receivePurchaseAction(purchaseId: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("receive_purchase", { p_shop_id: g.shopId, p_purchase_id: purchaseId });
  if (error) return { error: friendlyDbError(error) };
  refreshPurchase(purchaseId);
}

export async function cancelPurchaseAction(purchaseId: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("cancel_purchase", { p_shop_id: g.shopId, p_purchase_id: purchaseId });
  if (error) return { error: friendlyDbError(error) };
  refreshPurchase(purchaseId);
}

export async function addPurchasePaymentAction(values: AddPaymentInput): Promise<ActionResult | void> {
  const parsed = addPaymentSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("add_purchase_payment", {
    p_shop_id: g.shopId,
    p_purchase_id: parsed.data.purchaseId,
    p_method: parsed.data.method,
    p_amount: parsed.data.amount,
    p_reference: parsed.data.reference || null,
  });
  if (error) return { error: friendlyDbError(error) };
  refreshPurchase(parsed.data.purchaseId);
  return { success: "ok" };
}

export async function purchaseReturnAction(values: PurchaseReturnInput): Promise<ActionResult | void> {
  const parsed = purchaseReturnSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("complete_purchase_return", {
    p_shop_id: g.shopId,
    p_purchase_id: parsed.data.purchaseId,
    p_items: parsed.data.items.map((i) => ({ purchase_item_id: i.purchaseItemId, quantity: i.quantity })),
    p_refund_method: parsed.data.refundMethod || null,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: friendlyDbError(error) };
  refreshPurchase(parsed.data.purchaseId);
  return { success: "ok" };
}
