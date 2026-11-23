"use server";

import { revalidatePath } from "next/cache";
import { actionContext } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import { expenseSchema, voidExpenseSchema, type ExpenseInput } from "@/lib/validations/expenses";
import type { ActionResult } from "@/hooks/use-form-action";

export async function recordExpenseAction(values: ExpenseInput): Promise<ActionResult | void> {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const g = await actionContext(PERMISSIONS.expensesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("record_expense", {
    p_shop_id: g.shopId,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_method: parsed.data.method,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: "ok" };
}

/** Expenses are never deleted. A voided expense stays visible and adds a reversing cash entry. */
export async function voidExpenseAction(values: { expenseId: string; reason: string }): Promise<ActionResult | void> {
  const parsed = voidExpenseSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please enter a reason." };
  const g = await actionContext(PERMISSIONS.expensesManage);
  if (!g.ok) return { error: g.error };
  const { error } = await g.supabase.rpc("void_expense", {
    p_shop_id: g.shopId, p_expense_id: parsed.data.expenseId, p_reason: parsed.data.reason,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
