import { z } from "zod";

/** Validation for POS checkout, payments and returns (re-checked on the server). */

export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "card", "mobile_payment"]);

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  customerId: z.uuid().nullable(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().positive("Quantity must be greater than zero").max(1_000_000),
        priceType: z.enum(["retail", "wholesale"]),
      }),
    )
    .min(1, "The cart is empty")
    .max(200),
  discountType: z.enum(["none", "amount", "percent"]),
  discountValue: z.number().min(0).max(1_000_000_000),
  payments: z
    .array(
      z.object({
        method: paymentMethodSchema,
        amount: z.number().positive().max(1_000_000_000),
        reference: z.string().trim().max(100).optional(),
      }),
    )
    .max(10),
  notes: z.string().trim().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const salePaymentSchema = z.object({
  saleId: z.uuid(),
  method: paymentMethodSchema,
  amount: z.number("Enter an amount").positive("Enter an amount greater than zero"),
  reference: z.string().trim().max(100).optional(),
});
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;

export const salesReturnSchema = z.object({
  saleId: z.uuid(),
  items: z
    .array(z.object({ saleItemId: z.uuid(), quantity: z.number().positive() }))
    .min(1, "Select at least one item to return"),
  refundMethod: paymentMethodSchema.nullable(),
  reason: z.string().trim().min(2, "Enter a reason").max(300),
});
export type SalesReturnInput = z.infer<typeof salesReturnSchema>;
