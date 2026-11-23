/**
 * TypeScript shapes of the database rows used in Phase 1.
 * They mirror supabase/migrations/..._foundation.sql.
 *
 * (Later we can generate these automatically with the Supabase CLI:
 *  `npx supabase gen types typescript`. For now they are written by hand
 *  so the project stays easy to read.)
 */

import type { Locale } from "@/lib/i18n/config";

export type { Locale };

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: Locale;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string;
  address: string | null;
  currency: string;
  business_category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopSettings {
  shop_id: string;
  language: Locale;
  date_format: string;
  timezone: string;
  tax_enabled: boolean;
  tax_name: string;
  tax_rate: number;
  costing_method: "weighted_average";
}

export interface SubscriptionPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  max_products: number | null;
  max_employees: number | null;
  max_branches: number | null;
  features: string[];
  feature_flags: string[];
}

export interface Subscription {
  id: string;
  shop_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  payment_status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan: SubscriptionPlan | null;
}
