"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Search box that stores the text in the URL (?q=...), so server pages can
 * filter with it and the search survives a page refresh. Waits 350 ms after typing.
 * Resets ?page when the text changes.
 */
export function SearchInput({ placeholder, paramName = "q" }: { placeholder: string; paramName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramName) ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === (params.get(paramName) ?? "")) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(paramName, value.trim());
      else next.delete(paramName);
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 350);
    return () => clearTimeout(timer);
  }, [value, params, paramName, pathname, router]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-9"
      />
    </div>
  );
}
