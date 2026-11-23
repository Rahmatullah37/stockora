"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import { paySupplierSchema, type PaySupplierInput } from "@/lib/validations/purchases";
import { supplierSchema, type SupplierInput } from "@/lib/validations/suppliers";
import type { ActionResult } from "@/hooks/use-form-action";

const FORM_INVALID = "Please check the form and try again.";

/** Creates (id = null) or updates a supplier. */
export async function saveSupplierAction(
  id: string | null,
  values: SupplierInput,
): Promise<ActionResult | void> {
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };
  const g = await actionContext(PERMISSIONS.suppliersManage);
  if (!g.ok) return { error: g.error };

  const row = {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  };

  if (id) {
    const { error } = await g.supabase.from("suppliers").update(row).eq("id", id).eq("shop_id", g.shopId);
    if (error) return { error: friendlyDbError(error) };
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    redirect(`/suppliers/${id}`);
  }

  const { data, error } = await g.supabase
    .from("suppliers").insert({ ...row, shop_id: g.shopId }).select("id").single();
  if (error || !data) return { error: friendlyDbError(error ?? { message: "" }) };
  revalidatePath("/suppliers");
  redirect(`/suppliers/${data.id}`);
}

export async function setSupplierActiveAction(id: string, isActive: boolean): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.suppliersManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.from("suppliers").update({ is_active: isActive }).eq("id", id).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

/** Deleting is blocked by the database when the supplier has purchases (archive instead). */
export async function deleteSupplierAction(id: string): Promise<ActionResult | void> {
  const g = await actionContext(PERMISSIONS.suppliersManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.from("suppliers").delete().eq("id", id).eq("shop_id", g.shopId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

/** Pays a supplier; the money is applied to the oldest unpaid purchases first. */
export async function paySupplierAction(values: PaySupplierInput): Promise<ActionResult | void> {
  const parsed = paySupplierSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FORM_INVALID };
  const g = await actionContext(PERMISSIONS.purchasesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("record_supplier_payment", {
    p_shop_id: g.shopId,
    p_supplier_id: parsed.data.supplierId,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${parsed.data.supplierId}`);
  revalidatePath("/purchases");
  return { success: "ok" };
}
