"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/hooks/use-form-action";

/**
 * A button that asks "Are you sure?" and then runs a Server Action.
 * Shows the error message if the action fails.
 *
 *   <ConfirmButton action={() => deleteThing(id)} confirmText="Delete this?">Delete</ConfirmButton>
 */
export function ConfirmButton({
  action, confirmText, children, onDone, ...props
}: {
  action: () => Promise<ActionResult | void>;
  confirmText: string;
  onDone?: () => void;
} & Omit<ComponentProps<typeof Button>, "onClick" | "type">) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        loading={isPending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
            else onDone?.();
          });
        }}
        {...props}
      >
        {children}
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
    </span>
  );
}
