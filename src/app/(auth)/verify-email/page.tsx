import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const t = await getT();
  const { email } = await searchParams;

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MailCheck className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("auth.verify.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.verify.body", { email: email ?? "your email" })}
        </p>
        <p className="text-xs text-muted-foreground">{t("auth.verify.hint")}</p>
      </div>
      <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full" })}>
        {t("auth.verify.login")}
      </Link>
    </div>
  );
}
