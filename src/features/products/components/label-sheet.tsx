"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/lib/format/provider";
import { useT } from "@/lib/i18n/provider";
import { QrImage } from "./qr-image";

export interface LabelProduct { id: string; name: string; sku: string; sellingPrice: number; qrCode: string }

/**
 * Printable QR labels. The QR text is "STK:<code>": a permanent code, never the price,
 * so changing a price does not make a printed label wrong (the price printed in
 * words can be switched off).
 */
export function LabelSheet({ shopName, products }: { shopName: string; products: LabelProduct[] }) {
  const t = useT();
  const { money } = useFormat();
  const [showPrice, setShowPrice] = useState(false);
  const [copies, setCopies] = useState(1);
  const safeCopies = Math.min(Math.max(Math.floor(copies) || 1, 1), 20);

  const labels = products.flatMap((p) => Array.from({ length: safeCopies }, (_, i) => ({ ...p, key: `${p.id}-${i}` })));

  return (
    <div>
      {/* Hide the app menu and top bar when printing, and print only the labels. */}
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          {t("products.labels.showPrice")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t("products.labels.copies")}
          <Input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="h-9 w-20" />
        </label>
        <Button type="button" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> {t("products.labels.print")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        {labels.map((label) => (
          <div key={label.key} className="break-inside-avoid rounded-lg border border-border bg-white p-3 text-center text-black">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide">{shopName}</p>
            <p className="mt-1 line-clamp-2 min-h-8 text-xs font-medium leading-4">{label.name}</p>
            <div className="mt-1 flex justify-center">
              <QrImage text={`STK:${label.qrCode}`} size={110} alt={`QR ${label.name}`} />
            </div>
            <p className="mt-1 text-[11px]">{label.sku}</p>
            {showPrice && <p className="text-sm font-bold">{money(label.sellingPrice)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
