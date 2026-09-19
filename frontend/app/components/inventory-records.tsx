"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, newIdempotencyKey } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseInventoryHistory,
  parseInventoryReservations,
  type InventoryReservation,
} from "@/lib/api/inventory-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function InventoryHistory({ inventoryId }: { inventoryId: string }) {
  const pagination = useCursorPage();
  const [type, setType] = useState("");
  const history = useResource(
    `/staff/inventory/${inventoryId}/history?limit=25${type ? `&type=${type}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseInventoryHistory,
  );
  return (
    <section className="detail-section" id="inventory-history">
      <h2>Stock movement history</h2>
      <div className="field">
        <label htmlFor="history-type">History movement type</label>
        <select
          id="history-type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All movements</option>
          {[
            "STOCK_IN",
            "SALE",
            "RESERVATION",
            "RESERVATION_RELEASE",
            "RETURN",
            "ADJUSTMENT",
            "DAMAGE",
            "RESTOCK",
          ].map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={history.error} />
      <button
        className="button secondary"
        disabled={history.loading}
        onClick={history.refresh}
      >
        Refresh stock history
      </button>
      {history.loading && <p role="status">Checking stock history…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Stock movement history"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Movement & time</th>
              <th>On hand before → after</th>
              <th>Reserved before → after</th>
              <th>Reference & note</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.type.replaceAll("_", " ")}
                  <p className="muted">{formatBusinessDate(item.createdAt)}</p>
                </td>
                <td>
                  {item.quantityBefore} → {item.quantityAfter}
                  <p className="muted">
                    Change: {item.quantityDelta > 0 ? "+" : ""}
                    {item.quantityDelta}
                  </p>
                </td>
                <td>
                  {item.reservedBefore} → {item.reservedAfter}
                  <p className="muted">
                    Change: {item.reservedDelta > 0 ? "+" : ""}
                    {item.reservedDelta}
                  </p>
                </td>
                <td>
                  {item.referenceId
                    ? `${item.referenceType ?? "Reference"}: ${item.referenceId}`
                    : "No reference"}
                  {item.note && <p>{item.note}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!history.loading && !history.error && history.data?.items.length === 0 && (
        <p>No movements match this page and filter.</p>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={history.data?.nextCursor}
        disabled={history.loading || !!history.error}
        label="Stock history"
      />
    </section>
  );
}
type ReservationProps = {
  inventoryId: string;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onConsume: (reservation: InventoryReservation) => void;
};
export function InventoryReservations({
  inventoryId,
  disabled,
  onReview,
  onConsume,
}: ReservationProps) {
  const pagination = useCursorPage();
  const [status, setStatus] = useState("");
  const records = useResource(
    `/staff/inventory/${inventoryId}/reservations?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseInventoryReservations,
  );
  return (
    <section className="detail-section">
      <h2>Stock reservations</h2>
      <div className="field">
        <label htmlFor="reservation-status">Reservation status</label>
        <select
          id="reservation-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {["ACTIVE", "RELEASED", "CONSUMED", "EXPIRED"].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={records.error} />
      <button
        className="button secondary"
        disabled={records.loading}
        onClick={records.refresh}
      >
        Refresh reservations
      </button>
      {records.loading && <p role="status">Checking stock reservations…</p>}
      {records.data?.items.map((reservation) => (
        <article className="detail-section" key={reservation.id}>
          <h3>Reservation {reservation.id.slice(-8)}</h3>
          <p>
            {reservation.status} · {reservation.quantity} units
          </p>
          <p>Expires {formatBusinessDate(reservation.expiresAt)}</p>
          {reservation.referenceId && (
            <p>
              {reservation.referenceType ?? "Reference"}: {reservation.referenceId}
            </p>
          )}
          {reservation.customer && (
            <p className="muted">Customer profile: {reservation.customer.id}</p>
          )}
          {reservation.status === "ACTIVE" && (
            <ReservationActions
              inventoryId={inventoryId}
              reservation={reservation}
              disabled={disabled || records.loading || !!records.error}
              onReview={onReview}
              onConsume={onConsume}
            />
          )}
        </article>
      ))}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p>No reservations match this page and filter.</p>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Stock reservations"
      />
    </section>
  );
}
function ReservationActions({
  inventoryId,
  reservation,
  disabled,
  onReview,
  onConsume,
}: ReservationProps & { reservation: InventoryReservation }) {
  const form = useForm<{ note: string }>({
    resolver: zodResolver(
      z.object({ note: z.string().trim().max(1000, "Use at most 1,000 characters.") }),
    ),
    defaultValues: { note: "" },
  });
  function review(values: { note: string }) {
    if (disabled) return;
    const body: RequestBody<
      "/staff/inventory/{inventoryId}/reservations/{reservationId}/release",
      "post"
    > = values.note ? { note: values.note } : {};
    const key = newIdempotencyKey();
    onReview({
      title: "Release this stock reservation?",
      description:
        "This returns reserved units to available stock. It does not cancel an order or issue a refund. The server determines whether the reservation has already expired.",
      facts: [
        { label: "Reservation", value: reservation.id },
        { label: "Units", value: String(reservation.quantity) },
        ...(values.note ? [{ label: "Note", value: values.note }] : []),
      ],
      retrySafely: true,
      submit: () =>
        apiRequest(
          `/staff/inventory/${inventoryId}/reservations/${reservation.id}/release`,
          { method: "POST", csrf: true, idempotencyKey: key, body },
        ),
    });
  }
  return (
    <form onSubmit={form.handleSubmit(review)} noValidate>
      <div className="field">
        <label htmlFor={`release-note-${reservation.id}`}>Release note (optional)</label>
        <input
          id={`release-note-${reservation.id}`}
          maxLength={1000}
          {...form.register("note")}
          aria-invalid={!!form.formState.errors.note}
          aria-describedby={
            form.formState.errors.note ? `release-error-${reservation.id}` : undefined
          }
        />
        {form.formState.errors.note && (
          <p id={`release-error-${reservation.id}`} role="alert" className="field-error">
            {form.formState.errors.note.message}
          </p>
        )}
      </div>
      <div className="actions">
        <button className="button secondary" disabled={disabled}>
          Review release
        </button>
        <button
          className="button secondary"
          disabled={disabled}
          type="button"
          onClick={() => onConsume(reservation)}
        >
          Record reserved sale
        </button>
      </div>
      <p className="field-hint">
        A reserved sale consumes all {reservation.quantity} units and must pass the server
        expiry check.
      </p>
    </form>
  );
}
