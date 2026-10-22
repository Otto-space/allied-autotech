"use client";

import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import {
  aftercareKinds,
  aftercareLabels,
  matchesAftercareOrder,
  parseAftercareList,
  parseAftercareOrder,
  type Aftercare,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { useResource } from "@/lib/api/use-resource";
import { useAftercareWrite } from "@/lib/orders/use-aftercare-write";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { AftercareRecovery } from "./aftercare-recovery";
import { AftercareIntake } from "./aftercare-intake";
import { Feedback } from "./feedback";

const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function RequestRecord({ item, order }: { item: Aftercare; order: AftercareOrder }) {
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

function CustomerAftercareScreen({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}) {
  const parseOrder = useCallback(
    (value: unknown) => {
      const record = parseAftercareOrder(value);
      if (record.id !== orderId) throw new Error("Unexpected order");
      return record;
    },
    [orderId],
  );
  const parseHistory = useCallback(
    (value: unknown) => {
      const rows = parseAftercareList(value);
      if (
        rows.some((row) => row.orderId !== orderId) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw new Error("Unexpected order history");
      return rows;
    },
    [orderId],
  );
  const order = useResource(`/customers/orders/${orderId}`, parseOrder);
  const history = useResource(`/customers/orders/${orderId}/aftercare`, parseHistory);
  const current = order.error ? undefined : order.data;
  const validHistory =
    !!current &&
    !history.error &&
    !!history.data &&
    history.data.every((row) => matchesAftercareOrder(row, current));
  const [recovered, setRecovered] = useState<Aftercare>();
  const [formRevision, setFormRevision] = useState(0);
  const guard = useAftercareWrite(userId, orderId, order, history, validHistory);
  const reading =
    order.loading || history.loading || order.refreshing || history.refreshing;
  function refresh() {
    order.refresh();
    history.refresh();
  }
  return (
    <div className="customer-aftercare">
      <nav className="ca-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li className="ca-middle">
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <Link href="/dashboard/orders">Orders</Link>
          </li>
          <li className="ca-middle">
            <ChevronRight aria-hidden="true" />
            <Link href={`/dashboard/orders/${orderId}`} title={current?.orderNumber}>
              {current?.orderNumber ?? "Order"}
            </Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <span aria-current="page">Aftercare</span>
          </li>
        </ol>
      </nav>
      <Link className="ca-back" href={`/dashboard/orders/${orderId}`}>
        <ArrowLeft aria-hidden="true" />
        Back to order
      </Link>
      <header className="ca-heading">
        <h1>Returns and cancellation requests</h1>
        <button
          className="button secondary"
          onClick={guard.refresh}
          disabled={reading || guard.busy}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh order requests
        </button>
      </header>
      <p className="ca-intro">
        Review requests and follow their progress. An approved request does not by itself
        change stock, cancel an order or confirm a refund payment.
      </p>
      <Feedback message={order.error ?? guard.storageError} />
      {(order.refreshError || history.refreshError) && (
        <p className="notice" role="status">
          Order details or request history may be out of date. Refresh order requests
          before sending another request.
        </p>
      )}
      {guard.remaining > 0 && (
        <p role="status" className="notice">
          Please wait {guard.remaining} seconds before sending another request.
        </p>
      )}
      {current && (
        <AftercareRecovery
          guard={guard}
          order={current}
          unavailable={
            reading ||
            !validHistory ||
            !!order.error ||
            !!order.refreshError ||
            !!history.error ||
            !!history.refreshError
          }
          frozen={guard.busy}
          onRecovered={(saved) => {
            setRecovered(saved);
            setFormRevision((v) => v + 1);
            refresh();
          }}
        />
      )}
      {recovered && current && (
        <section aria-label="Recovered order request">
          <p role="status" className="notice">
            Original order request confirmed. Current review status is shown below.
          </p>
          <RequestRecord item={recovered} order={current} />
        </section>
      )}
      {reading && (
        <div className="ca-loading" role="status">
          <span className="ca-skeleton" aria-hidden="true" />
          Loading order requests…
        </div>
      )}
      {current && (
        <>
          <section className="ca-order" aria-label="Order summary">
            <div>
              <span>Order number</span>
              <h2>{current.orderNumber}</h2>
            </div>
            <div>
              <span>Status</span>
              <strong>{label(current.status)}</strong>
            </div>
            <div>
              <span>Workshop</span>
              <strong>{current.branch?.name ?? "Branch not recorded."}</strong>
            </div>
            <div>
              <span>Fulfillment</span>
              <strong>{label(current.fulfillmentMethod)}</strong>
            </div>
            <div>
              <span>Order total</span>
              <strong>{formatKobo(current.totalKobo)}</strong>
            </div>
          </section>
          <div className="ca-grid">
            <AftercareIntake
              key={formRevision}
              order={current}
              disabled={guard.disabled}
              onSaved={refresh}
              onUncertain={() => {}}
              guard={guard}
            />
            <section className="ca-panel ca-history" aria-labelledby="ca-history-title">
              <h2 id="ca-history-title">Request history</h2>
              <p>Latest 100 requests for this order, newest first.</p>
              <p className="ca-footnote">
                A request of the same type that has not been rejected keeps its original
                products and explanation.
              </p>
              {history.data && !history.error && !validHistory && (
                <Feedback message="The request history did not match this order. Refresh before continuing." />
              )}
              {history.error && <Feedback message={history.error} />}
              {validHistory && history.data?.length === 0 && (
                <p className="ca-empty">
                  No return or cancellation requests are recorded for this order.
                </p>
              )}
              {validHistory &&
                history.data?.map((item) => (
                  <RequestRecord key={item.id} item={item} order={current} />
                ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export function CustomerOrderAftercare({ orderId }: { orderId: string }) {
  const session = useAccountSession();
  if (!session || session.user.role !== "CUSTOMER")
    return <p role="status">Verify your customer session to view this order.</p>;
  if (!z.uuid().safeParse(orderId).success)
    return (
      <Feedback message="This order reference is invalid. Open a valid order from your order list." />
    );
  return (
    <CustomerAftercareScreen
      key={`${session.user.id}:${orderId}`}
      orderId={orderId}
      userId={session.user.id}
    />
  );
}
