"use client";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import type { StaffInvoiceDocument } from "@/lib/admin/work-invoice-detail";
import type { WorkInvoice } from "@/lib/admin/work-invoices";
export function StaffInvoicePaper({
  paper: p,
  branch,
}: {
  paper: StaffInvoiceDocument;
  branch: string;
}) {
  return (
    <section className="wid-paper" aria-label="Invoice document preview">
      <header>
        <div className="wid-issuer">
          <h2>{p.issuer.name}</h2>
          <p>{p.issuer.address}</p>
        </div>
        <div className="wid-paper-reference">
          <strong
            className={`wid-paper-status wid-paper-status-${p.status.toLowerCase()}`}
            data-status={p.status}
          >
            {p.status === "DRAFT"
              ? "DRAFT — NOT ISSUED"
              : p.status === "VOID"
                ? "VOID — DO NOT PAY"
                : p.status === "PAID"
                  ? "PAID"
                  : "ISSUED INVOICE"}
          </strong>
          <span>Invoice number</span>
          <strong>{p.invoiceNumber}</strong>
        </div>
      </header>
      <div className="wid-billing">
        <div>
          <span>Bill to</span>
          <strong>{p.billTo.name}</strong>
          {p.billTo.address && <p>{p.billTo.address}</p>}
        </div>
        <div>
          <span>{p.source.description}</span>
          <strong>{p.source.reference}</strong>
          <span>Workshop</span>
          <strong>{branch}</strong>
        </div>
      </div>
      {p.status === "DRAFT" && (
        <p className="wid-paper-note">
          Draft invoices are not visible to customers. This preview has not been issued
          and must not be used to request payment.
        </p>
      )}
      {p.status === "VOID" && (
        <p className="wid-paper-note">
          This invoice is void. Do not use it to make a payment.
        </p>
      )}
      <div className="wid-lines">
        <div className="wid-line-head" aria-hidden="true">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Amount</span>
        </div>
        {p.lines.map((line, index) => (
          <article className="wid-line" key={index}>
            <h3>{line.description}</h3>
            <div>
              <span>Quantity</span>
              <strong>{line.quantity}</strong>
            </div>
            <div>
              <span>Unit price</span>
              <strong>{formatKobo(line.unitPriceKobo)}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{formatKobo(line.subtotalKobo)}</strong>
            </div>
          </article>
        ))}
      </div>
      <dl className="wid-paper-totals">
        {(BigInt(p.discountKobo) > BigInt(0) || BigInt(p.deliveryKobo) > BigInt(0)) && (
          <div>
            <dt>Line subtotal</dt>
            <dd>
              {formatKobo(
                p.lines
                  .reduce((sum, line) => sum + BigInt(line.subtotalKobo), BigInt(0))
                  .toString(),
              )}
            </dd>
          </div>
        )}
        {BigInt(p.discountKobo) > BigInt(0) && (
          <div>
            <dt>Discount applied</dt>
            <dd>−{formatKobo(p.discountKobo)}</dd>
          </div>
        )}
        {BigInt(p.deliveryKobo) > BigInt(0) && (
          <div>
            <dt>Delivery applied</dt>
            <dd>{formatKobo(p.deliveryKobo)}</dd>
          </div>
        )}
        <div>
          <dt>Subtotal</dt>
          <dd>{formatKobo(p.subtotalKobo)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{formatKobo(p.taxKobo)}</dd>
        </div>
        <div>
          <dt>Deposit credit applied</dt>
          <dd>{formatKobo(p.depositCreditKobo)}</dd>
        </div>
        <div className="wid-total">
          <dt>Invoice total</dt>
          <dd>{formatKobo(p.totalKobo)}</dd>
        </div>
      </dl>
      <div className="wid-paper-dates">
        <p>
          <span>Due (Lagos)</span>
          <strong>{p.dueAt ? formatStockInstant(p.dueAt) : "Not set"}</strong>
        </p>
        <p>
          <span>Currency</span>
          <strong>NGN · Nigerian naira</strong>
        </p>
      </div>
      {p.issuer.paymentTerms && (
        <div className="wid-terms">
          <h3>Recorded terms</h3>
          <p>{p.issuer.paymentTerms}</p>
        </div>
      )}
      <footer>
        <strong>
          {p.detailBasis === "SNAPSHOT"
            ? "Recorded document snapshot"
            : p.detailBasis === "SOURCE_RECORDS"
              ? "Reconciled source records"
              : "Legacy summary"}
        </strong>
        <p>
          {p.detailBasis === "SOURCE_RECORDS"
            ? "A stored original document is unavailable. These details were reconciled from source records."
            : p.detailBasis === "LEGACY_SUMMARY"
              ? "Detailed original lines are unavailable. This document preserves the recorded invoice subtotal."
              : "These source details were recorded with the invoice. A separate receipt records a confirmed payment."}
        </p>
      </footer>
    </section>
  );
}
export function StaffInvoiceLifecycle({ invoice: v }: { invoice: WorkInvoice }) {
  return (
    <section className="wid-lifecycle">
      <details open>
        <summary>Invoice lifecycle</summary>
        <dl>
          {(
            [
              ["Created", v.createdAt],
              ["Updated", v.updatedAt],
              ["Due", v.dueAt],
              ["Issued", v.issuedAt],
              ["Paid", v.paidAt],
              ["Voided", v.voidedAt],
            ] as const
          ).map(([label, date]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {date
                  ? formatStockInstant(date)
                  : label === "Issued"
                    ? "Not issued"
                    : label === "Voided"
                      ? "Not voided"
                      : "Not recorded"}
              </dd>
            </div>
          ))}
          <div>
            <dt>Version</dt>
            <dd>{v.version}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
