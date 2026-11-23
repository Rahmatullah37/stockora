import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * People arrive here from the link in the "reset password" email. The callback
 * route has already logged them in with a temporary session, and the proxy
 * keeps anyone without a session out of this page.
 */
export default async function ResetPasswordPage() {
  const t = await getT();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.reset.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
