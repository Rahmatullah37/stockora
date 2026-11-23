import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie and tells us whether a user is logged in.
 * Called from src/proxy.ts on every page request.
 *
 * It uses getClaims(), which verifies the login token's signature, so a forged
 * cookie is rejected. (Real authorization still happens again in the server
 * code and in the database — the proxy is only a fast first check.)
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = requireSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // const { data } = await supabase.auth.getClaims();
  
  const { data, error } = await supabase.auth.getClaims();

console.log("[SUPABASE SESSION CHECK]", {
  hasClaims: Boolean(data?.claims),
  error: error
    ? {
        name: error.name,
        code: error.code,
        message: error.message,
      }
    : null,
});

  const isLoggedIn = Boolean(data?.claims);
console.log("[PROXY COOKIE NAMES]", 
  request.cookies
    .getAll()
    .map((cookie) => cookie.name)
);
  return { response, isLoggedIn };
}
