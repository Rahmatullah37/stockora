import { z } from "zod";

/**
 * Product form rules. All number fields are kept as TEXT in the form (so an
 * empty box is allowed) and converted with toNumber()/toNumberOrNull() before
 * they are sent to the database. The server re-checks everything.
 */

export const PRODUCT_UNITS = ["pcs", "kg", "g", "l", "ml", "m", "box", "pack", "dozen"] as const;
export const PRODUCT_STATUSES = ["active", "inactive", "archived"] as const;

export function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
export function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const MAX_MONEY = 999_999_999_999;
/** Empty or a number >= 0. */
const optionalAmount = z.string().trim().refine(
  (v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= MAX_MONEY),
  "Enter a number that is 0 or more",
);
const requiredAmount = z.string().trim().min(1, "Required").refine(
  (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= MAX_MONEY,
  "Enter a number that is 0 or more",
);
const uuidOrEmpty = z.union([z.literal(""), z.uuid("Invalid selection")]);

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the product name").max(200, "Name is too long"),
    sku: z.string().trim().max(60, "SKU is too long"),
    barcode: z.string().trim().max(64, "Barcode is too long"),
    categoryId: uuidOrEmpty,
    brandId: uuidOrEmpty,
    supplierId: uuidOrEmpty,
    description: z.string().trim().max(1000, "Description is too long"),
    unit: z.string().trim().min(1, "Enter a unit").max(20, "Unit is too long"),
    purchasePrice: optionalAmount,
    sellingPrice: requiredAmount,
    wholesalePrice: optionalAmount,
    minSellingPrice: optionalAmount,
    minStockLevel: optionalAmount,
    openingStock: optionalAmount,
    expiryDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")]),
    status: z.enum(PRODUCT_STATUSES),
    imagePath: z.string().max(300),
  })
  .superRefine((v, ctx) => {
    const selling = toNumber(v.sellingPrice);
    const min = toNumberOrNull(v.minSellingPrice);
    const wholesale = toNumberOrNull(v.wholesalePrice);
    if (min !== null && selling < min) {
      ctx.addIssue({ code: "custom", path: ["sellingPrice"], message: "Selling price cannot be below the minimum selling price" });
    }
    if (min !== null && wholesale !== null && wholesale < min) {
      ctx.addIssue({ code: "custom", path: ["wholesalePrice"], message: "Wholesale price cannot be below the minimum selling price" });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const emptyProductForm: ProductFormValues = {
  name: "", sku: "", barcode: "", categoryId: "", brandId: "", supplierId: "", description: "",
  unit: "pcs", purchasePrice: "", sellingPrice: "", wholesalePrice: "", minSellingPrice: "",
  minStockLevel: "0", openingStock: "", expiryDate: "", status: "active", imagePath: "",
};

/**
 * Builds the JSON that create_product / update_product expect.
 * Cost is sent only when the user may see/change it (finance.view).
 */
export function toRpcPayload(
  v: ProductFormValues,
  options: { includeCost: boolean; includeOpening: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    category_id: v.categoryId,
    brand_id: v.brandId,
    supplier_id: v.supplierId,
    description: v.description,
    unit: v.unit,
    image_path: v.imagePath,
    selling_price: toNumber(v.sellingPrice),
    wholesale_price: toNumberOrNull(v.wholesalePrice),
    min_selling_price: toNumberOrNull(v.minSellingPrice),
    min_stock_level: toNumber(v.minStockLevel),
    expiry_date: v.expiryDate,
    status: v.status,
  };
  if (options.includeCost && v.purchasePrice.trim() !== "") payload.purchase_price = toNumber(v.purchasePrice);
  if (options.includeOpening && v.openingStock.trim() !== "") payload.opening_stock = toNumber(v.openingStock);
  return payload;
}

/** CSV import: columns we understand (header names, lower case). */
export const IMPORT_COLUMNS = [
  "name", "sku", "barcode", "category", "brand", "unit", "purchase_price", "selling_price",
  "wholesale_price", "min_selling_price", "opening_stock", "min_stock_level", "expiry_date", "description",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Record<ImportColumn, string>;

export const MAX_IMPORT_ROWS = 1000;
