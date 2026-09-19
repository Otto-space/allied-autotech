"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffVehicleSale } from "@/lib/api/staff-vehicle-sales-schemas";
import { nairaToKobo, koboToInput } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
const positiveAmount = z
  .string()
  .trim()
  .regex(
    /^\d{1,14}(?:\.\d{1,2})?$/,
    "Enter a positive NGN amount with up to two decimal places.",
  )
  .refine(
    (value) => !/^0+(?:\.0+)?$/.test(value),
    "The amount must be greater than zero.",
  );
const negotiationSchema = z
  .object({
    agreedPrice: positiveAmount,
    reservation: z.union([z.literal(""), positiveAmount]),
    notes: z.string().trim().max(2000),
  })
  .superRefine((value, context) => {
    if (
      positiveAmount.safeParse(value.agreedPrice).success &&
      positiveAmount.safeParse(value.reservation).success &&
      BigInt(nairaToKobo(value.reservation)) > BigInt(nairaToKobo(value.agreedPrice))
    )
      context.addIssue({
        code: "custom",
        path: ["reservation"],
        message: "The reservation amount cannot exceed the agreed price.",
      });
  });
type ReviewProps = {
  sale: StaffVehicleSale;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
};
export function VehicleNegotiationForm({ sale, disabled, onReview }: ReviewProps) {
  const form = useForm<z.infer<typeof negotiationSchema>>({
    resolver: zodResolver(negotiationSchema),
    defaultValues: {
      agreedPrice: sale.agreedPriceKobo === null ? "" : koboToInput(sale.agreedPriceKobo),
      reservation:
        sale.reservationRequiredKobo === null
          ? ""
          : koboToInput(sale.reservationRequiredKobo),
      notes: "",
    },
  });
  const errors = form.formState.errors;
  function review(values: z.infer<typeof negotiationSchema>) {
    if (disabled) return;
    const body: RequestBody<
      "/staff/vehicle-transactions/{transactionId}/negotiate",
      "post"
    > = {
      expectedVersion: sale.version,
      agreedPriceKobo: nairaToKobo(values.agreedPrice),
      reservationRequiredKobo: values.reservation
        ? nairaToKobo(values.reservation)
        : null,
      ...(values.notes ? { notes: values.notes } : {}),
    };
    onReview({
      title: "Record this negotiated price?",
      description:
        "This records the agreed price and sets the purchase to negotiating. It does not reserve the vehicle, accept terms for the customer or confirm a payment. The server prevents price changes after payment activity.",
      facts: [
        { label: "Transaction", value: sale.transactionNumber },
        { label: "Agreed price", value: formatKobo(body.agreedPriceKobo) },
        {
          label: "Reservation amount",
          value: body.reservationRequiredKobo
            ? formatKobo(body.reservationRequiredKobo)
            : "Not set",
        },
      ],
      submit: () =>
        apiRequest(`/staff/vehicle-transactions/${sale.id}/negotiate`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Negotiated price</h2>
      <form noValidate onSubmit={form.handleSubmit(review)}>
        <fieldset disabled={disabled}>
          <div className="field">
            <label htmlFor="sale-agreed-price">Agreed price (NGN)</label>
            <input
              id="sale-agreed-price"
              inputMode="decimal"
              {...form.register("agreedPrice")}
              aria-invalid={!!errors.agreedPrice}
              aria-describedby={errors.agreedPrice ? "sale-price-error" : undefined}
            />
            {errors.agreedPrice && (
              <p className="field-error" role="alert" id="sale-price-error">
                {errors.agreedPrice.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="sale-reservation-price">
              Reservation amount (optional, NGN)
            </label>
            <input
              id="sale-reservation-price"
              inputMode="decimal"
              {...form.register("reservation")}
              aria-invalid={!!errors.reservation}
              aria-describedby={
                errors.reservation ? "sale-reservation-error" : "sale-reservation-hint"
              }
            />
            <p className="field-hint" id="sale-reservation-hint">
              Leave blank to clear a previously recorded reservation amount.
            </p>
            {errors.reservation && (
              <p className="field-error" role="alert" id="sale-reservation-error">
                {errors.reservation.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="sale-negotiation-notes">Negotiation notes (optional)</label>
            <textarea
              id="sale-negotiation-notes"
              maxLength={2000}
              {...form.register("notes")}
              aria-invalid={!!errors.notes}
              aria-describedby={
                errors.notes ? "sale-notes-hint sale-notes-error" : "sale-notes-hint"
              }
            />
            <p className="field-hint" id="sale-notes-hint">
              These notes appear in the purchase history, including the customer view.
            </p>
            {errors.notes && (
              <p className="field-error" role="alert" id="sale-notes-error">
                {errors.notes.message}
              </p>
            )}
          </div>
          <button className="button">Review negotiated price</button>
        </fieldset>
      </form>
    </section>
  );
}
type TargetStatus = RequestBody<
  "/staff/vehicle-transactions/{transactionId}/status",
  "post"
>["status"];
export const saleTransitions: Record<
  StaffVehicleSale["status"],
  readonly TargetStatus[]
> = {
  ENQUIRY: ["INSPECTION_SCHEDULED", "NEGOTIATING", "CANCELLED"],
  INSPECTION_SCHEDULED: ["INSPECTION_COMPLETED", "NEGOTIATING", "CANCELLED"],
  INSPECTION_COMPLETED: ["NEGOTIATING", "CANCELLED"],
  NEGOTIATING: ["CANCELLED"],
  PAYMENT_PENDING: ["CANCELLED"],
  RESERVED: ["PAYMENT_PENDING", "CANCELLED"],
  PARTIALLY_PAID: [],
  PAID: [],
  HANDOVER_PENDING: [],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};
const statusSchema = z
  .object({
    status: z.enum([
      "INSPECTION_SCHEDULED",
      "INSPECTION_COMPLETED",
      "NEGOTIATING",
      "PAYMENT_PENDING",
      "CANCELLED",
    ]),
    reason: z.string().trim().max(1000),
  })
  .refine((value) => value.status !== "CANCELLED" || !!value.reason, {
    path: ["reason"],
    message: "Enter a cancellation reason.",
  });
export function VehicleSaleStatusForm({ sale, disabled, onReview }: ReviewProps) {
  const choices = saleTransitions[sale.status];
  const form = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
    defaultValues: { status: choices[0], reason: "" },
  });
  if (!choices.length) return null;
  function review(values: z.infer<typeof statusSchema>) {
    if (disabled || !choices.includes(values.status)) return;
    const body: RequestBody<
      "/staff/vehicle-transactions/{transactionId}/status",
      "post"
    > = {
      status: values.status,
      expectedVersion: sale.version,
      ...(values.reason ? { reason: values.reason } : {}),
    };
    onReview({
      title: "Change this purchase status?",
      description:
        values.status === "CANCELLED"
          ? "This cancels the purchase and may release the vehicle listing. It does not issue a refund. Review any payment activity before proceeding."
          : "This records purchase progress. It does not schedule an inspection appointment, extend a hold or confirm payment.",
      facts: [
        { label: "Transaction", value: sale.transactionNumber },
        { label: "From", value: sale.status.replaceAll("_", " ") },
        { label: "To", value: values.status.replaceAll("_", " ") },
        ...(values.reason ? [{ label: "Reason", value: values.reason }] : []),
      ],
      submit: () =>
        apiRequest(`/staff/vehicle-transactions/${sale.id}/status`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Purchase progress</h2>
      <form noValidate onSubmit={form.handleSubmit(review)}>
        <fieldset disabled={disabled}>
          <div className="field">
            <label htmlFor="sale-next-status">Next purchase status</label>
            <select id="sale-next-status" {...form.register("status")}>
              {choices.map((value) => (
                <option value={value} key={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sale-status-reason">Reason (required for cancellation)</label>
            <textarea
              id="sale-status-reason"
              maxLength={1000}
              {...form.register("reason")}
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby={
                form.formState.errors.reason ? "sale-reason-error" : undefined
              }
            />
            {form.formState.errors.reason && (
              <p className="field-error" role="alert" id="sale-reason-error">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
          <button className="button secondary">Review purchase status</button>
        </fieldset>
      </form>
    </section>
  );
}
