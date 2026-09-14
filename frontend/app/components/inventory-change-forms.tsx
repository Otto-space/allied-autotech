"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { Inventory, InventoryReservation } from "@/lib/api/inventory-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import type { MutationProposal } from "./mutation-review";
const count = z
  .number({ error: "Enter a whole-number quantity." })
  .int("Enter a whole number.")
  .min(0, "Use zero or more.")
  .max(1000000, "Use at most 1,000,000 units.");
const referenceFields = {
  referenceType: z.enum(["", "ORDER", "WORK_ORDER", "CART", "MANUAL"]),
  referenceId: z.string().trim().max(120, "Use at most 120 characters."),
};
const movementSchema = z
  .object({
    type: z.enum(["STOCK_IN", "RETURN", "RESTOCK", "DAMAGE", "SALE", "ADJUSTMENT"]),
    quantity: count,
    note: z.string().trim().max(1000, "Use at most 1,000 characters."),
    ...referenceFields,
  })
  .superRefine((value, context) => {
    if (value.type !== "ADJUSTMENT" && value.quantity < 1)
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Enter at least one unit.",
      });
    if (value.type === "ADJUSTMENT" && !value.note)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Explain the reason for this stock adjustment.",
      });
    if (!!value.referenceType !== !!value.referenceId)
      context.addIssue({
        code: "custom",
        path: ["referenceId"],
        message: "Provide both a reference type and its number, or leave both blank.",
      });
  });
const reservationSchema = z
  .object({
    quantity: count.min(1, "Enter at least one unit."),
    expiresAt: z.string().min(1, "Choose an expiry."),
    customerId: z
      .string()
      .trim()
      .refine(
        (value) => !value || z.string().uuid().safeParse(value).success,
        "Enter a valid customer profile reference, or leave it blank.",
      ),
    ...referenceFields,
  })
  .superRefine((value, context) => {
    if (!!value.referenceType !== !!value.referenceId)
      context.addIssue({
        code: "custom",
        path: ["referenceId"],
        message: "Provide both a reference type and its number, or leave both blank.",
      });
  });
type Common = {
  inventory: Inventory;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
};
function references(value: {
  referenceType: z.infer<typeof referenceFields.referenceType>;
  referenceId: string;
}): { referenceType?: "ORDER" | "WORK_ORDER" | "CART" | "MANUAL"; referenceId?: string } {
  return value.referenceType
    ? { referenceType: value.referenceType, referenceId: value.referenceId }
    : {};
}
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  ) : null;
}
export function InventoryMovementForm({
  inventory,
  disabled,
  onReview,
  reservation,
  onClearReservation,
}: Common & {
  reservation: InventoryReservation | null;
  onClearReservation: () => void;
}) {
  const form = useForm<z.infer<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      type: reservation ? "SALE" : "STOCK_IN",
      quantity: reservation?.quantity ?? 1,
      note: "",
      referenceType: "",
      referenceId: "",
    },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const errors = form.formState.errors;
  function review(values: z.infer<typeof movementSchema>) {
    if (disabled) return;
    const common = {
      ...references(values),
      ...(values.note ? { note: values.note } : {}),
    };
    const body: RequestBody<"/staff/inventory/{inventoryId}/movements", "post"> =
      values.type === "ADJUSTMENT"
        ? {
            ...common,
            type: "ADJUSTMENT",
            targetQuantity: values.quantity,
            note: values.note,
          }
        : values.type === "SALE"
          ? {
              ...common,
              type: "SALE",
              quantity: values.quantity,
              ...(reservation ? { reservationId: reservation.id } : {}),
            }
          : { ...common, type: values.type, quantity: values.quantity };
    const key = newIdempotencyKey();
    onReview({
      title: "Record this stock movement?",
      description:
        values.type === "ADJUSTMENT"
          ? "This sets the total on-hand quantity to the entered count. Reserved stock remains protected by the server."
          : values.type === "SALE"
            ? "This records stock leaving inventory. It does not create an order, invoice or payment. Use the order workflow for an existing customer order."
            : "Confirm that this physical stock movement has occurred. The server will check current stock before saving.",
      facts: [
        { label: "Part", value: inventory.product.name },
        { label: "Branch", value: inventory.branch.name },
        { label: "Movement", value: values.type.replaceAll("_", " ") },
        {
          label: values.type === "ADJUSTMENT" ? "New on-hand count" : "Units",
          value: String(values.quantity),
        },
        ...(reservation ? [{ label: "Reservation", value: reservation.id }] : []),
        ...(values.note ? [{ label: "Note", value: values.note }] : []),
        ...(values.referenceId
          ? [
              {
                label: "Reference",
                value: `${values.referenceType}: ${values.referenceId}`,
              },
            ]
          : []),
      ],
      retrySafely: true,
      submit: () =>
        apiRequest(`/staff/inventory/${inventory.id}/movements`, {
          method: "POST",
          csrf: true,
          idempotencyKey: key,
          body,
        }),
    });
  }
  return (
    <section className="detail-section" id="inventory-movement">
      <h2>Record stock movement</h2>
      {reservation && (
        <div className="notice">
          <p>
            Consume reservation {reservation.id}: {reservation.quantity} units. Expiry:{" "}
            {formatBusinessDate(reservation.expiresAt)}.
          </p>
          <button
            type="button"
            className="text-link"
            disabled={disabled}
            onClick={onClearReservation}
          >
            Use an unreserved movement instead
          </button>
        </div>
      )}
      <form onSubmit={form.handleSubmit(review)} noValidate>
        <fieldset disabled={disabled}>
          <div className="field">
            <label htmlFor="movement-type">Movement type</label>
            <select
              id="movement-type"
              {...form.register("type")}
              disabled={!!reservation}
            >
              {["STOCK_IN", "RETURN", "RESTOCK", "DAMAGE", "SALE", "ADJUSTMENT"].map(
                (value) => (
                  <option value={value} key={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="movement-quantity">
              {type === "ADJUSTMENT" ? "Counted total on hand" : "Units moved"}
            </label>
            <input
              id="movement-quantity"
              type="number"
              min={type === "ADJUSTMENT" ? 0 : 1}
              max={1000000}
              step={1}
              readOnly={!!reservation}
              {...form.register("quantity", { valueAsNumber: true })}
              aria-invalid={!!errors.quantity}
              aria-describedby="movement-quantity-error"
            />
            <FieldError id="movement-quantity-error" message={errors.quantity?.message} />
          </div>
          <div className="field">
            <label htmlFor="movement-note">
              Note {type === "ADJUSTMENT" ? "(required)" : "(optional)"}
            </label>
            <textarea
              id="movement-note"
              maxLength={1000}
              {...form.register("note")}
              aria-invalid={!!errors.note}
              aria-describedby="movement-note-error"
            />
            <FieldError id="movement-note-error" message={errors.note?.message} />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="movement-reference-type">Reference type (optional)</label>
              <select id="movement-reference-type" {...form.register("referenceType")}>
                <option value="">No reference</option>
                {["MANUAL", "ORDER", "WORK_ORDER", "CART"].map((value) => (
                  <option value={value} key={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="movement-reference">Reference number or ID</label>
              <input
                id="movement-reference"
                maxLength={120}
                {...form.register("referenceId")}
                aria-invalid={!!errors.referenceId}
                aria-describedby="movement-reference-error"
              />
              <FieldError
                id="movement-reference-error"
                message={errors.referenceId?.message}
              />
            </div>
          </div>
          <button className="button">Review stock movement</button>
        </fieldset>
      </form>
    </section>
  );
}
export function InventoryReservationForm({ inventory, disabled, onReview }: Common) {
  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      quantity: 1,
      expiresAt: "",
      customerId: "",
      referenceType: "",
      referenceId: "",
    },
  });
  const errors = form.formState.errors;
  function review(values: z.infer<typeof reservationSchema>, now: number) {
    if (disabled) return;
    const expiresAt = `${values.expiresAt}:00+01:00`;
    const time = new Date(expiresAt).getTime();
    if (
      !z.iso.datetime({ offset: true }).safeParse(expiresAt).success ||
      time <= now ||
      time > now + 7 * 24 * 60 * 60 * 1000
    ) {
      form.setError(
        "expiresAt",
        { message: "Choose a future expiry within seven days, in Lagos time." },
        { shouldFocus: true },
      );
      return;
    }
    const body: RequestBody<"/staff/inventory/{inventoryId}/reservations", "post"> = {
      quantity: values.quantity,
      expiresAt,
      ...references(values),
      ...(values.customerId ? { customerId: values.customerId } : {}),
    };
    const key = newIdempotencyKey();
    onReview({
      title: "Reserve these parts?",
      description:
        "Reserved units become unavailable for other sales until consumed or released. This does not record a payment or extend any existing booking or order deadline.",
      facts: [
        { label: "Part", value: inventory.product.name },
        { label: "Branch", value: inventory.branch.name },
        { label: "Units", value: String(values.quantity) },
        { label: "Expires", value: formatBusinessDate(expiresAt) },
        ...(values.customerId
          ? [{ label: "Customer profile", value: values.customerId }]
          : []),
        ...(values.referenceId
          ? [
              {
                label: "Reference",
                value: `${values.referenceType}: ${values.referenceId}`,
              },
            ]
          : []),
      ],
      retrySafely: true,
      submit: () =>
        apiRequest(`/staff/inventory/${inventory.id}/reservations`, {
          method: "POST",
          csrf: true,
          idempotencyKey: key,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Reserve stock</h2>
      <p>
        Use a future expiry within seven days. The server checks current available stock.
      </p>
      <form
        onSubmit={(event) => {
          const now = Date.now();
          void form.handleSubmit((values) => review(values, now))(event);
        }}
        noValidate
      >
        <fieldset disabled={disabled}>
          <div className="field">
            <label htmlFor="reserve-quantity">Units to reserve</label>
            <input
              id="reserve-quantity"
              type="number"
              min={1}
              max={1000000}
              step={1}
              {...form.register("quantity", { valueAsNumber: true })}
              aria-invalid={!!errors.quantity}
              aria-describedby="reserve-quantity-error"
            />
            <FieldError id="reserve-quantity-error" message={errors.quantity?.message} />
          </div>
          <div className="field">
            <label htmlFor="reserve-expiry">Reservation expiry (Lagos time)</label>
            <input
              id="reserve-expiry"
              type="datetime-local"
              {...form.register("expiresAt")}
              aria-invalid={!!errors.expiresAt}
              aria-describedby="reserve-expiry-error"
            />
            <FieldError id="reserve-expiry-error" message={errors.expiresAt?.message} />
          </div>
          <div className="field">
            <label htmlFor="reserve-customer">
              Customer profile reference (optional)
            </label>
            <input
              id="reserve-customer"
              {...form.register("customerId")}
              autoComplete="off"
              aria-invalid={!!errors.customerId}
              aria-describedby="reserve-customer-hint reserve-customer-error"
            />
            <p id="reserve-customer-hint" className="field-hint">
              Use an existing customer profile reference only when supplied for this stock
              hold. Leave blank for an unlinked reservation.
            </p>
            <FieldError
              id="reserve-customer-error"
              message={errors.customerId?.message}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="reserve-reference-type">
                Reservation reference type (optional)
              </label>
              <select id="reserve-reference-type" {...form.register("referenceType")}>
                <option value="">No reference</option>
                {["MANUAL", "ORDER", "WORK_ORDER", "CART"].map((value) => (
                  <option value={value} key={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reserve-reference">
                Reservation reference number or ID
              </label>
              <input
                id="reserve-reference"
                maxLength={120}
                {...form.register("referenceId")}
                aria-invalid={!!errors.referenceId}
                aria-describedby="reserve-reference-error"
              />
              <FieldError
                id="reserve-reference-error"
                message={errors.referenceId?.message}
              />
            </div>
          </div>
          <button className="button">Review stock reservation</button>
        </fieldset>
      </form>
    </section>
  );
}
export function ReorderLevelForm({ inventory, disabled, onReview }: Common) {
  const form = useForm<{ reorderLevel: number }>({
    resolver: zodResolver(z.object({ reorderLevel: count })),
    defaultValues: { reorderLevel: inventory.reorderLevel },
  });
  function review(values: { reorderLevel: number }) {
    if (disabled) return;
    const body: RequestBody<"/staff/inventory/{inventoryId}", "patch"> = {
      reorderLevel: values.reorderLevel,
      expectedVersion: inventory.version,
    };
    onReview({
      title: "Update the reorder level?",
      description:
        "The low-stock filter uses available stock and this threshold. This does not place an order or change stock quantities.",
      facts: [
        { label: "Part", value: inventory.product.name },
        { label: "Reorder level", value: String(values.reorderLevel) },
      ],
      submit: () =>
        apiRequest(`/staff/inventory/${inventory.id}`, {
          method: "PATCH",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Reorder level</h2>
      <form onSubmit={form.handleSubmit(review)} noValidate>
        <div className="field">
          <label htmlFor="reorder-level">Low-stock threshold</label>
          <input
            id="reorder-level"
            type="number"
            min={0}
            max={1000000}
            step={1}
            {...form.register("reorderLevel", { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.reorderLevel}
            aria-describedby="reorder-error"
          />
          <FieldError
            id="reorder-error"
            message={form.formState.errors.reorderLevel?.message}
          />
        </div>
        <button className="button secondary" disabled={disabled}>
          Review reorder level
        </button>
      </form>
    </section>
  );
}
