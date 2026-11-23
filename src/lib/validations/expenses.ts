import { z } from "zod";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/types/domain";

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]], "Choose a category"),
  description: z.string().trim().min(1, "Describe the expense").max(200),
  amount: z.number({ error: "Enter the amount" }).positive("Amount must be greater than zero").max(1e10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  method: z.enum(PAYMENT_METHODS as [string, ...string[]], "Choose a payment method"),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const voidExpenseSchema = z.object({
  expenseId: z.uuid(),
  reason: z.string().trim().min(2, "Enter a reason").max(300),
});
