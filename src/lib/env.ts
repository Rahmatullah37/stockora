/**
 * Environment variable helpers.
 *
 * NEXT_PUBLIC_* variables are safe for the browser (they are protected by
 * Row Level Security in the database). The SUPABASE_SERVICE_ROLE_KEY must
 * NEVER be read in browser code — Phase 1 does not use it at all.
 */

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** True when the Supabase connection variables are filled in. */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey && url.startsWith("http"));
}

/** Same as getSupabaseEnv() but throws a helpful error when something is missing. */
export function requireSupabaseEnv() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}
