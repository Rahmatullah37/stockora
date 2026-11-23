"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { localeNames, locales } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/provider";
import { accountSchema, type AccountInput } from "@/lib/validations/settings";
import { updateAccountAction } from "../actions";

export function AccountForm({
  defaultValues,
  loginEmail,
}: {
  defaultValues: AccountInput;
  loginEmail: string;
}) {
  const t = useT();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountInput>({ resolver: zodResolver(accountSchema), defaultValues });
  const { run, isPending, error, success } = useFormAction(updateAccountAction);

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{t("common.saved")}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("auth.field.fullName")} htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        </FormField>
        <FormField label={`${t("auth.field.phone")} ${t("common.optional")}`} htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" inputMode="tel" aria-invalid={!!errors.phone} {...register("phone")} />
        </FormField>
        <FormField label={t("settings.field.loginEmail")} htmlFor="loginEmail">
          <Input id="loginEmail" value={loginEmail} readOnly disabled dir="ltr" />
        </FormField>
        <FormField label={t("settings.field.myLanguage")} htmlFor="preferredLanguage" error={errors.preferredLanguage?.message}>
          <Select id="preferredLanguage" {...register("preferredLanguage")}>
            {locales.map((code) => (
              <option key={code} value={code}>
                {localeNames[code]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <Button type="submit" loading={isPending}>
        {isPending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
