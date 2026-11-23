import { z } from "zod";
import { BUSINESS_CATEGORY_KEYS } from "@/config/business-categories";
import {
  DATE_FORMATS,
  isCountryCode,
  isCurrencyCode,
  isTimezone,
} from "@/config/regional";
import { locales } from "@/lib/i18n/config";

/** Validation rules for the Settings pages (shop profile, regional, account). */

export const shopProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name").max(120),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long")
    .regex(/^(\+?[0-9\s-]*)$/, "Use digits only, e.g. +92 300 1234567"),
  address: z.string().trim().min(3, "Enter the shop address").max(300),
  businessCategory: z.enum(BUSINESS_CATEGORY_KEYS, "Choose a business category"),
});

export const regionalSettingsSchema = z.object({
  country: z.string().refine(isCountryCode, "Choose a country"),
  currency: z.string().refine(isCurrencyCode, "Choose a currency"),
  timezone: z.string().refine(isTimezone, "Choose a time zone"),
  dateFormat: z.enum(DATE_FORMATS, "Choose a date format"),
  language: z.enum(locales, "Choose a language"),
  taxEnabled: z.boolean(),
  taxName: z.string().trim().min(1, "Enter a tax name").max(30),
  taxRate: z
    .number("Enter a number")
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot be more than 100"),
});

export const accountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long")
    .regex(/^(\+?[0-9\s-]*)$/, "Use digits only, e.g. +92 300 1234567"),
  preferredLanguage: z.enum(locales, "Choose a language"),
});

export type ShopProfileInput = z.infer<typeof shopProfileSchema>;
export type RegionalSettingsInput = z.infer<typeof regionalSettingsSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
