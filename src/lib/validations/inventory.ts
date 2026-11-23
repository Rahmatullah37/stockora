import { z } from "zod";

export const ADJUST_KINDS = ["stock_in", "stock_out", "adjustment", "damaged", "expired"] as const;
export type AdjustKind = (typeof ADJUST_KINDS)[number];

const amount = (label: string) =>
  z.string().trim().min(1, `Enter ${label}`).refine(
    (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000_000,
    "Enter a valid number",
  );

export const adjustStockSchema = z.object({
  productId: z.uuid("Choose a product"),
  kind: z.enum(ADJUST_KINDS),
  quantity: amount("the quantity"),
  reason: z.string().trim().min(2, "Enter a reason").max(300, "Reason is too long"),
  unitCost: z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter a valid number"),
});
export type AdjustStockValues = z.infer<typeof adjustStockSchema>;

export const transferSchema = z
  .object({
    productId: z.uuid("Choose a product"),
    fromBranchId: z.uuid("Choose a branch"),
    toBranchId: z.uuid("Choose a branch"),
    quantity: amount("the quantity").refine((v) => Number(v) > 0, "Quantity must be more than 0"),
    note: z.string().trim().max(300, "Note is too long"),
  })
  .refine((v) => v.fromBranchId !== v.toBranchId, { path: ["toBranchId"], message: "Choose two different branches" });
export type TransferValues = z.infer<typeof transferSchema>;

export const namedEntitySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Name is too long"),
});
