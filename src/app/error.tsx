"use client";

import { TriangleAlert } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/** Shown when something unexpected fails while loading a page. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <StatusScreen icon={TriangleAlert} title={t("error.title")} description={t("error.body")}>
      {error.digest && (
        <p className="text-xs text-muted-foreground" dir="ltr">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={reset}>{t("error.retry")}</Button>
    </StatusScreen>
  );
}
