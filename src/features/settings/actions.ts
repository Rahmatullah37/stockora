"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { ActionResult } from "@/hooks/use-form-action";
import { requireShopPermission } from "@/lib/auth/guards";
import { getAppContext } from "@/lib/auth/session";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  accountSchema,
  regionalSettingsSchema,
  shopProfileSchema,
  type AccountInput,
  type RegionalSettingsInput,
  type ShopProfileInput,
} from "@/lib/validations/settings";

/**
 * Server Actions for the Settings pages.
 * Pattern used by every action:
 *   1. validate the input (Zod)  2. check permission on the server
 *   3. save through Supabase (the database re-checks permission with RLS).
 */

const FORM_INVALID = "Please check the form and try again.";
const NOT_ALLOWED = "You do not have permission to change this.";
const SAVE_FAILED = "Could not save your changes. Please try again.";

export async function updateShopProfileAction(
  values: ShopProfileInput,
): Promise<ActionResult> {
  const parsed = shopProfileSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const guard = await requireShopPermission(PERMISSIONS.settingsManage);
  if (!guard.ok) return { error: guard.error };

  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .update({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address,
      business_category: input.businessCategory,
    })
    .eq("id", guard.ctx.membership.shop.id)
    .select("id");

  if (error) return { error: SAVE_FAILED };
  // RLS silently skips rows you may not change, so "0 rows updated" means "not allowed".
  if (!data || data.length === 0) return { error: NOT_ALLOWED };

  revalidatePath("/", "layout");
  return { success: "saved" };
}

export async function updateRegionalSettingsAction(
  values: RegionalSettingsInput,
): Promise<ActionResult> {
  const parsed = regionalSettingsSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const guard = await requireShopPermission(PERMISSIONS.settingsManage);
  if (!guard.ok) return { error: guard.error };

  const input = parsed.data;
  const supabase = await createClient();
  // One database function updates both tables in a single transaction
  // (see migration ..._0003_regional_settings_function.sql).
  const { error } = await supabase.rpc("update_shop_regional_settings", {
    p_shop_id: guard.ctx.membership.shop.id,
    p_country: input.country,
    p_currency: input.currency,
    p_timezone: input.timezone,
    p_date_format: input.dateFormat,
    p_language: input.language,
    p_tax_enabled: input.taxEnabled,
    p_tax_name: input.taxName,
    p_tax_rate: input.taxRate,
  });

  if (error) {
    return { error: error.message.includes("not_allowed") ? NOT_ALLOWED : SAVE_FAILED };
  }

  revalidatePath("/", "layout");
  return { success: "saved" };
}

export async function updateAccountAction(values: AccountInput): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const ctx = await getAppContext();
  if (!ctx) return { error: "Your session has expired. Please log in again." };

  const input = parsed.data;
  const supabase = await createClient();
  // Users may only update their own profile (RLS + column privileges).
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      phone: input.phone || null,
      preferred_language: input.preferredLanguage,
    })
    .eq("id", ctx.user.id)
    .select("id");

  if (error || !data || data.length === 0) return { error: SAVE_FAILED };

  // Apply the new language right away.
  (await cookies()).set(LOCALE_COOKIE, input.preferredLanguage, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { success: "saved" };
}
