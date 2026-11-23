"use client";

import { useFormat } from "@/lib/format/provider";
import { useT } from "@/lib/i18n/provider";
import { summarizeProfit } from "@/lib/calculations/profit";

/**
 * Shows profit per unit, margin and markup while the prices are typed.
 * Margin (profit / selling price) and markup (profit / cost) are different numbers.
 */
export function ProfitPreview({ cost, price }: { cost: number | null; price: number | null }) {
  const t = useT();
  const { money, percent } = useFormat();

  if (cost === null || price === null || (cost === 0 && price === 0)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
        {t("products.profit.enterPrices")}
      </div>
    );
  }
  const { profit, margin, markup } = summarizeProfit(cost, price);
  const negative = profit < 0;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="mb-2 text-sm font-medium">{t("products.profit.title")}</p>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("products.profit.perUnit")}</dt>
          <dd className={negative ? "font-semibold text-danger" : "font-semibold text-success"}>{money(profit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("products.profit.margin")}</dt>
          <dd className="font-semibold">{percent(margin)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("products.profit.markup")}</dt>
          <dd className="font-semibold">{percent(markup)}</dd>
        </div>
      </dl>
      {negative && <p className="mt-2 text-xs text-danger">{t("products.profit.loss")}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{t("products.profit.hint")}</p>
    </div>
  );
}
