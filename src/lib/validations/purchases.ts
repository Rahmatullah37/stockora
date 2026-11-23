import { z } from "zod";
import { PAYMENT_METHODS } from "@/types/domain";

const money = z.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(1e10);
const method = z.enum(PAYMENT_METHODS as [string, ...string[]], "Choose a payment method");

export const purchaseItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number({ error: "Enter a quantity" }).positive("Quantity must be greater than zero").max(1e9),
  unitPrice: money,
});

export const purchasePaymentLineSchema = z.object({
  method,
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than zero").max(1e10),
  reference: z.string().trim().max(100).optional(),
});

/** What the "new purchase" screen sends. The database calculates every total again. */
export const createPurchaseSchema = z.object({
  idempotencyKey: z.uuid(),
  supplierId: z.uuid("Select a supplier"),
  items: z.array(purchaseItemSchema).min(1, "Add at least one product").max(300),
  discount: money,
  additionalCosts: money,
  payments: z.array(purchasePaymentLineSchema).max(10),
  receiveNow: z.boolean(),
  supplierInvoice: z.string().trim().max(60),
  notes: z.string().trim().max(500),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const addPaymentSchema = z.object({
  purchaseId: z.uuid(),
  method,
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than zero").max(1e10),
  reference: z.string().trim().max(100),
});
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;

export const paySupplierSchema = z.object({
  supplierId: z.uuid(),
  method,
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than zero").max(1e10),
  reference: z.string().trim().max(100),
});
export type PaySupplierInput = z.infer<typeof paySupplierSchema>;

export const purchaseReturnSchema = z.object({
  purchaseId: z.uuid(),
  items: z.array(z.object({
    purchaseItemId: z.uuid(),
    quantity: z.number().positive("Quantity must be greater than zero"),
  })).min(1, "Select at least one item to return"),
  refundMethod: z.union([z.literal(""), method]),
  reason: z.string().trim().min(2, "Enter a reason").max(300),
});
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
