import "server-only";
import { getAppContext, type AppContext } from "@/lib/auth/session";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

/** The logged-in context, guaranteed to have a shop. */
export type ShopContext = AppContext & {
  membership: NonNullable<AppContext["membership"]>;
};

export type GuardResult =
  | { ok: true; ctx: ShopContext }
  | { ok: false; error: string };

/**
 * Call this at the start of every Server Action that changes shop data.
 * It checks, ON THE SERVER, that the user is logged in, belongs to a shop and
 * has the needed permission. (The database re-checks this too via RLS.)
 */
export async function requireShopPermission(
  permission: PermissionKey,
  feature?: string,
): Promise<GuardResult> {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false, error: "Your session has expired. Please log in again." };
  if (!ctx.membership) return { ok: false, error: "Your account is not linked to a shop." };
  if (!ctx.membership.shop.is_active) {
    return { ok: false, error: "This shop is suspended." };
  }
  if (!hasPermission(ctx.membership.permissions, permission)) {
    return { ok: false, error: "You do not have permission to do this." };
  }
  if (feature && !ctx.membership.features.includes(feature)) {
    return { ok: false, error: "This feature is not included in your current plan." };
  }
  return { ok: true, ctx: ctx as ShopContext };
}

/**
 * Convenience for Server Actions: checks permission (and optional plan feature)
 * and returns a ready Supabase client + the shop id.
 *
 *   const g = await actionContext(PERMISSIONS.productsManage);
 *   if (!g.ok) return { error: g.error };
 *   const { data, error } = await g.supabase.rpc("create_product", { p_shop_id: g.shopId, ... });
 */
export async function actionContext(permission: PermissionKey, feature?: string) {
  const guard = await requireShopPermission(permission, feature);
  if (!guard.ok) return guard;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return { ok: true as const, ctx: guard.ctx, shopId: guard.ctx.membership.shop.id, supabase };
}
