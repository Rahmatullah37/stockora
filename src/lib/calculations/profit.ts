/**
 * Profit calculations used by the product form and the product page.
 *
 *   Profit per unit = Selling price - Cost price
 *   Profit margin % = Profit per unit / Selling price x 100   (share of the PRICE that is profit)
 *   Markup %        = Profit per unit / Cost price x 100      (profit on top of the COST)
 *
 * Margin and markup are DIFFERENT numbers. Example: cost 500, price 650
 *   -> profit 150, margin 23.08 %, markup 30 %.
 */

/** Rounds to 2 decimals without the usual floating-point surprises (1.005 -> 1.01). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function profitPerUnit(costPrice: number, sellingPrice: number): number {
  return round2(sellingPrice - costPrice);
}

/** Returns 0 when the selling price is 0 (cannot divide by zero). */
export function marginPercent(costPrice: number, sellingPrice: number): number {
  if (!(sellingPrice > 0)) return 0;
  return round2(((sellingPrice - costPrice) / sellingPrice) * 100);
}

/** Returns 0 when the cost price is 0 (cannot divide by zero). */
export function markupPercent(costPrice: number, sellingPrice: number): number {
  if (!(costPrice > 0)) return 0;
  return round2(((sellingPrice - costPrice) / costPrice) * 100);
}

export interface ProfitSummary {
  profit: number;
  margin: number;
  markup: number;
}

export function summarizeProfit(costPrice: number, sellingPrice: number): ProfitSummary {
  return {
    profit: profitPerUnit(costPrice, sellingPrice),
    margin: marginPercent(costPrice, sellingPrice),
    markup: markupPercent(costPrice, sellingPrice),
  };
}
