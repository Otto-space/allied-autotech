"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
import {
  emptyServiceLine,
  serviceLinesFormSchema,
  toServiceLines,
  type ServiceLinesForm,
} from "@/lib/forms/service-lines";
import { koboToInput, nairaToKobo } from "@/lib/format/currency-input";
import { formatBusinessDate } from "@/lib/format/date";
import type { MutationProposal } from "./mutation-review";
import { ServiceLineFields } from "./service-line-fields";
import { Feedback } from "./feedback";
type Quote = StaffBooking["quotes"][number];
function localExpiry(value: string | null | undefined) {
  if (!value) return "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 3600000).toISOString().slice(0, 16) : "";
}
export function ServiceLineEntry({
  booking,
  mode,
  quote,
  disabled,
  onReview,
  onSaved,
  onCancel,
}: {
  booking: StaffBooking;
  mode: "quote" | "work-items";
  quote?: Quote;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [uncertain, setUncertain] = useState(false);
  const form = useForm<ServiceLinesForm>({
    resolver: zodResolver(serviceLinesFormSchema),
    defaultValues: {
      items: quote
        ? quote.items.map((item) => ({
            type: item.type,
            productId: item.productId ?? "",
            productLabel: item.description,
            description: item.description,
            quantity: item.quantity,
            unitPrice: koboToInput(item.unitPriceKobo),
          }))
        : [emptyServiceLine()],
      tax: quote ? koboToInput(quote.taxKobo) : "0",
      notes: quote?.notes ?? "",
      expiresAt: localExpiry(quote?.expiresAt),
    },
  });
  const prefix = mode === "quote" ? "quote-editor" : "work-items";
  function review(values: ServiceLinesForm, submittedAt: number) {
    if (disabled || uncertain) return;
    const items = toServiceLines(values.items);
    const facts = values.items.map((line, index) => ({
      label: `Line ${index + 1}`,
      value:
        line.type === "PART"
          ? `${line.quantity} × ${line.productLabel || line.description || "Selected catalogue part"}; price confirmed on save`
          : `${line.quantity} × NGN ${line.unitPrice} · ${line.description}`,
    }));
    let path: string;
    let method: "POST" | "PUT";
    let body:
      | RequestBody<"/staff/bookings/{bookingId}/quotes", "post">
      | RequestBody<"/staff/bookings/{bookingId}/quotes/{quoteId}", "put">
      | RequestBody<"/staff/bookings/{bookingId}/work-orders/{workOrderId}", "put">;
    if (mode === "quote") {
      const expiresAt = `${values.expiresAt}:00+01:00`;
      if (
        !z.iso.datetime({ offset: true }).safeParse(expiresAt).success ||
        new Date(expiresAt).getTime() <= submittedAt
      ) {
        form.setError(
          "expiresAt",
          { message: "Choose a future expiry in Lagos time." },
          { shouldFocus: true },
        );
        return;
      }
      body = {
        items,
        taxKobo: nairaToKobo(values.tax),
        notes: values.notes || null,
        expiresAt,
        ...(quote ? { expectedRevision: quote.revision } : {}),
      };
      path = `/staff/bookings/${booking.id}/quotes${quote ? `/${quote.id}` : ""}`;
      method = quote ? "PUT" : "POST";
      facts.push(
        { label: "Tax", value: `NGN ${values.tax}` },
        { label: "Expires", value: formatBusinessDate(expiresAt) },
      );
      if (values.notes) facts.push({ label: "Quotation notes", value: values.notes });
    } else {
      if (!booking.workOrder) return;
      body = { expectedVersion: booking.workOrder.version, addItems: items };
      path = `/staff/bookings/${booking.id}/work-orders/${booking.workOrder.id}`;
      method = "PUT";
    }
    onReview({
      title:
        mode === "work-items"
          ? "Add these work-order items?"
          : quote
            ? "Replace this draft quotation?"
            : "Create this draft quotation?",
      description:
        mode === "work-items"
          ? "These items will be appended to the work order. Existing items remain recorded. The server sets current catalogue part prices."
          : quote
            ? "The server creates a new draft version and voids the old draft. Review the saved totals before issuing the new quotation."
            : "The server calculates totals and saves a draft. Review its saved totals before issuing it to the customer.",
      facts,
      onUncertain: () => setUncertain(true),
      submit: async () => {
        await apiRequest(path, { method, csrf: true, body });
        onSaved();
      },
    });
  }
  return (
    <form
      className="line-entry-form"
      onSubmit={(event) => {
        const submittedAt = Date.now();
        void form.handleSubmit((values) => review(values, submittedAt))(event);
      }}
      noValidate
    >
      <h3>
        {mode === "work-items"
          ? "Add parts, labour or fees"
          : quote
            ? `Edit draft ${quote.quoteNumber}`
            : "New quotation"}
      </h3>
      {uncertain && (
        <Feedback message="The save outcome is uncertain. Review the refreshed booking before starting another draft or adding items. This form cannot be submitted again." />
      )}
      <ServiceLineFields form={form} prefix={prefix} disabled={disabled || uncertain} />
      {mode === "quote" && (
        <>
          <div className="field">
            <label htmlFor="quote-tax">Tax amount (NGN)</label>
            <input
              id="quote-tax"
              inputMode="decimal"
              {...form.register("tax")}
              aria-invalid={!!form.formState.errors.tax}
              aria-describedby={form.formState.errors.tax ? "quote-tax-error" : undefined}
            />
            {form.formState.errors.tax && (
              <p id="quote-tax-error" className="field-error" role="alert">
                {form.formState.errors.tax.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="quote-expiry">Quotation expiry (Lagos time)</label>
            <input
              id="quote-expiry"
              type="datetime-local"
              {...form.register("expiresAt")}
              aria-invalid={!!form.formState.errors.expiresAt}
              aria-describedby="quote-expiry-hint"
            />
            <p
              id="quote-expiry-hint"
              className={form.formState.errors.expiresAt ? "field-error" : "field-hint"}
              role={form.formState.errors.expiresAt ? "alert" : undefined}
            >
              {form.formState.errors.expiresAt?.message ??
                "Use local time in Port Harcourt, UTC+01:00."}
            </p>
          </div>
          <div className="field">
            <label htmlFor="quote-notes">Quotation notes (optional)</label>
            <input
              id="quote-notes"
              {...form.register("notes")}
              maxLength={4000}
              aria-invalid={!!form.formState.errors.notes}
              aria-describedby={
                form.formState.errors.notes ? "quote-notes-error" : undefined
              }
            />
            {form.formState.errors.notes && (
              <p id="quote-notes-error" className="field-error" role="alert">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
        </>
      )}
      {form.formState.errors.items?.message && (
        <Feedback message={form.formState.errors.items.message} />
      )}
      <div className="actions">
        <button className="button" disabled={disabled || uncertain}>
          Review {mode === "work-items" ? "additional items" : "quotation draft"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={onCancel}
        >
          Close editor
        </button>
      </div>
    </form>
  );
}
