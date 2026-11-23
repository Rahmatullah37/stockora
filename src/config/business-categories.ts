/**
 * Business categories a shop can choose at registration.
 * The `key` values must match the CHECK constraint on shops.business_category
 * in the database (supabase/migrations/..._foundation.sql).
 */
export const BUSINESS_CATEGORIES = [
  { key: "grocery", label: "Grocery store" },
  { key: "clothing", label: "Clothing store" },
  { key: "electronics", label: "Electronics shop" },
  { key: "cosmetics", label: "Cosmetics shop" },
  { key: "general", label: "General store" },
  { key: "wholesale", label: "Wholesale business" },
  { key: "distributor", label: "Distributor" },
  { key: "other", label: "Other" },
] as const;

export type BusinessCategoryKey = (typeof BUSINESS_CATEGORIES)[number]["key"];

export const BUSINESS_CATEGORY_KEYS = BUSINESS_CATEGORIES.map(
  (c) => c.key,
) as [BusinessCategoryKey, ...BusinessCategoryKey[]];
