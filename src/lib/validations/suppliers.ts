import { z } from "zod";

/** Validation for the supplier form (used in the browser AND again on the server). */
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier name").max(120),
  phone: z.string().trim().max(30, "Phone number is too long"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(1000),
});
export type SupplierInput = z.infer<typeof supplierSchema>;
