"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
import { ServiceLineTable } from "./service-line-table";
import { ServiceLineEntry } from "./service-line-entry";
export function StaffQuoteRecords({
  booking,
  disabled,
  onReview,
}: {
  booking: StaffBooking;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const draft = booking.quotes.find(
    (quote) => quote.id === editing && quote.status === "DRAFT",
  );
  const canCreate = [
    "REQUESTED",
    "AWAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
  ].includes(booking.status);
  const editorVisible = (editing === "new" && canCreate) || !!draft;
  function review(
    quote: StaffBooking["quotes"][number],
    action: "issue" | "void" | "expire",
  ) {
    if (disabled) return;
    const body: RequestBody<
      "/staff/bookings/{bookingId}/quotes/{quoteId}/issue",
      "post"
    > = { expectedRevision: quote.revision };
    onReview({
      title: `${action === "issue" ? "Issue" : action === "void" ? "Void" : "Expire"} this quotation?`,
      description:
        action === "issue"
          ? "The customer has seven days from issuance to accept or reject the quotation. The server records the new acceptance deadline. Other issued quotations for this booking will be voided."
          : "This closes the quotation for customer acceptance. It does not record a payment or refund.",
      facts: [
        { label: "Quotation", value: quote.quoteNumber },
        { label: "Revision", value: String(quote.revision) },
        { label: "Total", value: formatKobo(quote.totalKobo) },
      ],
      submit: () =>
        apiRequest(`/staff/bookings/${booking.id}/quotes/${quote.id}/${action}`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Quotations</h2>
      {canCreate && !editorVisible && (
        <button
          className="button secondary"
          disabled={disabled}
          onClick={() => setEditing("new")}
        >
          Create quotation
        </button>
      )}
      {((editing === "new" && canCreate) || draft) && (
        <ServiceLineEntry
          key={draft ? `${draft.id}-${draft.revision}` : "new"}
          booking={booking}
          mode="quote"
          quote={draft}
          disabled={disabled}
          onReview={onReview}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
      {booking.quotes.length === 0 ? (
        <p>No quotations recorded.</p>
      ) : (
        booking.quotes.map((quote) => (
          <article className="detail-section" key={quote.id}>
            <h3>{quote.quoteNumber}</h3>
            <p>
              {quote.status} · Version {quote.version} · Revision {quote.revision}
            </p>
            {quote.notes && <p>{quote.notes}</p>}
            <p>
              {quote.status === "DRAFT" ? "Draft expires" : "Expires"}:{" "}
              {quote.expiresAt ? formatBusinessDate(quote.expiresAt) : "Not set"}
            </p>
            <ServiceLineTable
              items={quote.items}
              label={`${quote.quoteNumber} line items`}
            />
            <dl className="totals">
              <dt>Subtotal</dt>
              <dd>{formatKobo(quote.subtotalKobo)}</dd>
              <dt>Tax</dt>
              <dd>{formatKobo(quote.taxKobo)}</dd>
              <dt>Total</dt>
              <dd>{formatKobo(quote.totalKobo)}</dd>
            </dl>
            <div className="actions">
              {quote.status === "DRAFT" && !editorVisible && (
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => setEditing(quote.id)}
                >
                  Edit draft
                </button>
              )}
              {quote.status === "DRAFT" && (
                <button
                  className="button"
                  disabled={disabled || quote.items.length === 0 || !quote.expiresAt}
                  onClick={() => review(quote, "issue")}
                >
                  Review issue
                </button>
              )}
              {["DRAFT", "ISSUED"].includes(quote.status) && (
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => review(quote, "void")}
                >
                  Review void
                </button>
              )}
              {quote.status === "ISSUED" && quote.expiresAt && (
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => review(quote, "expire")}
                >
                  Review expiry
                </button>
              )}
            </div>
            {quote.status === "ISSUED" && (
              <p className="field-hint">
                Expiry can only be recorded after the stated expiry time. The server
                checks the current time.
              </p>
            )}
          </article>
        ))
      )}
    </section>
  );
}
