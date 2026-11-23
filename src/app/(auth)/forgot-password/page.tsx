import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const t = await getT();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.forgot.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("auth.forgot.back")}
        </Link>
      </p>
    </div>
  );
}
