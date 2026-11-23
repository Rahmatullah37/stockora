import { z } from "zod";
import { paymentMethodSchema } from "./sales";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer name").max(120),
  phone: z.string().trim().max(30, "Phone number is too long").regex(/^(\+?[0-9\s-]*)$/, "Use digits only, e.g. +92 300 1234567"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(500),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const customerPaymentSchema = z.object({
  customerId: z.uuid(),
  amount: z.number("Enter an amount").positive("Enter an amount greater than zero"),
  method: paymentMethodSchema,
  reference: z.string().trim().max(100).optional(),
});
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;
