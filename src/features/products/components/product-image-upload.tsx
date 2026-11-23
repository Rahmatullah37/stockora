"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Uploads a product photo straight to Supabase Storage (bucket "product-images",
 * folder = shop id). Storage rules only allow people with products.manage to
 * write inside their own shop folder. The saved path goes to the form.
 */
export function ProductImageUpload({
  shopId, value, onChange,
}: { shopId: string; value: string; onChange: (path: string) => void }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicUrl = value
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${value}`
    : null;

  async function handleFile(file: File) {
    setError(null);
    const extension = TYPES[file.type];
    if (!extension) return setError(t("products.image.wrongType"));
    if (file.size > MAX_BYTES) return setError(t("products.image.tooBig"));
    setUploading(true);
    const path = `${shopId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await createClient().storage
      .from("product-images").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (uploadError) return setError(t("products.image.failed"));
    onChange(path);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-image"
            onChange={(event) => { const f = event.target.files?.[0]; if (f) void handleFile(f); event.target.value = ""; }}
          />
          <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? t("products.image.uploading") : value ? t("products.image.change") : t("products.image.upload")}
          </Button>
          {value && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>{t("products.image.remove")}</Button>
          )}
          <p className="text-xs text-muted-foreground">{t("products.field.imageHint")}</p>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
