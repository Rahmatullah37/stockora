import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Create your shop account" };

export default async function RegisterPage() {
  const t = await getT();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.register.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.register.subtitle")}</p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.register.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("auth.register.loginLink")}
        </Link>
      </p>
    </div>
  );
}
