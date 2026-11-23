"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BUSINESS_CATEGORIES } from "@/config/business-categories";
import { useFormAction } from "@/hooks/use-form-action";
import { useT } from "@/lib/i18n/provider";
import { shopProfileSchema, type ShopProfileInput } from "@/lib/validations/settings";
import { updateShopProfileAction } from "../actions";

export function ShopProfileForm({
  defaultValues,
  canEdit,
}: {
  defaultValues: ShopProfileInput;
  canEdit: boolean;
}) {
  const t = useT();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShopProfileInput>({ resolver: zodResolver(shopProfileSchema), defaultValues });
  const { run, isPending, error, success } = useFormAction(updateShopProfileAction);

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-4" noValidate>
      {!canEdit && <Alert>{t("settings.readOnly")}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{t("common.saved")}</Alert>}

      {/* A disabled fieldset makes every field read-only for people without permission. */}
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("auth.field.shopName")} htmlFor="name" error={errors.name?.message}>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label={t("auth.field.businessCategory")} htmlFor="businessCategory" error={errors.businessCategory?.message}>
            <Select id="businessCategory" {...register("businessCategory")}>
              {BUSINESS_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={`${t("settings.field.shopEmail")} ${t("common.optional")}`} htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
          </FormField>
          <FormField label={`${t("auth.field.phone")} ${t("common.optional")}`} htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" inputMode="tel" aria-invalid={!!errors.phone} {...register("phone")} />
          </FormField>
        </div>
        <FormField label={t("auth.field.address")} htmlFor="address" error={errors.address?.message}>
          <Input id="address" aria-invalid={!!errors.address} {...register("address")} />
        </FormField>
      </fieldset>

      {canEdit && (
        <Button type="submit" loading={isPending}>
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </form>
  );
}
