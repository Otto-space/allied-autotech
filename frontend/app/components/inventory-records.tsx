"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, newIdempotencyKey } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { type InventoryReservation } from "@/lib/api/inventory-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import {
  parseWorkInventoryHistory,
  parseWorkInventoryReservations,
  type InventoryProposal,
} from "@/lib/admin/work-inventory-detail";
export function InventoryHistory({
  inventoryId,
  revision = 0,
}: {
  inventoryId: string;
  revision?: number;
}) {
  const pagination = useCursorPage();
  const [type, setType] = useState("");
  const history = useResource(
    `/staff/inventory/${inventoryId}/history?limit=25${type ? `&type=${type}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    useCallback(
      (value: unknown) => {
        const page = parseWorkInventoryHistory(value);
        if (type && page.items.some((row) => row.type !== type))
          throw Error("History does not match the selected movement type");
        return page;
      },
      [type],
    ),
    undefined,
    { refreshKey: revision },
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
      <Feedback message={history.error || history.refreshError} />
      {(history.error || history.refreshError) && history.data && (
        <p>
          Previously loaded history may be out of date. Refresh before relying on these
          records.
        </p>
      )}
      <button
        className="button secondary"
        disabled={history.loading || history.refreshing}
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
              <th scope="col">Movement & time</th>
              <th scope="col">On hand before → after</th>
              <th scope="col">Reserved before → after</th>
              <th scope="col">Reference & note</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Movement & time">
                  {item.type.replaceAll("_", " ")}
                  <p className="muted">{formatBusinessDate(item.createdAt)}</p>
                </td>
                <td data-label="On hand before and after">
                  {item.quantityBefore} → {item.quantityAfter}
                  <p className="muted">
                    Change: {item.quantityDelta > 0 ? "+" : ""}
                    {item.quantityDelta}
                  </p>
                </td>
                <td data-label="Reserved before and after">
                  {item.reservedBefore} → {item.reservedAfter}
                  <p className="muted">
                    Change: {item.reservedDelta > 0 ? "+" : ""}
                    {item.reservedDelta}
                  </p>
                </td>
                <td data-label="Reference & note">
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
        disabled={
          history.loading ||
          history.refreshing ||
          !!history.error ||
          !!history.refreshError
        }
        label="Stock history"
      />
    </section>
  );
}
type ReservationProps = {
  inventoryId: string;
  revision?: number;
  disabled: boolean;
  onReview: (proposal: InventoryProposal) => void;
  onConsume: (reservation: InventoryReservation) => void;
};
export function InventoryReservations({
  inventoryId,
  revision = 0,
  disabled,
  onReview,
  onConsume,
}: ReservationProps) {
  const pagination = useCursorPage();
  const [status, setStatus] = useState("");
  const records = useResource(
    `/staff/inventory/${inventoryId}/reservations?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    useCallback(
      (value: unknown) => {
        const page = parseWorkInventoryReservations(value);
        if (status && page.items.some((row) => row.status !== status))
          throw Error("Reservations do not match the selected status");
        return page;
      },
      [status],
    ),
    undefined,
    { refreshKey: revision },
  );
  return (
    <section className="detail-section" id="inventory-reservations">
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
      <Feedback message={records.error || records.refreshError} />
      {(records.error || records.refreshError) && records.data && (
        <p>
          Previously loaded reservations may be out of date. Changes remain blocked until
          refreshed.
        </p>
      )}
      <button
        className="button secondary"
        disabled={records.loading || records.refreshing}
        onClick={records.refresh}
      >
        Refresh reservations
      </button>
      {records.loading && <p role="status">Checking stock reservations…</p>}
      {records.data?.items.map((reservation) => (
        <article className="wid-reservation" key={reservation.id}>
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
              disabled={
                disabled ||
                records.loading ||
                records.refreshing ||
                !!records.error ||
                !!records.refreshError
              }
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
        disabled={
          records.loading ||
          records.refreshing ||
          !!records.error ||
          !!records.refreshError
        }
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
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
      operation: "release",
      input: body,
      reservationId: reservation.id,
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
    <form
      data-draft-key={JSON.stringify([
        "inventory-records:1",
        reservation?.id,
        inventoryId,
      ])}
      onSubmit={form.handleSubmit(review)}
      noValidate
    >
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
        {Date.parse(reservation.expiresAt) > now && (
          <button
            className="button secondary"
            disabled={disabled}
            type="button"
            onClick={() => onConsume(reservation)}
          >
            Record reserved sale
          </button>
        )}
      </div>
      {Date.parse(reservation.expiresAt) <= now && (
        <p className="field-hint">
          The recorded expiry has passed. Release checks the server?s expired status.
        </p>
      )}
      <p className="field-hint">
        A reserved sale consumes all {reservation.quantity} units and must pass the server
        expiry check.
      </p>
    </form>
  );
}
