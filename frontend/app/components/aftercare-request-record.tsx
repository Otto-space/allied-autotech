"use client";
import { WorkflowProgress } from "./status-progress";
import {
  aftercareKinds,
  aftercareLabels,
  type Aftercare,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
export function AftercareRequestRecord({
  item,
  order,
}: {
  item: Aftercare;
  order: Pick<AftercareOrder, "items">;
}) {
  return (
    <article className="ca-record">
      <header>
        <h3>{aftercareKinds[item.kind]}</h3>
        <span className="ca-status" data-status={item.status}>
          {aftercareLabels[item.status]}
        </span>
      </header>
      <WorkflowProgress workflow="aftercare" status={item.status} />
      <p className="ca-date">Requested {formatBusinessDate(item.requestedAt)}</p>
      <p className="preserve-lines">{item.reason}</p>
      <ul className="ca-products" aria-label="Requested products">
        {item.items.map((line) => (
          <li key={line.orderItemId}>
            <span>
              {
                order.items.find((original) => original.id === line.orderItemId)
                  ?.productName
              }
            </span>
            <span>Quantity {line.quantity}</span>
          </li>
        ))}
      </ul>
      <dl className="ca-decisions">
        {item.receivedAt && (
          <div>
            <dt>Goods received</dt>
            <dd>{formatBusinessDate(item.receivedAt)}</dd>
          </div>
        )}
        {item.inspectedAt && (
          <>
            <div>
              <dt>Inspected</dt>
              <dd>{formatBusinessDate(item.inspectedAt)}</dd>
            </div>
            <div>
              <dt>Good condition</dt>
              <dd>
                {item.goodCondition === null
                  ? "Not recorded"
                  : item.goodCondition
                    ? "Yes"
                    : "No"}
              </dd>
            </div>
          </>
        )}
        {item.reviewedAt && (
          <div>
            <dt>Reviewed</dt>
            <dd>{formatBusinessDate(item.reviewedAt)}</dd>
          </div>
        )}
        {item.reviewNote && (
          <div>
            <dt>Decision note</dt>
            <dd className="preserve-lines">{item.reviewNote}</dd>
          </div>
        )}
        {item.approvedFeeKobo !== null && (
          <div>
            <dt>Reviewed fee</dt>
            <dd>
              {formatKobo(item.approvedFeeKobo)}
              <span>This is not a refund amount.</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="ca-footnote">
        {item.refundDueAt
          ? `Recorded refund deadline: ${formatBusinessDate(item.refundDueAt)}. Check payment records for the actual refund status.`
          : "No refund deadline is recorded on this request."}
      </p>
    </article>
  );
}
