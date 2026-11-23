"use client";

import { useState, useTransition } from "react";

/** What every Server Action returns when something should be shown to the user. */
export interface ActionResult {
  error?: string;
  success?: string;
}

/**
 * Small helper for forms that call a Server Action.
 *
 *   const { run, isPending, error, success } = useFormAction(loginAction);
 *   <form onSubmit={handleSubmit(run)}> ...
 *
 * It tracks "saving..." state and the error / success message returned by the
 * server. (If the action redirects, the page simply navigates away.)
 */
export function useFormAction<Values>(
  action: (values: Values) => Promise<ActionResult | void>,
) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function run(values: Values) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action(values);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return { run, isPending, error, success };
}
