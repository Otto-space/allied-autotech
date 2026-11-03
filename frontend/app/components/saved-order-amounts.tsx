import type { WorkforceMonetaryBreakdown } from "@/lib/admin/workforce-aftercare";
import { formatKobo } from "@/lib/format/money";

export function SavedOrderAmounts({
  breakdown,
}: {
  breakdown?: WorkforceMonetaryBreakdown;
}) {
  return (
    <section className="card" aria-labelledby="saved-order-amounts-heading">
      <h2 id="saved-order-amounts-heading">Saved order amounts</h2>
      {breakdown?.status === "SAVED" ? (
        <>
          <p>
            These are saved order amounts. Check the requested quantity and earlier
            refunds before deciding the next step.
          </p>
          <div className="wfa-money-lines">
            {breakdown.lines.map((line) => (
              <article className="wfa-money-line" key={line.orderItemId}>
                <h3>{line.productName}</h3>
                <p>Saved amounts for all {line.quantity} ordered units.</p>
                <dl className="wfa-facts">
                  <dt>Subtotal</dt>
                  <dd>{formatKobo(line.subtotalKobo)}</dd>
                  <dt>Discount</dt>
                  <dd>{formatKobo(line.discountKobo)}</dd>
                  <dt>VAT</dt>
                  <dd>{formatKobo(line.taxKobo)}</dd>
                  <dt>Saved line total</dt>
                  <dd>{formatKobo(line.totalKobo)}</dd>
                </dl>
              </article>
            ))}
          </div>
          <p>Payment and any refund still need their own verification.</p>
        </>
      ) : breakdown?.status === "INVALID" ? (
        <p role="alert">
          The saved monetary breakdown could not be verified. Refresh and ask the
          authorised finance reviewer to resolve it before a decision.
        </p>
      ) : (
        <p>
          No saved line breakdown is available. Use the issued invoice and earlier refund
          records for financial review.
        </p>
      )}
    </section>
  );
}
