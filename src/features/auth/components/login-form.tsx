"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { useT } from "@/lib/i18n/provider";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Pass the "where to go after login" address along with the form values.
  const { run, isPending, error } = useFormAction((values: LoginInput) =>
    loginAction(values, next),
  );

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      <FormField label={t("auth.field.email")} htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>

      <FormField
        label={t("auth.field.password")}
        htmlFor="password"
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>

      <div className="text-end">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          {t("auth.login.forgot")}
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={isPending}>
        {isPending ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
    </form>
  );
}
