import { financeEn } from "./finance.en";
import { inventoryEn } from "./inventory.en";
import { partiesEn } from "./parties.en";
import { productsEn } from "./products.en";
import { purchasesEn } from "./purchases.en";
import { saasEn } from "./saas.en";
import { salesEn } from "./sales.en";

/**
 * English text — the MASTER list of translation keys.
 * Add a new key here first, then (optionally) translate it in ur.ts / ps.ts.
 * Use {name}-style placeholders for values that change.
 */
export const en = {
  // ---- Navigation ----
  "nav.dashboard": "Dashboard",
  "nav.products": "Products",
  "nav.scanner": "QR Scanner",
  "nav.inventory": "Inventory",
  "nav.sales": "Sales / POS",
  "nav.purchases": "Purchases",
  "nav.customers": "Customers",
  "nav.suppliers": "Suppliers",
  "nav.expenses": "Expenses",
  "nav.reports": "Reports",
  "nav.employees": "Employees",
  "nav.settings": "Settings",
  "nav.admin": "Platform admin",
  "nav.lockedHint": "Not in your plan",
  "nav.soon": "Soon",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",

  // ---- Common ----
  "common.save": "Save changes",
  "common.saving": "Saving…",
  "common.logout": "Log out",
  "common.language": "Language",
  "common.select": "Select…",
  "common.optional": "(optional)",
  "common.saved": "Changes saved.",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.create": "Create",
  "common.search": "Search…",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.date": "Date",
  "common.total": "Total",
  "common.notes": "Notes",
  "common.name": "Name",
  "common.phone": "Phone",
  "common.email": "Email",
  "common.address": "Address",
  "common.back": "Back",
  "common.print": "Print",
  "common.exportCsv": "Export CSV",
  "common.yes": "Yes",
  "common.no": "No",
  "common.loading": "Loading…",
  "common.noResults": "Nothing found.",
  "common.all": "All",
  "common.confirmDelete": "Are you sure? This cannot be undone.",
  "common.upgradeTitle": "Not included in your plan",
  "common.upgradeBody": "{feature} is not part of your current plan. Ask the shop owner to upgrade in Settings → Subscription.",
  "common.noPermission": "You do not have permission to open this page.",
  "common.from": "From",
  "common.to": "To",
  "common.apply": "Apply",
  "common.previous": "Previous",
  "common.next": "Next",
  "common.page": "Page {page}",

  // ---- Log in ----
  "auth.login.title": "Welcome back",
  "auth.login.subtitle": "Log in to manage your shop.",
  "auth.login.submit": "Log in",
  "auth.login.submitting": "Logging in…",
  "auth.login.forgot": "Forgot password?",
  "auth.login.noAccount": "New to Stockora?",
  "auth.login.createAccount": "Create a shop account",
  "auth.login.callbackError":
    "We could not complete the verification in this browser. If you already verified your email, just log in.",

  // ---- Register ----
  "auth.register.title": "Create your shop account",
  "auth.register.subtitle": "Set up your shop in a minute.",
  "auth.register.accountSection": "Your account",
  "auth.register.shopSection": "Your shop",
  "auth.register.submit": "Create account",
  "auth.register.submitting": "Creating account…",
  "auth.register.haveAccount": "Already have an account?",
  "auth.register.loginLink": "Log in",

  // ---- Form fields shared by several screens ----
  "auth.field.fullName": "Full name",
  "auth.field.email": "Email address",
  "auth.field.phone": "Phone number",
  "auth.field.password": "Password",
  "auth.field.confirmPassword": "Confirm password",
  "auth.field.newPassword": "New password",
  "auth.field.passwordHint": "At least 8 characters.",
  "auth.field.shopName": "Shop name",
  "auth.field.businessCategory": "Business category",
  "auth.field.country": "Country",
  "auth.field.currency": "Currency",
  "auth.field.address": "Shop address",

  // ---- Forgot / reset password ----
  "auth.forgot.title": "Reset your password",
  "auth.forgot.subtitle": "Enter your email and we will send you a reset link.",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.submitting": "Sending…",
  "auth.forgot.success":
    "If an account exists for that email, a reset link is on its way. Check your inbox.",
  "auth.forgot.back": "Back to log in",
  "auth.reset.title": "Choose a new password",
  "auth.reset.subtitle": "Pick a strong password you have not used before.",
  "auth.reset.submit": "Update password",
  "auth.reset.submitting": "Updating…",

  // ---- Verify email ----
  "auth.verify.title": "Check your email",
  "auth.verify.body":
    "We sent a verification link to {email}. Open it to activate your account, then log in.",
  "auth.verify.hint": "Did not get it? Check your spam folder.",
  "auth.verify.login": "Go to log in",

  // ---- Dashboard ----
  "dashboard.welcome": "Welcome back, {name}",
  "dashboard.subtitle": "Here is your shop at a glance.",
  "dashboard.shopCard": "Your shop",
  "dashboard.planCard": "Subscription",
  "dashboard.accessCard": "Your access",
  "dashboard.nextCard": "What is coming next",
  "dashboard.nextBody":
    "Products, QR scanning, POS, purchases and reports are built in the next phases. Their live figures will appear on this dashboard as soon as those modules exist.",
  "dashboard.field.category": "Category",
  "dashboard.field.country": "Country",
  "dashboard.field.currency": "Currency",
  "dashboard.field.address": "Address",
  "dashboard.field.registered": "Registered on",
  "dashboard.field.plan": "Plan",
  "dashboard.field.status": "Status",
  "dashboard.field.products": "Product limit",
  "dashboard.field.staff": "Staff accounts",
  "dashboard.field.branches": "Branches",
  "dashboard.field.unlimited": "Unlimited",
  "dashboard.field.role": "Your role",
  "dashboard.field.permissions": "Permissions",

  // ---- Settings ----
  "settings.title": "Settings",
  "settings.subtitle": "Manage your shop and your account.",
  "settings.tab.shop": "Shop profile",
  "settings.tab.regional": "Regional & tax",
  "settings.tab.account": "My account",
  "settings.shop.title": "Shop profile",
  "settings.shop.subtitle": "Basic details about your business.",
  "settings.regional.title": "Regional & tax",
  "settings.regional.subtitle":
    "Currency, time zone, date format, language and tax for your shop.",
  "settings.account.title": "My account",
  "settings.account.subtitle": "Your personal details and language.",
  "settings.field.shopEmail": "Shop email",
  "settings.field.timezone": "Time zone",
  "settings.field.dateFormat": "Date format",
  "settings.field.language": "Shop default language",
  "settings.field.taxEnabled": "Charge tax on sales",
  "settings.field.taxName": "Tax name",
  "settings.field.taxRate": "Tax rate (%)",
  "settings.field.myLanguage": "My language",
  "settings.field.loginEmail": "Login email",
  "settings.hint.currency":
    "Changing the currency does not convert amounts that are already recorded.",
  "settings.readOnly":
    "You can view these settings, but only the shop owner can change them.",

  // ---- Status pages ----
  "error.title": "Something went wrong",
  "error.body": "An unexpected error happened. Please try again.",
  "error.retry": "Try again",
  "noShop.title": "No shop found",
  "noShop.body":
    "Your account is not linked to a shop yet. Ask the shop owner to add you, or log in with a different account.",
  "suspended.title": "This shop is suspended",
  "suspended.body":
    "Access to this shop has been paused. Please contact Stockora support.",

  // ---- Module texts (one file per module, see ./*.en.ts) ----
  ...productsEn,
  ...inventoryEn,
  ...salesEn,
  ...purchasesEn,
  ...partiesEn,
  ...financeEn,
  ...saasEn,
} as const;

/** Every valid translation key. TypeScript will flag typos. */
export type MessageKey = keyof typeof en;
