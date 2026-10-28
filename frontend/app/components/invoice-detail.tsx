"use client";
import { NotificationRecordContext } from "./notification-record-context";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FileText, RefreshCw, ReceiptText } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import { invoiceDocumentSchema, type InvoiceDocument } from "@/lib/api/document-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CreatePaymentRequest } from "./create-payment-request";
import { DocumentActions } from "./document-actions";
import "./invoice-detail.css";

const labels = { DRAFT: "Draft", ISSUED: "Issued", PAID: "Paid", VOID: "Void" };
const paymentLabels: Record<string, string> = {
  REQUIRES_PAYMENT: "Awaiting payment",
  REQUIRES_REVIEW: "Needs review",
  PROCESSING: "Processing",
  SUCCEEDED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};
export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parse = useCallback(
    (value: unknown) => {
      const record = parseInvoice(value);
      if (
        record.id !== invoiceId ||
        record.status === "DRAFT" ||
        new Set(record.payments.map((payment) => payment.id)).size !==
          record.payments.length
      )
        throw new Error("Invalid invoice record");
      return record;
    },
    [invoiceId],
  );
  const parseDocument = useCallback(
    (value: unknown) => {
      const record = invoiceDocumentSchema.parse(value);
      if (record.id !== invoiceId) throw new Error("Mismatched document");
      return record;
    },
    [invoiceId],
  );
  const invoice = useResource(
    `/customers/invoices/${encodeURIComponent(invoiceId)}`,
    parse,
  );
  const document = useResource(
    `/customers/invoices/${encodeURIComponent(invoiceId)}/document`,
    parseDocument,
  );
  const current = invoice.data;
  const ready =
    !!current &&
    !invoice.loading &&
    !invoice.refreshing &&
    !invoice.error &&
    !invoice.refreshError;
  const paper =
    current &&
    document.data &&
    document.data.version === current.version &&
    document.data.status === current.status &&
    document.data.totalKobo === current.totalKobo &&
    document.data.subtotalKobo === current.subtotalKobo &&
    document.data.taxKobo === current.taxKobo &&
    document.data.depositCreditKobo === current.depositCreditKobo
      ? document.data
      : undefined;
  const documentReady =
    ready &&
    !!paper &&
    !document.loading &&
    !document.refreshing &&
    !document.error &&
    !document.refreshError;
  const paymentEligible =
    current?.booking &&
    current.status === "ISSUED" &&
    BigInt(current.totalKobo) > BigInt(0) &&
    (!current.dueAt ||
      (Number.isFinite(Date.parse(current.dueAt)) && Date.parse(current.dueAt) > now)) &&
    current.payments.every((payment) =>
      ["CANCELLED", "EXPIRED"].includes(payment.status),
    ) &&
    (!paper ||
      paper.paymentRequests.every((payment) =>
        ["CANCELLED", "EXPIRED"].includes(payment.status),
      ));
  const requests = documentReady ? paper.paymentRequests : (current?.payments ?? []);
  function refresh() {
    invoice.refresh();
    document.refresh();
  }
  return (
    <div className="invoice-detail">
      <nav className="breadcrumbs dashboard-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Overview</Link>
        <span aria-hidden="true">/</span>
        <Link href="/dashboard/invoices">Invoices</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current?.invoiceNumber ?? "Invoice details"}</span>
      </nav>
      <header className="invoice-heading">
        <h1>Invoice details</h1>
        <button
          className="button secondary"
          disabled={invoice.loading || document.loading}
          onClick={refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh invoice
        </button>
      </header>
      <Feedback message={invoice.error ?? invoice.refreshError} />
      {invoice.loading && <p role="status">Checking invoice…</p>}
      {current &&
        !invoice.loading &&
        !invoice.refreshing &&
        !invoice.error &&
        !invoice.refreshError && (
          <NotificationRecordContext resourceType="INVOICE" resourceId={current.id} />
        )}
      {current && (
        <>
          <WorkflowProgress workflow="invoice" status={current.status} />
          <div className="invoice-layout">
            <aside className="invoice-aside">
              <section className="invoice-summary" aria-label="Invoice summary">
                <span>Invoice total</span>
                <strong className="invoice-amount">
                  {formatKobo(current.totalKobo)}
                </strong>
                <span className="invoice-status" data-status={current.status}>
                  {labels[current.status]}
                </span>
                {paymentEligible ? (
                  <CreatePaymentRequest
                    key={current.id}
                    invoice={current}
                    disabled={!ready}
                  />
                ) : (
                  <p>
                    {current.status === "VOID"
                      ? "This invoice is void. Do not use it to make a payment."
                      : current.status === "PAID"
                        ? "Payment is recorded for this invoice. Keep the invoice and any available receipts for your records."
                        : "Check the payment requests below before making a payment."}
                  </p>
                )}
              </section>
              <section
                className="invoice-related"
                aria-labelledby="invoice-related-title"
              >
                <h2 id="invoice-related-title">Related record</h2>
                {current.order && (
                  <Link href={`/dashboard/orders/${current.order.id}`}>
                    <FileText size={18} aria-hidden="true" />
                    <span>View order details</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                )}
                {current.booking && (
                  <Link href={`/dashboard/bookings/${current.booking.id}`}>
                    <FileText size={18} aria-hidden="true" />
                    <span>View booking &amp; quotation</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                )}
                {current.vehicleTransaction && (
                  <Link
                    href={`/dashboard/vehicle-transactions/${current.vehicleTransaction.id}`}
                  >
                    <FileText size={18} aria-hidden="true" />
                    <span>View vehicle purchase</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                )}
              </section>
            </aside>
            <div className="invoice-content">
              <DocumentActions
                key={current.id}
                kind="invoice"
                id={current.id}
                disabled={!documentReady}
              />
              <Feedback message={document.error ?? document.refreshError} />
              {document.loading && <p role="status">Preparing invoice details…</p>}
              {paper ? (
                <InvoiceSheet document={paper} />
              ) : (
                <section className="invoice-sheet" aria-label="Invoice record">
                  <h2>{current.invoiceNumber}</h2>
                  <InvoiceTotals document={current} />
                  <p>
                    The document details are not available yet. Refresh to check again.
                  </p>
                </section>
              )}
              {paper && !documentReady && (
                <p className="invoice-note">
                  Refresh the invoice before downloading or sharing its document.
                </p>
              )}
            </div>
          </div>
          <section className="invoice-payments" aria-labelledby="invoice-payments-title">
            <div className="invoice-section-heading">
              <FileText size={20} aria-hidden="true" />
              <h2 id="invoice-payments-title">Payment requests</h2>
            </div>
            {requests.length ? (
              <ul>
                {requests.map((payment) => (
                  <li key={payment.id}>
                    <div>
                      <Link
                        className="text-link"
                        href={`/dashboard/payments/${payment.id}`}
                      >
                        {payment.paymentNumber}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                      <span>
                        {paymentLabels[payment.status] ?? "Check payment status"}
                      </span>
                    </div>
                    <strong>{formatKobo(payment.amountKobo)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No payment requests are recorded for this invoice.</p>
            )}
            <Link className="text-link" href="/dashboard/payments">
              View all payments
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            {(!documentReady || paper.receipts.length === 0) && (
              <p className="invoice-note">
                {documentReady
                  ? "A receipt becomes available after a payment is confirmed."
                  : "Refresh the document details to check available receipts."}
              </p>
            )}
          </section>
          {documentReady && paper.receipts.length > 0 && (
            <section
              className="invoice-receipts"
              aria-labelledby="invoice-receipts-title"
            >
              <div className="invoice-section-heading">
                <ReceiptText size={20} aria-hidden="true" />
                <h2 id="invoice-receipts-title">Payment receipts</h2>
              </div>
              {documentReady && paper.receipts.length ? (
                <ul>
                  {paper.receipts.map((receipt) => (
                    <li key={receipt.paymentId}>
                      <div className="invoice-receipt-info">
                        <Link
                          className="text-link"
                          href={`/dashboard/payments/${receipt.paymentId}`}
                        >
                          {receipt.paymentNumber}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <strong>{formatKobo(receipt.amountKobo)} received</strong>
                        <span>Confirmed {formatBusinessDate(receipt.confirmedAt)}</span>
                        {BigInt(receipt.refundedKobo) > BigInt(0) && (
                          <span>
                            Completed refunds: {formatKobo(receipt.refundedKobo)}
                          </span>
                        )}
                      </div>
                      <DocumentActions kind="receipt" id={receipt.paymentId} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {documentReady
                    ? "A receipt becomes available after a payment is confirmed."
                    : "Refresh the document details to check available receipts."}
                </p>
              )}
              <p className="invoice-note">
                A receipt records a confirmed payment. Check the related record for
                delivery or service progress.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function InvoiceSheet({ document }: { document: InvoiceDocument }) {
  return (
    <section className="invoice-sheet" aria-labelledby="invoice-number">
      <header className="invoice-paper-header">
        <div>
          <p className="invoice-issuer">{document.issuer.name}</p>
          <p className="invoice-tagline">Built on trust driven by quality</p>
        </div>
        <div>
          <span>Invoice</span>
          <h2 id="invoice-number">{document.invoiceNumber}</h2>
          <span className="invoice-status" data-status={document.status}>
            {labels[document.status]}
          </span>
        </div>
      </header>
      <address>
        {document.issuer.address}
        <br />
        <a href="https://wa.me/2348136075567" target="_blank" rel="noopener noreferrer">
          Whatsapp
        </a>
      </address>
      <dl className="invoice-meta">
        <div>
          <dt>Issued</dt>
          <dd>
            {document.issuedAt ? formatBusinessDate(document.issuedAt) : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{document.dueAt ? formatBusinessDate(document.dueAt) : "Not specified"}</dd>
        </div>
        <div>
          <dt>Bill to</dt>
          <dd>
            {document.billTo.name}
            {document.billTo.address && <span>{document.billTo.address}</span>}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {document.source.description}
            <span>{document.source.reference}</span>
          </dd>
        </div>
      </dl>
      {document.status === "VOID" && (
        <Feedback
          message="This invoice is void. Do not use it to make a payment."
          tone="info"
        />
      )}
      <table className="invoice-lines">
        <caption className="sr-only">Invoice items and amounts</caption>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {document.lines.map((item, index) => (
            <tr key={`${index}-${item.description}`}>
              <td>
                {item.description}
                <span>
                  {item.quantity} × {formatKobo(item.unitPriceKobo)}
                </span>
              </td>
              <td>{formatKobo(item.subtotalKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <InvoiceTotals document={document} />
      {document.detailBasis === "LEGACY_SUMMARY" && (
        <p className="invoice-note">
          A historical itemized breakdown is unavailable. The recorded invoice subtotal
          and adjustments are shown.
        </p>
      )}
      {document.detailBasis === "SOURCE_RECORDS" && (
        <p className="invoice-note">
          Historical invoice: details come from its recorded source. Unrecorded billing
          details are omitted.
        </p>
      )}
      {document.issuer.paymentTerms && (
        <p className="invoice-terms">{document.issuer.paymentTerms}</p>
      )}
      <p className="invoice-note">Keep this invoice for your records.</p>
    </section>
  );
}
function InvoiceTotals({
  document,
}: {
  document: Pick<
    InvoiceDocument,
    "subtotalKobo" | "taxKobo" | "depositCreditKobo" | "totalKobo"
  > &
    Partial<Pick<InvoiceDocument, "discountKobo" | "deliveryKobo">>;
}) {
  return (
    <dl className="invoice-totals">
      {document.discountKobo && BigInt(document.discountKobo) > BigInt(0) && (
        <div>
          <dt>Discount</dt>
          <dd>−{formatKobo(document.discountKobo)}</dd>
        </div>
      )}
      {document.deliveryKobo && BigInt(document.deliveryKobo) > BigInt(0) && (
        <div>
          <dt>Delivery</dt>
          <dd>{formatKobo(document.deliveryKobo)}</dd>
        </div>
      )}
      <div>
        <dt>Subtotal</dt>
        <dd>{formatKobo(document.subtotalKobo)}</dd>
      </div>
      <div>
        <dt>Tax</dt>
        <dd>{formatKobo(document.taxKobo)}</dd>
      </div>
      <div>
        <dt>Deposit credit applied</dt>
        <dd>{formatKobo(document.depositCreditKobo)}</dd>
      </div>
      <div className="invoice-total-row">
        <dt>Invoice total</dt>
        <dd>{formatKobo(document.totalKobo)}</dd>
      </div>
    </dl>
  );
}
