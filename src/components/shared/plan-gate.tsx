import { Lock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import type { AppContext } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/permissions";

/**
 * Use at the top of a page:
 *
 *   const gate = await checkAccess(ctx, { permission: PERMISSIONS.reportsView, feature: "basic_reports", featureLabel: "Reports" });
 *   if (gate) return gate;
 *
 * It returns a ready-made "no permission" or "upgrade your plan" screen,
 * or null when the user may continue.
 */
export async function checkAccess(
  ctx: AppContext | null,
  options: { permission?: PermissionKey; feature?: string; featureLabel?: string },
) {
  const membership = ctx?.membership;
  if (!ctx || !membership) return <div />;
  const t = await getT();

  if (options.permission && !membership.permissions.includes(options.permission)) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("common.noPermission")}</p>
      </div>
    );
  }
  if (options.feature && !membership.features.includes(options.feature)) {
    return (
      <>
        <PageHeader title={options.featureLabel ?? options.feature} />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Lock className="size-6" aria-hidden />
          </span>
          <h2 className="font-semibold">{t("common.upgradeTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("common.upgradeBody", { feature: options.featureLabel ?? options.feature })}
          </p>
          <Link href="/settings/subscription" className={buttonVariants({ variant: "primary" })}>
            Subscription
          </Link>
        </div>
      </>
    );
  }
  return null;
}
