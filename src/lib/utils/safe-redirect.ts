/**
 * Makes sure a "go here after login" path stays inside our own website.
 * Without this check an attacker could craft a login link that sends users to
 * a malicious site after they log in (an "open redirect").
 */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!path) return fallback;
  // Must start with a single "/" (not "//evil.com" and not "/\evil.com").
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}
