import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Profile,
  Shop,
  ShopSettings,
  Subscription,
  SubscriptionPlan,
} from "@/types/database";

/** Everything the app needs to know about the current user and their shop. */
export interface AppContext {
  user: { id: string; email: string };
  profile: Profile;
  /** null when the user does not belong to any shop yet. */
  membership: {
    shop: Shop;
    settings: ShopSettings | null;
    subscription: Subscription | null;
    role: { key: string; name: string };
    /** Permission keys like "products.manage" (includes this shop's custom overrides) */
    permissions: string[];
    /** Plan features, e.g. "scanner", "branches" (empty when the plan has none / expired) */
    features: string[];
  } | null;
  /** Every shop this user belongs to (for the shop switcher). */
  shops: { id: string; name: string }[];
}

/** Cookie that remembers which of the user's shops is currently open. */
export const ACTIVE_SHOP_COOKIE = "stockora_shop";

// Shape returned by the membership query below.
interface MembershipRow {
  roles: { key: string; name: string } | null;
  shops: Shop | null;
}

/**
 * Loads the logged-in user, their profile, shop, role and permissions.
 * Returns null when nobody is logged in.
 *
 * `cache()` means that if the layout AND the page both call this during the
 * same request, the database is only queried once.
 *
 * Security: we use getUser(), which asks the Supabase Auth server to confirm
 * the login — we never trust the cookie alone.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const user = userData.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    throw new Error("Could not load your profile. Please try again.");
  }

  // A user may belong to several shops. The cookie says which one is open;
  // without it (or if it is stale) we use the oldest membership.
  const { data: memberships, error: membershipError } = await supabase
    .from("shop_members")
    .select("roles(key, name), shops(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .overrideTypes<MembershipRow[], { merge: false }>();
  if (membershipError) {
    throw new Error("Could not load your shop. Please try again.");
  }

  const valid = (memberships ?? []).filter((m) => m.shops && m.roles);
  const shops = valid.map((m) => ({ id: m.shops!.id, name: m.shops!.name }));
  const wantedShopId = (await cookies()).get(ACTIVE_SHOP_COOKIE)?.value;
  const row = valid.find((m) => m.shops!.id === wantedShopId) ?? valid[0];

  if (!row?.shops || !row.roles) {
    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: profile as Profile,
      membership: null,
      shops,
    };
  }

  const shop = row.shops;
  const [settingsResult, subscriptionResult, permissionsResult, planResult] = await Promise.all([
    supabase.from("shop_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("shop_id", shop.id)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    // The database computes the real permission list (role defaults + shop overrides).
    supabase.rpc("my_permissions", { p_shop_id: shop.id }),
    // The plan the shop is really on right now (expired plans fall back to Free).
    supabase.rpc("shop_plan", { p_shop_id: shop.id }),
  ]);

  const permissions = (permissionsResult.data as string[] | null) ?? [];
  const effectivePlan = planResult.data as SubscriptionPlan | null;

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: profile as Profile,
    membership: {
      shop,
      settings: (settingsResult.data as ShopSettings | null) ?? null,
      subscription: subscriptionResult.data
        ? ({
            ...subscriptionResult.data,
            plan: subscriptionResult.data.plan as SubscriptionPlan | null,
          } as Subscription)
        : null,
      role: { key: row.roles.key, name: row.roles.name },
      permissions,
      features: effectivePlan?.feature_flags ?? [],
    },
    shops,
  };
});
