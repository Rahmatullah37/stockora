import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "@/features/settings/components/account-form";
import { getAppContext } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  const t = await getT();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.account.title")}</CardTitle>
        <CardDescription>{t("settings.account.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AccountForm
          loginEmail={ctx.user.email}
          defaultValues={{
            fullName: ctx.profile.full_name,
            phone: ctx.profile.phone ?? "",
            preferredLanguage: ctx.profile.preferred_language,
          }}
        />
      </CardContent>
    </Card>
  );
}
