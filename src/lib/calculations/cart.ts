/**
 * Cart math for the POS screen — a PREVIEW only.
 *
 * The browser never sends prices or totals to the server. The database function
 * complete_sale() recalculates every number from the product table. These helpers
 * only let the cashier see the expected total while building the cart.
 * (Tax is shown on the net amount after discount; the database rounds per line, so
 * a difference of a cent is possible — the invoice always shows the official figures.)
 */

export type DiscountType = "none" | "amount" | "percent";
export type PriceType = "retail" | "wholesale";

export interface CartLinePreview {
  unitPrice: number;
  quantity: number;
}

/** Rounds to 2 decimals, avoiding floating point surprises like 1.005 -> 1. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineAmount(line: CartLinePreview): number {
  return round2(line.unitPrice * line.quantity);
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  netAmount: number;
  tax: number;
  total: number;
}

export function calculateCartTotals(
  lines: CartLinePreview[],
  discountType: DiscountType,
  discountValue: number,
  taxEnabled: boolean,
  taxRate: number,
): CartTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineAmount(line), 0));

  let discount = 0;
  if (discountType === "amount") discount = Math.min(Math.max(discountValue, 0), subtotal);
  if (discountType === "percent") discount = round2((subtotal * Math.min(Math.max(discountValue, 0), 100)) / 100);
  discount = round2(discount);

  const netAmount = round2(subtotal - discount);
  const tax = taxEnabled ? round2((netAmount * taxRate) / 100) : 0;
  return { subtotal, discount, netAmount, tax, total: round2(netAmount + tax) };
}

export interface PaymentPreview {
  paid: number;       // everything the customer hands over
  change: number;     // cash handed back (only cash can have change)
  recorded: number;   // what is really recorded as paid (never more than the total)
  balanceDue: number; // what stays as customer credit
}

export function calculatePayments(
  total: number,
  payments: { method: string; amount: number }[],
): PaymentPreview {
  const paid = round2(payments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0));
  const cash = round2(payments.filter((p) => p.method === "cash").reduce((s, p) => s + Math.max(p.amount, 0), 0));
  const over = Math.max(0, round2(paid - total));
  const change = Math.min(over, cash);
  const recorded = round2(paid - change);
  return { paid, change, recorded, balanceDue: Math.max(0, round2(total - recorded)) };
}

/**
 * Split of a return between "reduces what the customer still owes" and "money handed back".
 * Same rule as the database: first cancel the unpaid balance, refund the rest.
 */
export function splitReturnValue(returnValue: number, balanceDue: number) {
  const credit = Math.min(Math.max(balanceDue, 0), returnValue);
  return { credit: round2(credit), refund: round2(returnValue - credit) };
}
