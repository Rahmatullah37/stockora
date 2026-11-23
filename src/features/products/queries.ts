import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Category, Supplier } from "@/types/domain";

/** Lists used by the product form and the list filters. Each is empty if the user may not read it. */
export async function getProductOptions(supabase: SupabaseClient, shopId: string, includeSuppliers = true) {
  const [categories, brands, suppliers] = await Promise.all([
    supabase.from("categories").select("id, name").eq("shop_id", shopId).order("name"),
    supabase.from("brands").select("id, name").eq("shop_id", shopId).order("name"),
    includeSuppliers
      ? supabase.from("suppliers").select("id, name").eq("shop_id", shopId).eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as Pick<Supplier, "id" | "name">[] }),
  ]);
  return {
    categories: (categories.data ?? []) as Pick<Category, "id" | "name">[],
    brands: (brands.data ?? []) as Pick<Brand, "id" | "name">[],
    suppliers: (suppliers.data ?? []) as Pick<Supplier, "id" | "name">[],
  };
}

/** Removes characters that have a special meaning in PostgREST filters. */
export function cleanSearch(value: string | undefined): string {
  return (value ?? "").trim().replace(/[%,()*\\:]/g, " ").slice(0, 60);
}
