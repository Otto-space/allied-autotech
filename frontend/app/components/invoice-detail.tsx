"use client";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CreatePaymentRequest } from "./create-payment-request";
export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const invoice = useResource(
    `/customers/invoices/${encodeURIComponent(invoiceId)}`,
    parseInvoice,
  );
  const current = invoice.data;
  return (
    <>
      <Link className="text-link" href="/dashboard/invoices">
        ← Your invoices
      </Link>
      <h1>Invoice details</h1>
      <Feedback message={invoice.error} />
      <button
        className="button secondary"
        disabled={invoice.loading}
        onClick={invoice.refresh}
      >
        Refresh invoice
      </button>
      {invoice.loading && <p role="status">Checking invoice…</p>}
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.invoiceNumber}</h2>
            <span className="status">{current.status}</span>
            <dl className="totals">
              <dt>Subtotal</dt>
              <dd>{formatKobo(current.subtotalKobo)}</dd>
              <dt>Tax</dt>
              <dd>{formatKobo(current.taxKobo)}</dd>
              <dt>Deposit credit applied</dt>
              <dd>{formatKobo(current.depositCreditKobo)}</dd>
              <dt>Invoice total</dt>
              <dd>{formatKobo(current.totalKobo)}</dd>
            </dl>
            {current.issuedAt && <p>Issued {formatBusinessDate(current.issuedAt)}</p>}
            {current.dueAt && <p>Due {formatBusinessDate(current.dueAt)}</p>}
            {current.paidAt && (
              <p>Payment recorded {formatBusinessDate(current.paidAt)}</p>
            )}
            <div className="actions">
              {current.order && (
                <Link
                  className="text-link"
                  href={`/dashboard/orders/${current.order.id}`}
                >
                  View order details →
                </Link>
              )}
              {current.booking && (
                <Link
                  className="text-link"
                  href={`/dashboard/bookings/${current.booking.id}`}
                >
                  View booking & quotation →
                </Link>
              )}
              {current.vehicleTransaction && (
                <Link
                  className="text-link"
                  href={`/dashboard/vehicle-transactions/${current.vehicleTransaction.id}`}
                >
                  View vehicle purchase →
                </Link>
              )}
            </div>
          </section>
          <section className="detail-section">
            <h2>Payment requests</h2>
            {current.payments.length ? (
              <div className="list">
                {current.payments.map((payment) => (
                  <article className="list-item" key={payment.id}>
                    <div>
                      <Link
                        className="text-link"
                        href={`/dashboard/payments/${payment.id}`}
                      >
                        {payment.paymentNumber}
                      </Link>
                      <p>{payment.status.replaceAll("_", " ")}</p>
                    </div>
                    <strong>{formatKobo(payment.amountKobo)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p>No payment requests are recorded for this invoice.</p>
            )}
            {current.booking &&
              current.status === "ISSUED" &&
              BigInt(current.totalKobo) > BigInt(0) &&
              !invoice.loading &&
              !invoice.error &&
              current.payments.every((payment) =>
                ["CANCELLED", "EXPIRED"].includes(payment.status),
              ) && (
                <CreatePaymentRequest
                  key={current.id}
                  target={{
                    targetType: "INVOICE",
                    targetId: current.id,
                    purpose: "SERVICE_INVOICE",
                  }}
                  label="Prepare invoice payment"
                />
              )}
          </section>
        </>
      )}
    </>
  );
}
