import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Responsive table primitives. The wrapper scrolls sideways on small screens,
 * so wide tables stay usable on phones.
 *
 *   <TableWrap><Table><THead><Tr><Th>Name</Th></Tr></THead><TBody>...</TBody></Table></TableWrap>
 */
export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)} {...props} />
  );
}
export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full text-sm", className)} {...props} />;
}
export function THead(props: ComponentProps<"thead">) {
  return <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground" {...props} />;
}
export function TBody(props: ComponentProps<"tbody">) {
  return <tbody className="divide-y divide-border" {...props} />;
}
export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-muted/40", className)} {...props} />;
}
export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("whitespace-nowrap px-4 py-3 text-start font-medium", className)} {...props} />;
}
export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
/** Right-aligned number cell (use `text-end` so it flips correctly in RTL). */
export function TdNum({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("whitespace-nowrap px-4 py-3 text-end tabular-nums", className)} {...props} />;
}
