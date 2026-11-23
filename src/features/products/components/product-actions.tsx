"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useT } from "@/lib/i18n/provider";
import { deleteProductAction, setProductStatusAction } from "../actions";

/** Archive / reactivate / delete buttons on the product page. */
export function ProductActions({ productId, status }: { productId: string; status: string }) {
  const t = useT();
  const archived = status === "archived";
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ConfirmButton
        variant="outline" size="sm"
        confirmText={archived ? t("products.detail.unarchive") + "?" : t("products.detail.archiveConfirm")}
        action={() => setProductStatusAction(productId, archived ? "active" : "archived")}
      >
        {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {archived ? t("products.detail.unarchive") : t("products.detail.archive")}
      </ConfirmButton>
      <ConfirmButton
        variant="danger" size="sm" confirmText={t("products.detail.deleteConfirm")}
        action={() => deleteProductAction(productId)}
      >
        <Trash2 className="size-4" aria-hidden /> {t("common.delete")}
      </ConfirmButton>
    </div>
  );
}
