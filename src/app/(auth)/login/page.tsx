import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "@/features/auth/components/login-form";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const t = await getT();
  const { next, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>

      {error === "callback" && <Alert variant="info">{t("auth.login.callbackError")}</Alert>}

      <LoginForm next={next} />

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.login.noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t("auth.login.createAccount")}
        </Link>
      </p>
    </div>
  );
}
