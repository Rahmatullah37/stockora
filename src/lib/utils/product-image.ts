import { requireSupabaseEnv } from "@/lib/env";

/**
 * Public URL of a product image stored in the Supabase Storage bucket
 * "product-images" (the path is saved in products.image_path).
 */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { url } = requireSupabaseEnv();
  return `${url}/storage/v1/object/public/product-images/${path}`;
}
