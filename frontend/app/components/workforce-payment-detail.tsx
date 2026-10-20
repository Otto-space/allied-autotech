"use client";
import { useEffect, useRef } from "react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  parseWorkforcePayment,
  paymentStatusLabels,
  paymentPurposeLabels,
  paymentSourceLabels,
  workforcePaymentAmount,
} from "@/lib/admin/workforce-finance";
import { formatBusinessDate } from "@/lib/format/date";

export function WorkforcePaymentDetail({
  id,
  access,
  close,
  refresh,
  refreshKey,
  enabled,
  denied,
}: {
  id: string;
  access: WorkforceAccess;
  close: () => void;
  refresh: () => void;
  refreshKey: number;
  enabled: boolean;
  denied: boolean;
}) {
  const record = useResource(
    denied ? null : `/staff/workforce/finance/${id}`,
    parseWorkforcePayment,
    undefined,
    { refreshKey },
  );
  const busy = record.loading || record.refreshing,
    failure = record.error || record.refreshError;
  const mismatch =
    !!record.data &&
    (record.data.id !== id || !sameWorkforceScope(access, record.data.access));
  const row =
    enabled && !denied && !busy && !failure && !mismatch ? record.data : undefined;
  const title = useRef<HTMLHeadingElement>(null),
    focused = useRef(false);
  useEffect(() => {
    if (row && !focused.current) {
      focused.current = true;
      title.current?.focus();
    }
  }, [row]);
  return (
    <section className="wfc-detail" aria-label="Selected payment">
      {(failure || mismatch || denied) && (
        <div className="wfc-feedback" role="alert">
          <h2>
            {record.denied || denied
              ? "Payment access unavailable"
              : "Payment could not be verified"}
          </h2>
          <p>Refresh payments to check the current record and your access.</p>
          <button className="button secondary" onClick={refresh}>
            Check payment again
          </button>
          <button className="button secondary" onClick={close}>
            Close selection
          </button>
        </div>
      )}
      {(busy || !enabled) && !denied && !failure && (
        <p className="wfc-state" role="status">
          Checking the selected payment…
        </p>
      )}
      {row && (
        <>
          <header className="wfc-detail-heading">
            <div>
              <h2 ref={title} tabIndex={-1}>
                {row.paymentNumber}
              </h2>
              <p>
                <span className={`wfc-status is-${row.status.toLowerCase()}`}>
                  {paymentStatusLabels[row.status]}
                </span>
              </p>
            </div>
            <button className="button secondary" onClick={close}>
              Close selection
            </button>
          </header>
          <dl className="wfc-facts">
            <div>
              <dt>Amount</dt>
              <dd className="wff-amount">
                {workforcePaymentAmount(row.amountKobo, row.currency)}
              </dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>{paymentPurposeLabels[row.purpose]}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{row.currency}</dd>
            </div>
          </dl>
          <div className="wfc-columns">
            <section className="wfc-panel">
              <h3>Related records</h3>
              <dl className="wfc-tracking">
                {row.sources.map((source, i) => (
                  <div key={i}>
                    <dt>{paymentSourceLabels[source.kind]}</dt>
                    <dd>
                      {source.reference}
                      <small className="wff-source-branch">{source.branch.name}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="wfc-panel">
              <h3>Recorded dates</h3>
              <dl className="wfc-tracking">
                {(
                  [
                    ["Created", row.createdAt],
                    ["Updated", row.updatedAt],
                    ["Succeeded", row.succeededAt],
                    ["Payment window ends", row.expiresAt],
                    ["Cancelled", row.cancelledAt],
                    ["Expired", row.expiredAt],
                  ] as const
                ).map(([label, date]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {date ? (
                        <time dateTime={date}>{formatBusinessDate(date)}</time>
                      ) : (
                        "Not recorded"
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <p className="wff-note">
            Recorded payment state. Bank settlement and refunds are handled separately.
          </p>
        </>
      )}
    </section>
  );
}
