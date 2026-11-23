import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import type { MessageKey } from "@/lib/i18n";

export interface NavItem {
  href: string;
  /** Translation key for the label (see src/lib/i18n/messages/en.ts) */
  labelKey: MessageKey;
  icon: LucideIcon;
  /** Permission needed to see this item. null = everyone. */
  permission: PermissionKey | null;
  /** Plan feature needed (see subscription_plans.feature_flags). Pages show an upgrade notice when missing. */
  feature?: string;
  /**
   * false = the page is not built yet. The menu shows the item greyed out with
   * a "Soon" badge instead of a link that leads nowhere.
   * Set it to true when you build the module.
   */
  ready: boolean;
}

/** The main navigation, in the order from the product specification. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: null, ready: true },
  { href: "/products", labelKey: "nav.products", icon: Package, permission: PERMISSIONS.productsView, ready: true },
  { href: "/scanner", labelKey: "nav.scanner", icon: QrCode, permission: PERMISSIONS.productsView, feature: "scanner", ready: true },
  { href: "/inventory", labelKey: "nav.inventory", icon: Boxes, permission: PERMISSIONS.inventoryView, ready: true },
  { href: "/sales", labelKey: "nav.sales", icon: ShoppingCart, permission: PERMISSIONS.salesView, ready: true },
  { href: "/purchases", labelKey: "nav.purchases", icon: Receipt, permission: PERMISSIONS.purchasesView, ready: true },
  { href: "/customers", labelKey: "nav.customers", icon: Users, permission: PERMISSIONS.customersView, ready: true },
  { href: "/suppliers", labelKey: "nav.suppliers", icon: Truck, permission: PERMISSIONS.suppliersView, ready: true },
  { href: "/expenses", labelKey: "nav.expenses", icon: Wallet, permission: PERMISSIONS.expensesView, ready: true },
  { href: "/reports", labelKey: "nav.reports", icon: BarChart3, permission: PERMISSIONS.reportsView, feature: "basic_reports", ready: true },
  { href: "/employees", labelKey: "nav.employees", icon: UserCog, permission: PERMISSIONS.employeesView, feature: "employees", ready: true },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, permission: PERMISSIONS.settingsView, ready: true },
];

/** Shown only to the platform Super Admin. */
export const ADMIN_NAV_ITEM = {
  href: "/admin",
  labelKey: "nav.admin" as MessageKey,
  icon: ShieldCheck,
};
