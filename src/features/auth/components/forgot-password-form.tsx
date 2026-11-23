"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { useT } from "@/lib/i18n/provider";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  const t = useT();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  const { run, isPending, error, success } = useFormAction(forgotPasswordAction);

  // After sending, replace the form with a confirmation message.
  if (success) {
    return <Alert variant="success">{t("auth.forgot.success")}</Alert>;
  }

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <FormField label={t("auth.field.email")} htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={isPending}>
        {isPending ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
      </Button>
    </form>
  );
}
