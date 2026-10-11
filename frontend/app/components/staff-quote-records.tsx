"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
import { ServiceLineTable } from "./service-line-table";
import { ServiceLineEntry } from "./service-line-entry";
import "./staff-quotations.css";
export function StaffQuoteRecords({
  booking,
  disabled,
  canChange,
  canAuthor,
  checkingAccess,
  onReview,
}: {
  booking: StaffBooking;
  disabled: boolean;
  canChange: boolean;
  canAuthor: boolean;
  checkingAccess: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  function closeEditor() {
    setEditing(null);
    heading.current?.focus();
  }
  const draft = booking.quotes.find(
    (quote) => quote.id === editing && quote.status === "DRAFT",
  );
  const canCreate =
    canAuthor &&
    ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"].includes(
      booking.status,
    );
  const editorVisible = canAuthor && ((editing === "new" && canCreate) || !!draft);
  function review(
    quote: StaffBooking["quotes"][number],
    action: "issue" | "void" | "expire",
  ) {
    if (disabled || !canChange) return;
    const body: RequestBody<
      "/staff/bookings/{bookingId}/quotes/{quoteId}/issue",
      "post"
    > = { expectedRevision: quote.revision };
    onReview({
      presentation: "quotation",
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
    <section
      className="detail-section staff-quotations"
      id="quotations"
      aria-labelledby="quotations-heading"
    >
      <div className="quotation-section-heading">
        <div>
          <h2 id="quotations-heading" ref={heading} tabIndex={-1}>
            Quotations
          </h2>
          <p>Prepare a draft, review the saved totals, then issue it to the customer.</p>
        </div>
        {canCreate && !editorVisible && (
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => setEditing("new")}
          >
            Create quotation
          </button>
        )}
      </div>
      {checkingAccess ? (
        <p className="field-hint" role="status">
          Checking quotation access…
        </p>
      ) : (
        !canChange && (
          <p className="quotation-access-note">
            Quotation changes are available to the assigned workshop staff and authorised
            administrators.
          </p>
        )
      )}
      {canChange && !canAuthor && (
        <p className="quotation-access-note">
          A staff profile is required to create or replace a draft.
        </p>
      )}
      {editorVisible && (
        <ServiceLineEntry
          key={draft ? `${draft.id}-${draft.revision}` : "new"}
          booking={booking}
          mode="quote"
          quote={draft}
          disabled={disabled}
          onReview={onReview}
          onSaved={closeEditor}
          onCancel={closeEditor}
        />
      )}
      {booking.quotes.length === 0 ? (
        <div className="quotation-empty">
          <h3>No quotations recorded.</h3>
          <p>
            {canCreate
              ? "Create a draft when the scope of work is ready. You can review it before sharing it with the customer."
              : "Saved quotations will appear here when the workshop prepares them."}
          </p>
        </div>
      ) : (
        <div className="quotation-records">
          <h3>Saved quotations</h3>
          {booking.quotes.map((quote) => (
            <article
              className="quotation-record"
              key={quote.id}
              aria-label={quote.quoteNumber}
            >
              <header className="quotation-record-heading">
                <div>
                  <h4>{quote.quoteNumber}</h4>
                  <p className="quotation-version">
                    <span className="quotation-status" data-status={quote.status}>
                      {quote.status.charAt(0) + quote.status.slice(1).toLowerCase()}
                    </span>
                    <span>
                      Version {quote.version} · Revision {quote.revision}
                    </span>
                  </p>
                </div>
                <p className="quotation-deadline">
                  {quote.status === "DRAFT" ? "Draft expires" : "Expires"}:{" "}
                  {quote.expiresAt ? formatBusinessDate(quote.expiresAt) : "Not set"}
                </p>
              </header>
              {quote.notes && <p className="quotation-notes">{quote.notes}</p>}
              <ServiceLineTable
                items={quote.items}
                label={`${quote.quoteNumber} line items`}
              />
              <dl className="quotation-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatKobo(quote.subtotalKobo)}</dd>
                </div>
                <div>
                  <dt>Tax</dt>
                  <dd>{formatKobo(quote.taxKobo)}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatKobo(quote.totalKobo)}</dd>
                </div>
              </dl>
              {canChange && (
                <div className="actions">
                  {canAuthor && quote.status === "DRAFT" && !editorVisible && (
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
              )}
              {quote.status === "ISSUED" && (
                <p className="field-hint">
                  Expiry can only be recorded after the stated expiry time. The server
                  checks the current time.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
