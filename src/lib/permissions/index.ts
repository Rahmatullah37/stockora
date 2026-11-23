/**
 * Permission keys. They must match the `permissions` table in the database
 * (supabase/migrations/..._reference_data.sql).
 *
 * The database is the real gatekeeper (Row Level Security). These keys let the
 * app also check permissions on the server and hide menu items that a user
 * could not use anyway.
 */
export const PERMISSIONS = {
  productsView: "products.view",
  productsManage: "products.manage",
  inventoryView: "inventory.view",
  inventoryAdjust: "inventory.adjust",
  salesView: "sales.view",
  salesCreate: "sales.create",
  salesRefund: "sales.refund",
  purchasesView: "purchases.view",
  purchasesManage: "purchases.manage",
  customersView: "customers.view",
  customersManage: "customers.manage",
  suppliersView: "suppliers.view",
  suppliersManage: "suppliers.manage",
  expensesView: "expenses.view",
  expensesManage: "expenses.manage",
  reportsView: "reports.view",
  financeView: "finance.view",
  employeesView: "employees.view",
  employeesManage: "employees.manage",
  settingsView: "settings.view",
  settingsManage: "settings.manage",
  auditView: "audit.view",
  subscriptionManage: "subscription.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Does this list of permission keys include the one we need? */
export function hasPermission(
  permissions: readonly string[],
  needed: PermissionKey,
): boolean {
  return permissions.includes(needed);
}
