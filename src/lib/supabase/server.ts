import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Supabase client for SERVER code (Server Components, Server Actions,
 * Route Handlers).
 *
 * It uses the logged-in user's session cookie, so every query runs AS THAT USER
 * and the database's Row Level Security rules apply automatically.
 * Create a new client for every request — do not store it in a global variable.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // setAll(cookiesToSet) {
      //   try {
      //     cookiesToSet.forEach(({ name, value, options }) =>
      //       cookieStore.set(name, value, options),
      //     );
      //   } catch {
      //     // Server Components cannot set cookies. This is fine: the proxy
      //     // (src/proxy.ts) refreshes the session cookie on every request.
      //   }
      // },

      setAll(cookiesToSet) {
  console.log(
    "[SERVER SET COOKIES]",
    cookiesToSet.map(({ name }) => name)
  );

  try {
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options),
    );

    console.log("[SERVER COOKIES SAVED]");
  } catch (error) {
    console.error("[SERVER COOKIE ERROR]", error);
  }
},
    },
  });
}
