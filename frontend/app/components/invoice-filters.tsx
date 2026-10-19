"use client";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  invoiceSourceType,
  invoiceSourceLabels,
  invoiceStatusLabels,
} from "@/lib/admin/work-invoices";
import { AdminBranchPicker } from "./admin-branch-picker";
const reference = z.union([z.literal(""), z.uuid("Use an existing UUID reference.")]);
const schema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .max(50)
      .refine((v) => !/[\x00-\x1f\x7f]/.test(v), "Enter a valid invoice number."),
    status: z.union([z.literal(""), z.enum(["DRAFT", "ISSUED", "PAID", "VOID"])]),
    branchId: reference,
    customerId: reference,
    sourceType: z.union([z.literal(""), invoiceSourceType]),
    sourceId: reference,
  })
  .refine((v) => !v.sourceId || !!v.sourceType, {
    path: ["sourceType"],
    message: "Choose the source type for this reference.",
  });
export type InvoiceFiltersValue = z.infer<typeof schema>;
export function InvoiceFilters({
  value,
  onApply,
  open,
  onToggle,
  onClear,
  onDenied,
  disabled,
}: {
  value: InvoiceFiltersValue;
  onApply: (v: InvoiceFiltersValue) => void;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  onDenied: () => void;
  disabled: boolean;
}) {
  const form = useForm<InvoiceFiltersValue>({
      resolver: zodResolver(schema),
      defaultValues: value,
      shouldFocusError: false,
    }),
    errors = form.formState.errors;
  function error(name: keyof InvoiceFiltersValue) {
    return (
      errors[name] && (
        <p id={`invoice-filter-${name}-error`} role="alert" className="field-error">
          {errors[name]?.message}
        </p>
      )
    );
  }
  return (
    <form
      className="wi-filters panel iv-filters"
      noValidate
      onSubmit={form.handleSubmit(onApply, (v) => {
        const field = (Object.keys(schema.shape) as (keyof InvoiceFiltersValue)[]).find(
          (k) => v[k],
        );
        if (field) form.setFocus(field);
      })}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">Find invoices</legend>
        <div className="iv-filter-primary">
          <div className="field">
            <label htmlFor="invoice-filter-invoiceNumber">Exact invoice number</label>
            <input
              id="invoice-filter-invoiceNumber"
              {...form.register("invoiceNumber")}
              maxLength={50}
              autoComplete="off"
              placeholder="e.g. INV-20261018-…"
              aria-invalid={!!errors.invoiceNumber}
              aria-describedby={
                errors.invoiceNumber ? "invoice-filter-invoiceNumber-error" : undefined
              }
            />
            {error("invoiceNumber")}
          </div>
          <div className="field">
            <label htmlFor="invoice-filter-status">Invoice status</label>
            <select id="invoice-filter-status" {...form.register("status")}>
              <option value="">All statuses</option>
              {Object.entries(invoiceStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button
              type="button"
              className="button secondary"
              aria-expanded={open}
              aria-controls="invoice-advanced-filters"
              onClick={onToggle}
            >
              {open ? "Fewer filters" : "More filters"}
            </button>
            <button className="button secondary">Apply invoice filters</button>
            <button type="button" className="text-link iv-clear" onClick={onClear}>
              Clear invoice filters
            </button>
          </div>
        </div>
        <div id="invoice-advanced-filters" className="iv-filter-advanced" hidden={!open}>
          {open && (
            <div className="field">
              <label htmlFor="invoice-filter-branchId">Branch</label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <AdminBranchPicker
                    id="invoice-filter-branchId"
                    value={field.value}
                    onChange={field.onChange}
                    inputRef={field.ref}
                    activeOnly={false}
                    error={errors.branchId?.message}
                    onDenied={onDenied}
                  />
                )}
              />
              <p className="field-hint">Includes inactive branches.</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="invoice-filter-customerId">Customer profile reference</label>
            <input
              id="invoice-filter-customerId"
              {...form.register("customerId", { setValueAs: (v: string) => v.trim() })}
              maxLength={36}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.customerId}
              aria-describedby={
                errors.customerId
                  ? "invoice-filter-customerId-error invoice-customer-hint"
                  : "invoice-customer-hint"
              }
            />
            <p id="invoice-customer-hint" className="field-hint">
              Exact profile UUID from an authorised record.
            </p>
            {error("customerId")}
          </div>
          <div className="field">
            <label htmlFor="invoice-filter-sourceType">Source type</label>
            <select
              id="invoice-filter-sourceType"
              {...form.register("sourceType")}
              aria-invalid={!!errors.sourceType}
              aria-describedby={
                errors.sourceType ? "invoice-filter-sourceType-error" : undefined
              }
            >
              <option value="">All sources</option>
              {Object.entries(invoiceSourceLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {error("sourceType")}
          </div>
          <div className="field">
            <label htmlFor="invoice-filter-sourceId">Source reference</label>
            <input
              id="invoice-filter-sourceId"
              {...form.register("sourceId", { setValueAs: (v: string) => v.trim() })}
              maxLength={36}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.sourceId}
              aria-describedby={
                errors.sourceId ? "invoice-filter-sourceId-error" : undefined
              }
            />
            {error("sourceId")}
          </div>
        </div>
      </fieldset>
    </form>
  );
}
