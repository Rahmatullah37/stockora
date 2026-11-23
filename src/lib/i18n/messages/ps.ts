import type { MessageKey } from "./en";

/**
 * Pashto (پښتو) — partial translation. Missing keys fall back to English.
 * NOTE: please have a native Pashto speaker review these before launch.
 */
export const ps: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "ډشبورډ",
  "nav.products": "محصولات",
  "nav.scanner": "کیو آر سکینر",
  "nav.inventory": "موجودي",
  "nav.sales": "پلور",
  "nav.purchases": "پیرود",
  "nav.customers": "پیرودونکي",
  "nav.suppliers": "عرضه کوونکي",
  "nav.expenses": "لګښتونه",
  "nav.reports": "راپورونه",
  "nav.employees": "کارمندان",
  "nav.settings": "ترتیبات",
  "nav.soon": "ژر",

  "common.save": "بدلونونه خوندي کړئ",
  "common.saving": "خوندي کیږي…",
  "common.logout": "وتل",
  "common.language": "ژبه",
  "common.select": "غوره کړئ…",
  "common.optional": "(اختیاري)",
  "common.saved": "بدلونونه خوندي شول.",

  "auth.login.title": "ښه راغلاست",
  "auth.login.subtitle": "د خپل دوکان د اداره کولو لپاره ننوځئ.",
  "auth.login.submit": "ننوتل",
  "auth.login.submitting": "ننوځي…",
  "auth.login.forgot": "پټنوم مو هیر دی؟",
  "auth.login.noAccount": "په Stockora کې نوي یاست؟",
  "auth.login.createAccount": "د دوکان حساب جوړ کړئ",

  "auth.register.title": "خپل د دوکان حساب جوړ کړئ",
  "auth.register.accountSection": "ستاسو حساب",
  "auth.register.shopSection": "ستاسو دوکان",
  "auth.register.submit": "حساب جوړ کړئ",
  "auth.register.haveAccount": "مخکې حساب لرئ؟",
  "auth.register.loginLink": "ننوتل",

  "auth.field.fullName": "بشپړ نوم",
  "auth.field.email": "بریښنالیک",
  "auth.field.phone": "د تلیفون شمېره",
  "auth.field.password": "پټنوم",
  "auth.field.confirmPassword": "د پټنوم تایید",
  "auth.field.shopName": "د دوکان نوم",
  "auth.field.businessCategory": "د کاروبار ډول",
  "auth.field.country": "هیواد",
  "auth.field.currency": "اسعار",
  "auth.field.address": "د دوکان پته",

  "dashboard.welcome": "ښه راغلاست، {name}",
  "settings.title": "ترتیبات",
};
