import type { InvoiceDocument } from "@/lib/api/document-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import "./invoice-detail.css";
const labels = { ISSUED: "Issued", PAID: "Paid", VOID: "Void" };
export function InvoiceSheet({ document }: { document: InvoiceDocument }) {
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
      {document.issuer.taxId && <p>Tax ID: {document.issuer.taxId}</p>}
      {document.issuer.cacNumber && <p>CAC registration: {document.issuer.cacNumber}</p>}
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
      {document.source.originalInvoiceNumber && (
        <p className="invoice-note">
          Original invoice: {document.source.originalInvoiceNumber}
        </p>
      )}
      {document.source.amendmentReason && (
        <p className="invoice-note">
          Additional work reason: {document.source.amendmentReason}
        </p>
      )}
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
      {document.servicePaymentPlan && (
        <dl className="invoice-meta" aria-label="Agreed payment stages">
          <div>
            <dt>Materials stage, including allocated VAT and credits</dt>
            <dd>{formatKobo(document.servicePaymentPlan.materials.totalKobo)}</dd>
          </div>
          <div>
            <dt>Workmanship and fees stage, including allocated VAT and credits</dt>
            <dd>{formatKobo(document.servicePaymentPlan.workmanship.totalKobo)}</dd>
          </div>
        </dl>
      )}
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
export function InvoiceTotals({
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
