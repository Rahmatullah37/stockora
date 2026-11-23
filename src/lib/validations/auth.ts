import { z } from "zod";
import { BUSINESS_CATEGORY_KEYS } from "@/config/business-categories";
import { isCountryCode, isCurrencyCode } from "@/config/regional";

/**
 * Validation rules for the authentication forms.
 * The SAME schemas run in the browser (instant feedback) and again on the
 * server (the real protection — never trust the browser).
 */

const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .pipe(z.email("Enter a valid email address"));

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    // Account owner
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email: emailField,
    phone: z
      .string()
      .trim()
      .min(6, "Enter a valid phone number")
      .max(20, "Phone number is too long")
      .regex(/^\+?[0-9\s-]+$/, "Use digits only, e.g. +92 300 1234567"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your password"),
    // Shop
    shopName: z.string().trim().min(2, "Enter your shop name").max(120),
    businessCategory: z.enum(BUSINESS_CATEGORY_KEYS, "Choose a business category"),
    country: z.string().refine(isCountryCode, "Choose your country"),
    currency: z.string().refine(isCurrencyCode, "Choose your currency"),
    address: z.string().trim().min(3, "Enter the shop address").max(300),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
