"use client";
import Link from "next/link";
import { invoiceDocumentSchema } from "@/lib/api/document-schemas";
import { usePurchaseResource } from "@/lib/purchase/resource";
import { PurchaseAccess } from "./purchase-access";
import { DocumentActions } from "./document-actions";
import { InvoiceSheet } from "./invoice-sheet";
import { Feedback } from "./feedback";

const parse = (value: unknown) => invoiceDocumentSchema.parse(value);
export function PurchaseInvoicePage({ invoiceId }: { invoiceId: string }) {
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>Invoice details</h1>
      <PurchaseAccess>
        {(_, buyerReference) => (
          <Invoice invoiceId={invoiceId} buyerReference={buyerReference} />
        )}
      </PurchaseAccess>
    </>
  );
}
function Invoice({
  invoiceId,
  buyerReference,
}: {
  invoiceId: string;
  buyerReference: string;
}) {
  const resource = usePurchaseResource(`/purchase/invoices/${invoiceId}/document`, parse);
  const paper = resource.data;
  const valid =
    paper?.id === invoiceId &&
    paper.source.type === "ORDER" &&
    paper.billTo.reference === buyerReference;
  return (
    <>
      {resource.loading && <p role="status">Loading invoice details…</p>}
      {(resource.failed || (paper && !valid)) && (
        <section className="purchase-panel">
          <Feedback message="This invoice could not be opened with the current purchase access." />
          <button className="button secondary" onClick={resource.refresh}>
            Retry invoice
          </button>
        </section>
      )}
      {paper && valid && (
        <>
          <section className="purchase-panel">
            <DocumentActions
              purchase
              kind="invoice"
              id={invoiceId}
              disabled={resource.loading || resource.failed}
            />
            <Link className="purchase-link" href={`/purchase/orders/${paper.source.id}`}>
              View order details
            </Link>
          </section>
          <InvoiceSheet document={paper} />
        </>
      )}
      <Link className="purchase-link" href="/purchase">
        All purchases
      </Link>
    </>
  );
}
