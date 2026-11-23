"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/input";
import { switchShopAction } from "../actions";

/** Dropdown in the top bar for users who belong to more than one shop. */
export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: { id: string; name: string }[];
  activeShopId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Select
      aria-label="Switch shop"
      value={activeShopId}
      disabled={isPending}
      className="h-9 w-40 sm:w-52"
      onChange={(event) => startTransition(() => switchShopAction(event.target.value))}
    >
      {shops.map((shop) => (
        <option key={shop.id} value={shop.id}>{shop.name}</option>
      ))}
    </Select>
  );
}
