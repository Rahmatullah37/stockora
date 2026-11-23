"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/hooks/use-form-action";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import {
  customerPaymentSchema,
  customerSchema,
  type CustomerInput,
  type CustomerPaymentInput,
} from "@/lib/validations/customers";

const FORM_INVALID = "Please check the form and try again.";

export async function createCustomerAction(values: CustomerInput): Promise<ActionResult | void> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };
  const g = await actionContext(PERMISSIONS.customersManage);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { data, error } = await g.supabase.from("customers").insert({
    shop_id: g.shopId, name: v.name, phone: v.phone || null, email: v.email || null,
    address: v.address || null, notes: v.notes || null,
  }).select("id").single();
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomerAction(id: string, values: CustomerInput): Promise<ActionResult | void> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };
  const g = await actionContext(PERMISSIONS.customersManage);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { data, error } = await g.supabase.from("customers").update({
    name: v.name, phone: v.phone || null, email: v.email || null,
    address: v.address || null, notes: v.notes || null,
  }).eq("id", id).eq("shop_id", g.shopId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You do not have permission to change this customer." };
  revalidatePath("/customers", "layout");
  redirect(`/customers/${id}`);
}

export async function setCustomerActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const g = await actionContext(PERMISSIONS.customersManage);
  if (!g.ok) return { error: g.error };
  const { data, error } = await g.supabase.from("customers").update({ is_active: isActive })
    .eq("id", id).eq("shop_id", g.shopId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You do not have permission to change this customer." };
  revalidatePath("/customers", "layout");
  return { success: "saved" };
}

/** Deletes a customer. Customers with invoices are refused (to keep their credit history). */
export async function deleteCustomerAction(id: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.customersManage);
  if (!g.ok) return { error: g.error };

  const { count } = await g.supabase.from("sales").select("id", { count: "exact", head: true })
    .eq("shop_id", g.shopId).eq("customer_id", id);
  if ((count ?? 0) > 0) {
    return { error: "This customer has invoices, so they cannot be deleted. Deactivate them instead." };
  }
  const { error } = await g.supabase.from("customers").delete().eq("id", id).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/customers");
  redirect("/customers");
}

/** Customer pays down their account (oldest invoices first). */
export async function receiveCustomerPaymentAction(values: CustomerPaymentInput): Promise<ActionResult> {
  const parsed = customerPaymentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FORM_INVALID };
  const g = await actionContext(PERMISSIONS.salesCreate);
  if (!g.ok) return { error: g.error };
  const v = parsed.data;

  const { error } = await g.supabase.rpc("record_customer_payment", {
    p_shop_id: g.shopId, p_customer_id: v.customerId, p_amount: v.amount,
    p_method: v.method, p_reference: v.reference || null,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/customers", "layout");
  revalidatePath("/sales/history");
  revalidatePath("/dashboard");
  return { success: "saved" };
}
