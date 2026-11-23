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
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { resetPasswordAction } from "../actions";

export function ResetPasswordForm() {
  const t = useT();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });
  const { run, isPending, error } = useFormAction(resetPasswordAction);

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <FormField
        label={t("auth.field.newPassword")}
        htmlFor="password"
        error={errors.password?.message}
        hint={t("auth.field.passwordHint")}
      >
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </FormField>
      <FormField label={t("auth.field.confirmPassword")} htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={isPending}>
        {isPending ? t("auth.reset.submitting") : t("auth.reset.submit")}
      </Button>
    </form>
  );
}
