"use client";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAccountSession } from "./dashboard-shell";
import { SlotCatalogPicker } from "./slot-catalog-picker";
const optionalReference = z.union([
  z.literal(""),
  z.string().uuid("Enter an existing profile reference in UUID format."),
]);
const schema = z.object({ branchId: optionalReference, customerId: optionalReference });
export type InvoiceFiltersValue = z.infer<typeof schema>;
export function InvoiceFilters({
  value,
  onApply,
}: {
  value: InvoiceFiltersValue;
  onApply: (value: InvoiceFiltersValue) => void;
}) {
  const session = useAccountSession();
  const administrator =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const form = useForm<InvoiceFiltersValue>({
    resolver: zodResolver(schema),
    defaultValues: value,
    shouldFocusError: false,
  });
  const errors = form.formState.errors;
  return (
    <form
      className="catalogue-filters"
      noValidate
      onSubmit={form.handleSubmit(
        (values) =>
          onApply({ ...values, branchId: administrator ? values.branchId : "" }),
        (validation) => {
          const first = (["branchId", "customerId"] as const).find(
            (name) => validation[name],
          );
          if (first) form.setFocus(first);
        },
      )}
    >
      {administrator ? (
        <div className="field">
          <label htmlFor="invoice-filter-branch">Active branch (optional)</label>
          <Controller
            name="branchId"
            control={form.control}
            render={({ field }) => (
              <SlotCatalogPicker
                kind="branch"
                id="invoice-filter-branch"
                value={field.value}
                onChange={field.onChange}
                inputRef={field.ref}
                error={errors.branchId?.message}
              />
            )}
          />
          <p className="field-hint">
            Leave blank to include every permitted branch, including inactive records.
          </p>
        </div>
      ) : (
        <p className="field-hint">
          Your assigned branch determines the invoices you can access.
        </p>
      )}
      <div className="field">
        <label htmlFor="invoice-filter-customer">
          Customer profile reference (optional)
        </label>
        <input
          id="invoice-filter-customer"
          {...form.register("customerId", {
            setValueAs: (value: string) => value.trim(),
          })}
          maxLength={36}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!!errors.customerId}
          aria-describedby={
            errors.customerId
              ? "invoice-filter-customer-error"
              : "invoice-filter-customer-hint"
          }
        />
        <p className="field-hint" id="invoice-filter-customer-hint">
          Use an existing customer-profile ID from an authorised record. A name or email
          address cannot be used as this filter.
        </p>
        {errors.customerId && (
          <p role="alert" className="field-error" id="invoice-filter-customer-error">
            {errors.customerId.message}
          </p>
        )}
      </div>
      <div className="actions">
        <button className="button secondary">Apply invoice filters</button>
      </div>
    </form>
  );
}
