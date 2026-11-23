import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const styles = {
  error: { box: "border-danger/30 bg-danger-soft text-danger", Icon: AlertCircle },
  success: { box: "border-success/30 bg-success-soft text-success", Icon: CheckCircle2 },
  info: { box: "border-border bg-muted text-foreground", Icon: Info },
} as const;

/** A message box for errors, confirmations and tips. */
export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof styles;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
