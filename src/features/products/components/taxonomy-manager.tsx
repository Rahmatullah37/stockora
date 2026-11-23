"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import { createNamedAction, deleteNamedAction, renameNamedAction } from "../actions";

interface Item { id: string; name: string }

/** Add / rename / delete for categories or brands (they work the same way). */
export function TaxonomyManager({ kind, items, canEdit }: { kind: "category" | "brand"; items: Item[]; canEdit: boolean }) {
  const t = useT();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => { event.preventDefault(); run(() => createNamedAction(kind, newName), () => setNewName("")); }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("categories.addPlaceholder")} aria-label={t("categories.addPlaceholder")} maxLength={80} />
          <Button type="submit" loading={isPending} disabled={!newName.trim()}>{t("common.add")}</Button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("categories.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              {editingId === item.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" maxLength={80} aria-label={t("common.name")} />
                  <Button size="sm" aria-label={t("categories.rename")} loading={isPending}
                    onClick={() => run(() => renameNamedAction(kind, item.id, editName), () => setEditingId(null))}>
                    <Check className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={t("common.cancel")} onClick={() => setEditingId(null)}><X className="size-4" aria-hidden /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{item.name}</span>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" aria-label={t("common.edit")} onClick={() => { setEditingId(item.id); setEditName(item.name); }}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={t("common.delete")} disabled={isPending}
                        onClick={() => {
                          if (window.confirm(t("categories.deleteConfirm", { name: item.name }))) run(() => deleteNamedAction(kind, item.id));
                        }}>
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && items.length > 0 && <p className="text-xs text-muted-foreground">{t("categories.inUse", { kind: t(`categories.kind.${kind}`) })}</p>}
    </div>
  );
}
