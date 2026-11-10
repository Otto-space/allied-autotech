import type { ServicePaymentSummary as Summary } from "@/lib/api/service-payment-schemas";
import { formatKobo } from "@/lib/format/money";
import styles from "./service-payment-summary.module.css";

export function ServicePaymentSummary({ summary }: { summary?: Summary }) {
  if (!summary) return null;
  return (
    <section className={styles.card} aria-label="Workshop payment stages">
      <h2>Workshop payment stages</h2>
      <p>
        Materials are paid separately first. Workmanship and fees are payable after the
        work is completed, before vehicle collection.
      </p>
      <dl>
        <div>
          <dt>Materials, including allocated VAT and credits</dt>
          <dd>{formatKobo(summary.materials.totalKobo)}</dd>
        </div>
        <div>
          <dt>Materials payments recorded</dt>
          <dd>{formatKobo(summary.materials.recordedKobo)}</dd>
        </div>
        <div>
          <dt>Workmanship and fees, including allocated VAT and credits</dt>
          <dd>{formatKobo(summary.workmanship.totalKobo)}</dd>
        </div>
        <div>
          <dt>Workmanship payments recorded</dt>
          <dd>{formatKobo(summary.workmanship.recordedKobo)}</dd>
        </div>
      </dl>
      {summary.financialReviewRequired ? (
        <p role="status">
          A payment adjustment needs staff review. Check the recorded payments and contact
          the workshop before paying again.
        </p>
      ) : summary.paymentPending ? (
        <p>
          A payment request is already in progress. Open the payment request below to
          check its status.
        </p>
      ) : !summary.workCompleted ? (
        <p>The workshop has not recorded completion. Workmanship is not yet payable.</p>
      ) : (
        <p>
          Work completion is recorded. Vehicle release still requires the workshop’s
          checks and settlement of any outstanding balance.
        </p>
      )}
    </section>
  );
}
