import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Full-page message used for "no shop", "shop suspended" and similar states. */
export function StatusScreen({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
