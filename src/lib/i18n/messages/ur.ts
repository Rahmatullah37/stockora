import type { MessageKey } from "./en";

/**
 * Urdu (اردو) — partial translation. Missing keys fall back to English.
 * NOTE: please have a native Urdu speaker review these before launch.
 */
export const ur: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "ڈیش بورڈ",
  "nav.products": "مصنوعات",
  "nav.scanner": "کیو آر اسکینر",
  "nav.inventory": "انوینٹری",
  "nav.sales": "فروخت / پی او ایس",
  "nav.purchases": "خریداری",
  "nav.customers": "گاہک",
  "nav.suppliers": "سپلائرز",
  "nav.expenses": "اخراجات",
  "nav.reports": "رپورٹس",
  "nav.employees": "ملازمین",
  "nav.settings": "ترتیبات",
  "nav.soon": "جلد",

  "common.save": "تبدیلیاں محفوظ کریں",
  "common.saving": "محفوظ ہو رہا ہے…",
  "common.logout": "لاگ آؤٹ",
  "common.language": "زبان",
  "common.select": "منتخب کریں…",
  "common.optional": "(اختیاری)",
  "common.saved": "تبدیلیاں محفوظ ہو گئیں۔",

  "auth.login.title": "خوش آمدید",
  "auth.login.subtitle": "اپنی دکان کا نظم کرنے کے لیے لاگ اِن کریں۔",
  "auth.login.submit": "لاگ اِن",
  "auth.login.submitting": "لاگ اِن ہو رہا ہے…",
  "auth.login.forgot": "پاس ورڈ بھول گئے؟",
  "auth.login.noAccount": "Stockora پر نئے ہیں؟",
  "auth.login.createAccount": "دکان کا اکاؤنٹ بنائیں",

  "auth.register.title": "اپنی دکان کا اکاؤنٹ بنائیں",
  "auth.register.accountSection": "آپ کا اکاؤنٹ",
  "auth.register.shopSection": "آپ کی دکان",
  "auth.register.submit": "اکاؤنٹ بنائیں",
  "auth.register.haveAccount": "پہلے سے اکاؤنٹ ہے؟",
  "auth.register.loginLink": "لاگ اِن",

  "auth.field.fullName": "پورا نام",
  "auth.field.email": "ای میل ایڈریس",
  "auth.field.phone": "فون نمبر",
  "auth.field.password": "پاس ورڈ",
  "auth.field.confirmPassword": "پاس ورڈ کی تصدیق",
  "auth.field.shopName": "دکان کا نام",
  "auth.field.businessCategory": "کاروبار کی قسم",
  "auth.field.country": "ملک",
  "auth.field.currency": "کرنسی",
  "auth.field.address": "دکان کا پتہ",

  "dashboard.welcome": "خوش آمدید، {name}",
  "settings.title": "ترتیبات",
};
