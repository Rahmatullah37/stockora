import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

/**
 * Where the links in Supabase emails (verify email, reset password) land.
 * Supabase adds a one-time `code` to the address; we exchange it for a login
 * session, then send the user on to the page they were heading to.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // The link is invalid, expired, or was opened in a different browser than the
  // one used to sign up (the login "code verifier" lives in that browser).
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
