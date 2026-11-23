"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_SHOP_COOKIE, getAppContext } from "@/lib/auth/session";

/** Opens another of the user's shops. Only shops the user belongs to are accepted. */
export async function switchShopAction(shopId: string): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx || !ctx.shops.some((s) => s.id === shopId)) return;
  (await cookies()).set(ACTIVE_SHOP_COOKIE, shopId, {
    path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true,
  });
  revalidatePath("/", "layout");
}
