"use client";
import { useState } from "react";
import {
  useController,
  useFieldArray,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import type { ServiceLinesForm } from "@/lib/forms/service-lines";
import { emptyServiceLine } from "@/lib/forms/service-lines";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
type Form = UseFormReturn<ServiceLinesForm>;
export function ServiceLineFields({
  form,
  prefix,
  disabled,
}: {
  form: Form;
  prefix: string;
  disabled: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  return (
    <>
      <p className="field-hint">
        Enter labour and fee prices in NGN. Part prices are set by the catalogue when the
        server saves the record.
      </p>
      {fields.map((field, index) => (
        <fieldset className="service-line-editor" key={field.id} disabled={disabled}>
          <legend>Line {index + 1}</legend>
          <ServiceLineFieldsRow form={form} prefix={`${prefix}-${index}`} index={index} />
          <button
            className="text-link"
            type="button"
            onClick={() => {
              remove(index);
              requestAnimationFrame(() =>
                document.getElementById(`${prefix}-add`)?.focus(),
              );
            }}
          >
            Remove line {index + 1}
          </button>
        </fieldset>
      ))}
      {form.formState.errors.items?.root?.message && (
        <Feedback message={form.formState.errors.items.root.message} />
      )}
      <button
        id={`${prefix}-add`}
        type="button"
        className="button secondary"
        disabled={disabled || fields.length >= 100}
        onClick={() => append(emptyServiceLine())}
      >
        Add line item
      </button>
    </>
  );
}
function ServiceLineFieldsRow({
  form,
  prefix,
  index,
}: {
  form: Form;
  prefix: string;
  index: number;
}) {
  const type = useWatch({ control: form.control, name: `items.${index}.type` });
  const errors = form.formState.errors.items?.[index];
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-type`}>Line type</label>
        <select id={`${prefix}-type`} {...form.register(`items.${index}.type`)}>
          <option value="LABOUR">Labour</option>
          <option value="PART">Catalogue part</option>
          <option value="FEE">Fee</option>
        </select>
      </div>
      {type === "PART" && <PartPicker form={form} index={index} prefix={prefix} />}
      <div className="field">
        <label htmlFor={`${prefix}-description`}>
          Description{type === "PART" ? " (optional override)" : ""}
        </label>
        <input
          id={`${prefix}-description`}
          maxLength={500}
          {...form.register(`items.${index}.description`)}
          aria-invalid={!!errors?.description}
          aria-describedby={
            errors?.description ? `${prefix}-description-error` : undefined
          }
        />
        {errors?.description && (
          <p className="field-error" id={`${prefix}-description-error`} role="alert">
            {errors.description.message}
          </p>
        )}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${prefix}-quantity`}>Quantity</label>
          <input
            id={`${prefix}-quantity`}
            type="number"
            min={1}
            max={10000}
            step={1}
            {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
            aria-invalid={!!errors?.quantity}
            aria-describedby={errors?.quantity ? `${prefix}-quantity-error` : undefined}
          />
          {errors?.quantity && (
            <p className="field-error" role="alert" id={`${prefix}-quantity-error`}>
              {errors.quantity.message}
            </p>
          )}
        </div>
        {type !== "PART" && (
          <div className="field">
            <label htmlFor={`${prefix}-price`}>Unit price (NGN)</label>
            <input
              id={`${prefix}-price`}
              inputMode="decimal"
              {...form.register(`items.${index}.unitPrice`)}
              aria-invalid={!!errors?.unitPrice}
              aria-describedby={errors?.unitPrice ? `${prefix}-price-error` : undefined}
            />
            {errors?.unitPrice && (
              <p className="field-error" role="alert" id={`${prefix}-price-error`}>
                {errors.unitPrice.message}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
function PartPicker({
  form,
  index,
  prefix,
}: {
  form: Form;
  index: number;
  prefix: string;
}) {
  const pagination = useCursorPage();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { field, fieldState } = useController({
    control: form.control,
    name: `items.${index}.productId`,
  });
  const label = useWatch({ control: form.control, name: `items.${index}.productLabel` });
  const params = new URLSearchParams({ limit: "25" });
  if (query) params.set("search", query);
  if (pagination.cursor) params.set("cursor", pagination.cursor);
  const products = useResource(`/public/catalog/products?${params}`, parseProducts);
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-search`}>Find a part by name or SKU</label>
        <input
          id={`${prefix}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
        />
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setQuery(search.trim());
            pagination.reset();
          }}
        >
          Search catalogue
        </button>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-part`}>Catalogue part</label>
        <select
          id={`${prefix}-part`}
          {...field}
          onChange={(event) => {
            field.onChange(event);
            form.setValue(
              `items.${index}.productLabel`,
              event.target.selectedOptions[0]?.textContent ?? "Selected part",
            );
          }}
          aria-invalid={!!fieldState.error}
          aria-describedby={fieldState.error ? `${prefix}-part-error` : undefined}
        >
          <option value="">Choose a part</option>
          {field.value &&
            !products.data?.items.some((item) => item.id === field.value) && (
              <option value={field.value}>{label || "Previously selected part"}</option>
            )}
          {products.data?.items.map((product) => (
            <option value={product.id} key={product.id}>
              {product.name} · {product.sku} · {formatKobo(product.priceKobo)}
            </option>
          ))}
        </select>
        {fieldState.error && (
          <p id={`${prefix}-part-error`} className="field-error" role="alert">
            {fieldState.error.message}
          </p>
        )}
      </div>
      <Feedback message={products.error} />
      {products.loading && <p role="status">Loading catalogue choices…</p>}
      {products.error && (
        <button type="button" className="text-link" onClick={products.refresh}>
          Retry catalogue
        </button>
      )}
      {!products.loading && !products.error && products.data?.items.length === 0 && (
        <p>No parts match this search.</p>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={products.data?.nextCursor}
        disabled={products.loading || !!products.error}
        label={`Line ${index + 1} catalogue`}
      />
    </>
  );
}
