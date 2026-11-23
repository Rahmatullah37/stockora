import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * "Proxy" (called "middleware" in older Next.js versions) runs before every
 * page request. We use it to:
 *   1. Send you to /setup if the Supabase environment variables are missing.
 *   2. Keep the login session fresh.
 *   3. Redirect logged-out visitors to /login, and logged-in users away from
 *      the login/register pages.
 */

// Pages anyone can open without logging in.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/auth/callback",
];
// Pages that only make sense for logged-out visitors.
const LOGGED_OUT_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Missing configuration -> show the setup guide.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  if (pathname === "/setup") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Refresh the session and find out who is visiting.
  const { response, isLoggedIn } = await updateSession(request);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  // 3a. Logged out and the page is private -> go to login (remember where we were going).
  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return redirectKeepingCookies(loginUrl, response);
  }

  // 3b. Logged in but opening login/register -> go to the dashboard.
  if (isLoggedIn && LOGGED_OUT_ONLY_PATHS.includes(pathname)) {
    return redirectKeepingCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

/** A redirect that still carries the refreshed session cookies. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Run on every route except static files and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
