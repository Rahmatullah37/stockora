import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for the BROWSER (Client Components). It uses only the public
 * anon key; Row Level Security / Storage policies protect the data.
 * Used for uploading product images.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
