"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { COUNTRIES, CURRENCIES, DATE_FORMATS, TIMEZONES, findCountry } from "@/config/regional";
import { useFormAction } from "@/hooks/use-form-action";
import { localeNames, locales } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/provider";
import {
  regionalSettingsSchema,
  type RegionalSettingsInput,
} from "@/lib/validations/settings";
import { updateRegionalSettingsAction } from "../actions";

export function RegionalSettingsForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: RegionalSettingsInput;
  canEdit: boolean;
}) {
  const t = useT();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<RegionalSettingsInput>({
    resolver: zodResolver(regionalSettingsSchema),
    defaultValues,
  });
  const { run, isPending, error, success } = useFormAction(updateRegionalSettingsAction);
  // useWatch (instead of watch) is safe with the React Compiler.
  const taxEnabled = useWatch({ control, name: "taxEnabled" });

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {!canEdit && <Alert>{t("settings.readOnly")}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{t("common.saved")}</Alert>}

      <fieldset disabled={!canEdit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("auth.field.country")} htmlFor="country" error={errors.country?.message}>
            <Select
              id="country"
              {...register("country", {
                // Suggest the usual currency and time zone when the country changes.
                onChange: (event) => {
                  const country = findCountry(event.target.value);
                  if (country) {
                    setValue("currency", country.currency, { shouldValidate: true });
                    setValue("timezone", country.timezone, { shouldValidate: true });
                  }
                },
              })}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("auth.field.currency")}
            htmlFor="currency"
            error={errors.currency?.message}
            hint={t("settings.hint.currency")}
          >
            <Select id="currency" {...register("currency")}>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("settings.field.timezone")} htmlFor="timezone" error={errors.timezone?.message}>
            <Select id="timezone" {...register("timezone")}>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("settings.field.dateFormat")} htmlFor="dateFormat" error={errors.dateFormat?.message}>
            <Select id="dateFormat" {...register("dateFormat")}>
              {DATE_FORMATS.map((pattern) => (
                <option key={pattern} value={pattern}>
                  {pattern}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("settings.field.language")} htmlFor="language" error={errors.language?.message}>
            <Select id="language" {...register("language")}>
              {locales.map((code) => (
                <option key={code} value={code}>
                  {localeNames[code]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {/* Tax */}
        <div className="space-y-4 rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-primary" {...register("taxEnabled")} />
            {t("settings.field.taxEnabled")}
          </label>
          {taxEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("settings.field.taxName")} htmlFor="taxName" error={errors.taxName?.message}>
                <Input id="taxName" aria-invalid={!!errors.taxName} {...register("taxName")} />
              </FormField>
              <FormField label={t("settings.field.taxRate")} htmlFor="taxRate" error={errors.taxRate?.message}>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  inputMode="decimal"
                  aria-invalid={!!errors.taxRate}
                  {...register("taxRate", { valueAsNumber: true })}
                />
              </FormField>
            </div>
          )}
        </div>
      </fieldset>

      {canEdit && (
        <Button type="submit" loading={isPending}>
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </form>
  );
}
