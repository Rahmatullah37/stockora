"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BUSINESS_CATEGORIES } from "@/config/business-categories";
import { COUNTRIES, CURRENCIES, findCountry } from "@/config/regional";
import { useFormAction } from "@/hooks/use-form-action";
import { useT } from "@/lib/i18n/provider";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerAction } from "../actions";

export function RegisterForm() {
  const t = useT();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { businessCategory: "general", country: "", currency: "" },
  });
  const { run, isPending, error } = useFormAction(registerAction);

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-6" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      {/* ---- Section 1: the person ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("auth.register.accountSection")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("auth.field.fullName")} htmlFor="fullName" error={errors.fullName?.message}>
            <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
          </FormField>
          <FormField label={t("auth.field.phone")} htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" aria-invalid={!!errors.phone} {...register("phone")} />
          </FormField>
        </div>
        <FormField label={t("auth.field.email")} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("auth.field.password")}
            htmlFor="password"
            error={errors.password?.message}
            hint={t("auth.field.passwordHint")}
          >
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          </FormField>
          <FormField label={t("auth.field.confirmPassword")} htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          </FormField>
        </div>
      </section>

      {/* ---- Section 2: the shop ---- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("auth.register.shopSection")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("auth.field.shopName")} htmlFor="shopName" error={errors.shopName?.message}>
            <Input id="shopName" aria-invalid={!!errors.shopName} {...register("shopName")} />
          </FormField>
          <FormField label={t("auth.field.businessCategory")} htmlFor="businessCategory" error={errors.businessCategory?.message}>
            <Select id="businessCategory" aria-invalid={!!errors.businessCategory} {...register("businessCategory")}>
              {BUSINESS_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("auth.field.country")} htmlFor="country" error={errors.country?.message}>
            <Select
              id="country"
              autoComplete="country"
              aria-invalid={!!errors.country}
              {...register("country", {
                // When a country is picked, suggest its usual currency.
                onChange: (event) => {
                  const country = findCountry(event.target.value);
                  if (country) setValue("currency", country.currency, { shouldValidate: true });
                },
              })}
            >
              <option value="">{t("common.select")}</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("auth.field.currency")} htmlFor="currency" error={errors.currency?.message}>
            <Select id="currency" aria-invalid={!!errors.currency} {...register("currency")}>
              <option value="">{t("common.select")}</option>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label={t("auth.field.address")} htmlFor="address" error={errors.address?.message}>
          <Input id="address" autoComplete="street-address" aria-invalid={!!errors.address} {...register("address")} />
        </FormField>
      </section>

      <Button type="submit" size="lg" className="w-full" loading={isPending}>
        {isPending ? t("auth.register.submitting") : t("auth.register.submit")}
      </Button>
    </form>
  );
}
