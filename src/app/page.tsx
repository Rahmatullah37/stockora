import { redirect } from "next/navigation";

/**
 * The home address "/" has no content of its own.
 * Logged-in users go to the dashboard; the proxy sends everyone else to /login.
 */
export default function HomePage() {
  redirect("/dashboard");
}
