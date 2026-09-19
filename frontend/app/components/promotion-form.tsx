"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  promotionFormSchema,
  promotionDefaults,
  type PromotionValues,
} from "@/lib/forms/promotion";
import type { Promotion } from "@/lib/api/promotion-schemas";
export function PromotionForm({
  item,
  disabled,
  onReview,
}: {
  item?: Promotion;
  disabled: boolean;
  onReview: (value: PromotionValues) => void;
}) {
  const form = useForm<PromotionValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: promotionDefaults(item),
  });
  const type = useWatch({ control: form.control, name: "discountType" });
  const field = (
    name: Exclude<keyof PromotionValues, "isActive" | "discountType">,
    label: string,
    options?: { type?: string; max?: number; numeric?: boolean; multiline?: boolean },
  ) => {
    const error = form.formState.errors[name];
    const props = {
      id: `promotion-${name}`,
      ...form.register(name),
      "aria-invalid": !!error,
      "aria-describedby": error ? `promotion-${name}-error` : undefined,
      maxLength: options?.max,
    };
    return (
      <div className="field">
        <label htmlFor={props.id}>{label}</label>
        {options?.multiline ? (
          <textarea {...props} rows={4} />
        ) : (
          <input
            {...props}
            type={options?.type ?? "text"}
            step={options?.type === "datetime-local" ? "0.001" : undefined}
            inputMode={options?.numeric ? "decimal" : undefined}
          />
        )}
        {error && (
          <p className="field-error" role="alert" id={`promotion-${name}-error`}>
            {error.message}
          </p>
        )}
      </div>
    );
  };
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled) onReview(value);
      })}
    >
      <p>
        Amounts are in NGN. Dates use Lagos time (UTC+1). Blank optional limits mean no
        configured limit; actual usage counts are not available here.
      </p>
      <fieldset className="handover-fields" disabled={disabled}>
        <div className="record-form-grid">
          {field("name", "Promotion name", { max: 160 })}
          {field("code", "Redemption code (optional)", { max: 80 })}
          <div className="field">
            <label htmlFor="promotion-type">Discount type</label>
            <select
              id="promotion-type"
              {...form.register("discountType", {
                onChange: (event) => {
                  const inactive =
                    event.target.value === "PERCENTAGE" ? "fixedAmount" : "percentage";
                  form.setValue(inactive, "");
                  form.clearErrors(inactive);
                },
              })}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
          </div>
          {type === "PERCENTAGE"
            ? field("percentage", "Discount percentage", { numeric: true, max: 6 })
            : field("fixedAmount", "Fixed discount (NGN)", { numeric: true, max: 20 })}
          {field("minimumOrderAmount", "Minimum subtotal (NGN, optional)", {
            numeric: true,
            max: 20,
          })}
          {field("maximumDiscountAmount", "Discount cap (NGN, optional)", {
            numeric: true,
            max: 20,
          })}
          {field("usageLimit", "Total usage limit (optional)", { numeric: true, max: 8 })}
          {field("perCustomerLimit", "Per-customer limit (optional)", {
            numeric: true,
            max: 6,
          })}
          {field("startsAt", "Starts at (Lagos time)", { type: "datetime-local" })}
          {field("endsAt", "Ends at (Lagos time)", { type: "datetime-local" })}
        </div>
        {field("description", "Description (optional)", { multiline: true, max: 2000 })}
        <label className="check-label">
          <input type="checkbox" {...form.register("isActive")} /> Enable this promotion
        </label>
        <p className="field-hint">
          A code is required for customer redemption. Promotions without a code are not
          automatically applied. Enabled promotions still depend on dates, subtotal and
          usage limits. A zero fixed discount or zero cap produces no eligible discount.
        </p>
        <button className="button">Review promotion</button>
      </fieldset>
    </form>
  );
}
