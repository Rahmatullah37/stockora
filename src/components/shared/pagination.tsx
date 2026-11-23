import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const PAGE_SIZE = 25;

/** Reads ?page= safely (1-based). */
export function readPage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Previous / Next links that keep the other query parameters (search, filters). */
export async function Pagination({
  basePath, searchParams, page, hasNext,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  hasNext: boolean;
}) {
  const t = await getT();
  if (page === 1 && !hasNext) return null;
  const link = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== "page" && typeof value === "string") params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={link(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("common.previous")}</Link>
      ) : <span />}
      <span className="text-muted-foreground">{t("common.page", { page })}</span>
      {hasNext ? (
        <Link href={link(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("common.next")}</Link>
      ) : <span />}
    </div>
  );
}
