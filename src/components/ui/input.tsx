import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

const controlStyles =
  "w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-danger";

/** Text input. Works directly with React Hook Form's `register()`. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlStyles, "h-10", className)} {...props} />;
}

/** Dropdown. Uses the browser's native <select>, which is best on phones. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlStyles, "h-10", className)} {...props}>
      {children}
    </select>
  );
}
