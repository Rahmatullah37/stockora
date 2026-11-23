/**
 * TypeScript shapes of the business tables (Phase 2-5).
 * They mirror supabase/migrations/..._inventory_core.sql, _sales_purchases.sql,
 * _finance_reports.sql and _saas.sql.  Money/quantity columns arrive from Supabase as numbers.
 */

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "mobile_payment";
export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "card", "mobile_payment"];
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type ProductStatus = "active" | "inactive" | "archived";

export interface Category { id: string; shop_id: string; name: string; created_at: string }
export interface Brand { id: string; shop_id: string; name: string; created_at: string }
export interface Branch { id: string; shop_id: string; name: string; address: string | null; is_main: boolean }

export interface Supplier {
  id: string; shop_id: string; name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; is_active: boolean; created_at: string;
}
export interface Customer {
  id: string; shop_id: string; name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; is_active: boolean; created_at: string;
}
export interface PartyBalance {
  outstanding: number; total_purchases: number;
}
export interface CustomerBalance extends PartyBalance {
  shop_id: string; customer_id: string; sales_count: number; last_sale_at: string | null;
}
export interface SupplierBalance extends PartyBalance {
  shop_id: string; supplier_id: string; purchase_count: number; last_purchase_at: string | null;
}

export interface Product {
  id: string; shop_id: string; name: string; sku: string;
  category_id: string | null; brand_id: string | null; supplier_id: string | null;
  description: string | null; unit: string; image_path: string | null;
  selling_price: number; wholesale_price: number | null; min_selling_price: number | null;
  current_stock: number; min_stock_level: number; expiry_date: string | null;
  status: ProductStatus; created_at: string; updated_at: string;
}
/** Only readable with the finance.view permission. */
export interface ProductCost { product_id: string; purchase_price: number; avg_cost: number }
export interface ProductBarcode { id: string; product_id: string; barcode: string }
export interface ProductQrCode { product_id: string; code: string }

export type MovementType =
  | "opening" | "stock_in" | "stock_out" | "adjustment" | "damaged" | "expired"
  | "purchase" | "purchase_return" | "sale" | "sale_return" | "transfer";
export interface InventoryMovement {
  id: string; shop_id: string; product_id: string; movement_type: MovementType;
  quantity_change: number; stock_after: number; unit_cost: number | null; reason: string;
  reference_type: string | null; reference_id: string | null; created_by: string | null; created_at: string;
}
export interface StockTransfer {
  id: string; transfer_no: string; from_branch_id: string; to_branch_id: string; product_id: string;
  quantity: number; note: string | null; created_at: string;
}

export interface Sale {
  id: string; shop_id: string; invoice_no: string; customer_id: string | null; cashier_id: string | null;
  status: "completed" | "partially_returned" | "returned";
  subtotal: number; discount_amount: number; tax_rate: number; tax_amount: number; total: number;
  amount_paid: number; returned_value: number; refunded_amount: number; balance_due: number;
  payment_status: PaymentStatus; notes: string | null; sold_at: string;
}
export interface SaleItem {
  id: string; sale_id: string; product_id: string; product_name: string; sku: string; unit: string;
  quantity: number; unit_price: number; gross_amount: number; net_amount: number; tax_amount: number;
  returned_qty: number; returned_net: number; returned_tax: number;
}
export interface SalePayment {
  id: string; sale_id: string; method: PaymentMethod; amount: number; reference: string | null; paid_at: string;
}
export interface SalesReturn {
  id: string; return_no: string; sale_id: string; return_value: number; credit_applied: number;
  refund_amount: number; refund_method: PaymentMethod | null; reason: string; created_at: string;
}

export interface Purchase {
  id: string; shop_id: string; purchase_no: string; supplier_id: string; supplier_invoice: string | null;
  status: "ordered" | "received" | "cancelled";
  subtotal: number; discount_amount: number; additional_costs: number; total: number;
  amount_paid: number; returned_value: number; refunded_amount: number; balance_due: number;
  payment_status: PaymentStatus; notes: string | null; ordered_at: string; received_at: string | null;
}
export interface PurchaseItem {
  id: string; purchase_id: string; product_id: string; product_name: string; quantity: number;
  unit_price: number; line_total: number; net_amount: number; landed_unit_cost: number | null;
  returned_qty: number; returned_value: number;
}
export interface PurchasePayment {
  id: string; purchase_id: string; method: PaymentMethod; amount: number; reference: string | null; paid_at: string;
}

export type ExpenseCategory = "rent" | "electricity" | "salaries" | "transportation" | "other";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["rent", "electricity", "salaries", "transportation", "other"];
export interface Expense {
  id: string; category: ExpenseCategory; description: string; amount: number; expense_date: string;
  method: PaymentMethod; status: "active" | "void"; void_reason: string | null; created_at: string;
}
export interface FinancialTransaction {
  id: string; direction: "in" | "out"; category: string; amount: number; method: PaymentMethod | null;
  reference_type: string | null; reference_id: string | null; description: string | null; occurred_at: string;
}

/** Figures returned by report_profit_loss / _profit_figures */
export interface ProfitFigures {
  invoice_count: number; gross_sales: number; discounts: number; returns: number; net_revenue: number;
  tax_collected: number; cogs: number; gross_profit: number; expenses: number; stock_losses: number;
  net_profit: number; margin_pct: number; markup_pct: number;
}

export interface Role { id: string; key: string; name: string; description: string | null }
export interface PermissionRow { id: string; key: string; module: string; description: string | null }
export interface ShopMember {
  id: string; shop_id: string; user_id: string; role_id: string; status: "active" | "invited" | "disabled"; created_at: string;
}
export interface ShopInvitation {
  id: string; email: string; role_id: string; status: "pending" | "accepted" | "revoked"; created_at: string;
}
export interface PlanRow {
  id: string; key: string; name: string; description: string | null; price_monthly: number; price_yearly: number;
  currency: string; trial_days: number; max_products: number | null; max_employees: number | null;
  max_branches: number | null; features: string[]; feature_flags: string[]; is_active: boolean; sort_order: number;
}
export interface SubscriptionRow {
  id: string; shop_id: string; plan_id: string; status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  payment_status: "not_required" | "pending" | "paid" | "failed" | "refunded";
  trial_ends_at: string | null; current_period_start: string; current_period_end: string | null;
  canceled_at: string | null; created_at: string;
}
