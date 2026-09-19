"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { apiRequest } from "@/lib/api/client";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const invoice = useResource(`/staff/invoices/${invoiceId}`, parseInvoice);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const current = invoice.data;
  const disabled = invoice.loading || !!invoice.error || !!proposal;
  const canIssue = current?.status === "DRAFT";
  const canVoid =
    !!current &&
    ["DRAFT", "ISSUED"].includes(current.status) &&
    !current.payments.some((payment) => payment.status === "SUCCEEDED");
  function review(action: "issue" | "void") {
    if (!current || disabled || (action === "issue" ? !canIssue : !canVoid)) return;
    setMessage(undefined);
    const body: RequestBody<"/staff/invoices/{invoiceId}/issue", "post"> = {
      expectedVersion: current.version,
    };
    setProposal({
      title: action === "issue" ? "Issue this invoice?" : "Void this invoice?",
      description:
        action === "issue"
          ? "The issued invoice becomes available to the customer. Issuing does not confirm or collect a payment."
          : "Voiding closes this invoice. It does not cancel its source order or booking, and it does not refund a payment. The server checks for successful payments before allowing this action.",
      facts: [
        { label: "Invoice", value: current.invoiceNumber },
        { label: "Invoice total", value: formatKobo(current.totalKobo) },
        { label: "Current status", value: current.status },
      ],
      submit: () =>
        apiRequest(`/staff/invoices/${invoiceId}/${action}`, {
          method: "POST",
          body,
          csrf: true,
        }),
    });
  }
  return (
    <>
      <Link className="text-link" href="/admin/invoices">
        Back to invoices
      </Link>
      <h1>Manage invoice</h1>
      <Feedback message={invoice.error} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={invoice.loading || !!proposal}
        onClick={invoice.refresh}
      >
        Refresh invoice
      </button>
      {invoice.loading && <p role="status">Checking invoice…</p>}
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.invoiceNumber}</h2>
            <p className="status">{current.status}</p>
            <dl className="totals">
              <dt>Subtotal</dt>
              <dd>{formatKobo(current.subtotalKobo)}</dd>
              <dt>Tax</dt>
              <dd>{formatKobo(current.taxKobo)}</dd>
              <dt>Deposit credit applied</dt>
              <dd>{formatKobo(current.depositCreditKobo)}</dd>
              <dt>Invoice total</dt>
              <dd>{formatKobo(current.totalKobo)}</dd>
              <dt>Due date</dt>
              <dd>{current.dueAt ? formatBusinessDate(current.dueAt) : "Not set"}</dd>
            </dl>
            {current.issuedAt && <p>Issued {formatBusinessDate(current.issuedAt)}</p>}
            {current.paidAt && (
              <p>Invoice payment recorded {formatBusinessDate(current.paidAt)}</p>
            )}
            <div className="actions">
              {current.order && (
                <Link className="text-link" href={`/admin/orders/${current.order.id}`}>
                  View source order {current.order.orderNumber}
                </Link>
              )}
              {current.booking && (
                <Link
                  className="text-link"
                  href={`/admin/bookings/${current.booking.id}`}
                >
                  View source booking
                </Link>
              )}
              {current.vehicleTransaction && (
                <Link
                  className="text-link"
                  href={`/admin/vehicle-sales/${current.vehicleTransaction.id}`}
                >
                  Vehicle transaction: {current.vehicleTransaction.transactionNumber}
                </Link>
              )}
            </div>
            <div className="actions">
              {canIssue && (
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => review("issue")}
                >
                  Review invoice issue
                </button>
              )}
              {canVoid && (
                <button
                  className="button danger"
                  disabled={disabled}
                  onClick={() => review("void")}
                >
                  Review invoice void
                </button>
              )}
            </div>
            {current.status === "DRAFT" && (
              <p className="field-hint">Draft invoices are not visible to customers.</p>
            )}
          </section>
          <section className="detail-section">
            <h2>Recorded payment requests</h2>
            <p>
              A requested amount is not evidence of payment. Review each recorded status
              separately.
            </p>
            {current.payments.length ? (
              <div className="list">
                {current.payments.map((payment) => (
                  <article className="list-item" key={payment.id}>
                    <div>
                      <h3>{payment.paymentNumber}</h3>
                      <p>{payment.status.replaceAll("_", " ")}</p>
                      {payment.succeededAt && (
                        <p>Confirmed {formatBusinessDate(payment.succeededAt)}</p>
                      )}
                    </div>
                    <strong>{formatKobo(payment.amountKobo)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p>No payment requests are recorded for this invoice.</p>
            )}
          </section>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            invoice.refresh();
          }}
          onSuccess={() =>
            setMessage("Invoice change recorded. Review the refreshed invoice status.")
          }
        />
      )}
    </>
  );
}
