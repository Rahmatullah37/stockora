import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { getT } from "@/lib/i18n/server";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <SettingsTabs />
      {children}
    </div>
  );
}
