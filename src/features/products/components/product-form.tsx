"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { useT } from "@/lib/i18n/provider";
import {
  PRODUCT_STATUSES, PRODUCT_UNITS, productFormSchema, toNumberOrNull, type ProductFormValues,
} from "@/lib/validations/products";
import { createProductAction, updateProductAction } from "../actions";
import { ProductImageUpload } from "./product-image-upload";
import { ProfitPreview } from "./profit-preview";

interface Option { id: string; name: string }

/** The add / edit product form (the same form for both). */
export function ProductForm({
  mode, productId, shopId, defaultValues, categories, brands, suppliers, canSeeCost,
}: {
  mode: "create" | "edit";
  productId?: string;
  shopId: string;
  defaultValues: ProductFormValues;
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  /** true when the user has finance.view (purchase price + opening stock are shown) */
  canSeeCost: boolean;
}) {
  const t = useT();
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  const { run, isPending, error } = useFormAction((values: ProductFormValues) =>
    mode === "create" ? createProductAction(values) : updateProductAction(productId!, values),
  );

  const [purchasePrice, sellingPrice, imagePath] = useWatch({
    control, name: ["purchasePrice", "sellingPrice", "imagePath"],
  });
  const cost = toNumberOrNull(purchasePrice);
  const price = toNumberOrNull(sellingPrice);
  const numberProps = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <form onSubmit={handleSubmit(run)} className="space-y-8" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      <section className="space-y-4">
        <h2 className="font-semibold">{t("products.form.basic")}</h2>
        <FormField label={t("products.field.image")} htmlFor="product-image">
          <ProductImageUpload shopId={shopId} value={imagePath} onChange={(p) => setValue("imagePath", p, { shouldDirty: true })} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label={t("products.field.name")} htmlFor="name" error={errors.name?.message}>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            </FormField>
          </div>
          <FormField label={t("products.field.sku")} htmlFor="sku" error={errors.sku?.message} hint={t("products.field.skuHint")}>
            <Input id="sku" {...register("sku")} />
          </FormField>
          <FormField label={t("products.field.barcode")} htmlFor="barcode" error={errors.barcode?.message} hint={t("products.field.barcodeHint")}>
            <Input id="barcode" {...register("barcode")} autoComplete="off" />
          </FormField>
          <FormField label={t("products.field.category")} htmlFor="categoryId" error={errors.categoryId?.message}>
            <Select id="categoryId" {...register("categoryId")}>
              <option value="">{t("products.field.none")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label={t("products.field.brand")} htmlFor="brandId" error={errors.brandId?.message}>
            <Select id="brandId" {...register("brandId")}>
              <option value="">{t("products.field.none")}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FormField>
          <FormField label={t("products.field.supplier")} htmlFor="supplierId" error={errors.supplierId?.message}>
            <Select id="supplierId" {...register("supplierId")}>
              <option value="">{t("products.field.none")}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label={t("products.field.unit")} htmlFor="unit" error={errors.unit?.message}>
            <Input id="unit" list="unit-list" {...register("unit")} />
            <datalist id="unit-list">{PRODUCT_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </FormField>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">{t("products.form.pricing")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {canSeeCost && (
            <FormField label={t("products.field.purchasePrice")} htmlFor="purchasePrice" error={errors.purchasePrice?.message} hint={t("products.field.purchasePriceHint")}>
              <Input id="purchasePrice" {...numberProps} {...register("purchasePrice")} />
            </FormField>
          )}
          <FormField label={t("products.field.sellingPrice")} htmlFor="sellingPrice" error={errors.sellingPrice?.message}>
            <Input id="sellingPrice" {...numberProps} {...register("sellingPrice")} aria-invalid={!!errors.sellingPrice} />
          </FormField>
          <FormField label={t("products.field.wholesalePrice")} htmlFor="wholesalePrice" error={errors.wholesalePrice?.message}>
            <Input id="wholesalePrice" {...numberProps} {...register("wholesalePrice")} />
          </FormField>
          <FormField label={t("products.field.minSellingPrice")} htmlFor="minSellingPrice" error={errors.minSellingPrice?.message} hint={t("products.field.minSellingHint")}>
            <Input id="minSellingPrice" {...numberProps} {...register("minSellingPrice")} />
          </FormField>
        </div>
        {canSeeCost && <ProfitPreview cost={cost} price={price} />}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">{t("products.form.stock")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "create" && canSeeCost && (
            <FormField label={t("products.field.openingStock")} htmlFor="openingStock" error={errors.openingStock?.message} hint={t("products.field.openingStockHint")}>
              <Input id="openingStock" {...numberProps} {...register("openingStock")} />
            </FormField>
          )}
          <FormField label={t("products.field.minStock")} htmlFor="minStockLevel" error={errors.minStockLevel?.message}>
            <Input id="minStockLevel" {...numberProps} {...register("minStockLevel")} />
          </FormField>
          <FormField label={t("products.field.expiry")} htmlFor="expiryDate" error={errors.expiryDate?.message}>
            <Input id="expiryDate" type="date" {...register("expiryDate")} />
          </FormField>
          <FormField label={t("products.field.status")} htmlFor="status" error={errors.status?.message}>
            <Select id="status" {...register("status")}>
              {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{t(`products.status.${s}`)}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label={t("products.field.description")} htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...register("description")} />
        </FormField>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending}>{isPending ? t("products.form.saving") : t("products.form.save")}</Button>
        <Link href={mode === "edit" && productId ? `/products/${productId}` : "/products"} className={buttonVariants({ variant: "outline" })}>
          {t("common.cancel")}
        </Link>
      </div>
    </form>
  );
}
