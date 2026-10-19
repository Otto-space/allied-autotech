"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  promotionFormSchema,
  promotionDefaults,
  promotionFormDraftKey,
  type PromotionValues,
} from "@/lib/forms/promotion";
import type { Promotion } from "@/lib/api/promotion-schemas";
export function PromotionForm({
  item,
  disabled,
  onReview,
  grouped = false,
}: {
  item?: Promotion;
  disabled: boolean;
  onReview: (value: PromotionValues) => void;
  grouped?: boolean;
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
          <textarea {...props} rows={grouped ? 3 : 4} />
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
  const discountType = (
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
  );
  const discount =
    type === "PERCENTAGE"
      ? field("percentage", "Discount percentage", { numeric: true, max: 6 })
      : field("fixedAmount", "Fixed discount (NGN)", { numeric: true, max: 20 });
  const limits = (
    <>
      {field("minimumOrderAmount", "Minimum subtotal (NGN, optional)", {
        numeric: true,
        max: 20,
      })}
      {field("maximumDiscountAmount", "Discount cap (NGN, optional)", {
        numeric: true,
        max: 20,
      })}
    </>
  );
  const counts = (
    <>
      {field("usageLimit", "Total usage limit (optional)", { numeric: true, max: 8 })}
      {field("perCustomerLimit", "Per-customer limit (optional)", {
        numeric: true,
        max: 6,
      })}
    </>
  );
  const schedule = (
    <>
      {field("startsAt", "Starts at (Lagos time)", { type: "datetime-local" })}
      {field("endsAt", "Ends at (Lagos time)", { type: "datetime-local" })}
    </>
  );
  const enabled = (
    <label className="check-label">
      <input type="checkbox" {...form.register("isActive")} /> Enable this promotion
    </label>
  );
  const title = (n: string, text: string) => (
    <h3 className="pc-group-title">
      <span aria-hidden="true">{n}</span>
      {text}
    </h3>
  );
  return (
    <form
      data-draft-key={promotionFormDraftKey(item?.id)}
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled) onReview(value);
      })}
    >
      {!grouped && (
        <p>
          Amounts are in NGN. Dates use Lagos time (UTC+1). Blank optional limits mean no
          configured limit; actual usage counts are not available here.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled}>
        {grouped ? (
          <>
            <div className="pc-group">
              {title("01", "Offer details")}
              <div className="record-form-grid">
                {field("name", "Promotion name", { max: 160 })}
                {field("code", "Redemption code (optional)", { max: 80 })}
              </div>
              {field("description", "Description (optional)", {
                multiline: true,
                max: 2000,
              })}
            </div>
            <div className="pc-group">
              {title("02", "Discount")}
              <div className="record-form-grid">
                {discountType}
                {discount}
                {limits}
              </div>
              <p className="field-hint">
                Amounts are in NGN. A zero fixed discount or zero cap produces no eligible
                discount.
              </p>
            </div>
            <div className="pc-group">
              {title("03", "Schedule")}
              <div className="record-form-grid">{schedule}</div>
              <p className="field-hint">All dates use Lagos time (UTC+1).</p>
            </div>
            <div className="pc-group">
              {title("04", "Usage and availability")}
              <div className="record-form-grid">{counts}</div>
              <p className="field-hint">
                Blank optional limits mean no configured limit. Actual usage counts are
                not available here.
              </p>
              {enabled}
              <p className="field-hint">
                {!item && "New promotions start disabled. "}Enabled promotions still
                depend on dates, subtotal and usage limits.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="record-form-grid">
              {field("name", "Promotion name", { max: 160 })}
              {field("code", "Redemption code (optional)", { max: 80 })}
              {discountType}
              {discount}
              {limits}
              {counts}
              {schedule}
            </div>
            {field("description", "Description (optional)", {
              multiline: true,
              max: 2000,
            })}
            {enabled}
            <p className="field-hint">
              A code is required for customer redemption. Promotions without a code are
              not automatically applied. Enabled promotions still depend on dates,
              subtotal and usage limits. A zero fixed discount or zero cap produces no
              eligible discount.
            </p>
          </>
        )}
        <button className="button">Review promotion</button>
      </fieldset>
    </form>
  );
}
