"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  aftercareKinds,
  aftercareLabels,
  matchesAftercareOrder,
  parseAftercareOrder,
  parseAftercareList,
  parseStaffAftercareList,
  type Aftercare,
} from "@/lib/api/aftercare-schemas";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { AftercareIntake } from "./aftercare-intake";
import { AftercareReview } from "./aftercare-review";
import { FulfillmentEvidence } from "./fulfillment-evidence";
function AftercareScreen({ orderId, staff }: { orderId: string; staff: boolean }) {
  const session = useAccountSession();
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const parseOrder = useCallback(
    (value: unknown) => {
      const record = parseAftercareOrder(value);
      if (record.id !== orderId) throw new Error("Unexpected order");
      return record;
    },
    [orderId],
  );
  const parseList = useCallback(
    (value: unknown) => {
      const rows = staff ? parseStaffAftercareList(value) : parseAftercareList(value);
      if (rows.some((row) => row.orderId !== orderId))
        throw new Error("Unexpected order history");
      return rows;
    },
    [orderId, staff],
  );
  const order = useResource(
    `/${staff ? "staff" : "customers"}/orders/${orderId}`,
    parseOrder,
  );
  const history = useResource(
    `/${staff ? "staff" : "customers"}/orders/${orderId}/aftercare`,
    parseList,
  );
  const permission = useResource(staff ? "/staff/profile" : null, parseOwnStaffProfile);
  const permitted =
    !staff ||
    (!permission.loading &&
      !permission.error &&
      permission.data?.id === session?.user.id &&
      permission.data?.role === session?.user.role &&
      permission.data?.status === "ACTIVE" &&
      (session?.user.role !== "STAFF" ||
        (!!permission.data.staffProfile?.branchId &&
          permission.data.staffProfile.branchId === order.data?.branch.id)));
  const canDecide =
    permitted && !!permission.data?.capabilities.includes("FINANCE_POLICY_APPROVE");
  const current = !order.error ? order.data : undefined;
  const validHistory =
    !!current &&
    !history.error &&
    history.data?.every((row) => matchesAftercareOrder(row, current));
  const disabled =
    uncertain || order.loading || history.loading || !validHistory || !permitted;
  function refresh() {
    order.refresh();
    history.refresh();
  }
  function changed() {
    setMessage(
      "Order review action recorded. Check the refreshed record before the next step.",
    );
  }
  function selectedKey(record: Aftercare) {
    return `${record.id}:${record.status}:${record.reviewedAt ?? ""}`;
  }
  return (
    <>
      <Link
        className="text-link"
        href={`/${staff ? "admin" : "dashboard"}/orders/${orderId}`}
      >
        Back to order
      </Link>
      <h1>
        {staff
          ? "Order returns and cancellation review"
          : "Returns and cancellation requests"}
      </h1>
      <p>
        Review requests and follow their progress. An approved request does not by itself
        change stock, cancel an order or confirm a refund payment.
      </p>
      <Feedback message={order.error ?? history.error} />
      <Feedback message={message} tone="success" toast="Order review action recorded." />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The outcome of a change is uncertain. Refresh the order and request history before reloading to make another change."
        />
      )}
      <div className="actions">
        <button
          className="button secondary"
          onClick={refresh}
          disabled={order.loading || history.loading}
        >
          Refresh order requests
        </button>
        {staff && (
          <button
            className="button secondary"
            onClick={permission.refresh}
            disabled={permission.loading}
          >
            Refresh review permission
          </button>
        )}
      </div>
      {(order.loading || history.loading) && <p role="status">Loading order requests…</p>}
      {staff && (
        <>
          <Feedback message={permission.error} />
          {!permitted && !permission.loading && (
            <Feedback message="Your current staff access and branch assignment must be confirmed before recording an order review." />
          )}
        </>
      )}
      {current && (
        <>
          <section className="detail-section aftercare-record">
            <h2>{current.orderNumber}</h2>
            <p>
              {current.branch.name} · {current.status.toLowerCase()} ·{" "}
              {current.fulfillmentMethod.toLowerCase()}
            </p>
            <p>Order total: {formatKobo(current.totalKobo)}</p>
          </section>
          {!staff && (
            <AftercareIntake
              order={current}
              disabled={disabled}
              onSaved={refresh}
              onUncertain={() => setUncertain(true)}
            />
          )}
          {staff && (
            <FulfillmentEvidence
              order={current}
              disabled={disabled}
              onSaved={changed}
              onRefresh={refresh}
              onUncertain={() => setUncertain(true)}
            />
          )}
          {history.data && !history.error && !validHistory && (
            <Feedback message="The request history did not match this order. Refresh before continuing." />
          )}
          {validHistory && (
            <section className="detail-section">
              <h2>Request history</h2>
              <p>
                Latest 100 requests for this order, newest first. Active requests of the
                same type keep their original products and explanation.
              </p>
              {history.data?.length === 0 && (
                <p>No return or cancellation requests are recorded for this order.</p>
              )}
              {history.data?.map((item) => (
                <article className="detail-section aftercare-record" key={item.id}>
                  <h3>{aftercareKinds[item.kind]}</h3>
                  <p>
                    <strong>{aftercareLabels[item.status]}</strong> · Requested{" "}
                    {formatBusinessDate(item.requestedAt)}
                  </p>
                  <p className="preserve-lines">{item.reason}</p>
                  <ul>
                    {item.items.map((line) => (
                      <li key={line.orderItemId}>
                        {
                          current.items.find((i) => i.id === line.orderItemId)!
                            .productName
                        }{" "}
                        — quantity {line.quantity}
                      </li>
                    ))}
                  </ul>
                  {item.receivedAt && (
                    <p>Goods received {formatBusinessDate(item.receivedAt)}</p>
                  )}
                  {item.inspectedAt && (
                    <p>
                      Inspected {formatBusinessDate(item.inspectedAt)}. Good condition:{" "}
                      {item.goodCondition === null
                        ? "Not recorded"
                        : item.goodCondition
                          ? "Yes"
                          : "No"}
                      .
                    </p>
                  )}
                  {staff &&
                    "inspectionNote" in item &&
                    typeof item.inspectionNote === "string" && (
                      <p className="preserve-lines">
                        Internal inspection note: {item.inspectionNote}
                      </p>
                    )}
                  {item.reviewedAt && (
                    <p>Reviewed {formatBusinessDate(item.reviewedAt)}</p>
                  )}
                  {item.reviewNote && (
                    <p className="preserve-lines">Decision note: {item.reviewNote}</p>
                  )}
                  {item.approvedFeeKobo !== null && (
                    <p>
                      Reviewed fee: {formatKobo(item.approvedFeeKobo)}. This is not a
                      refund amount.
                    </p>
                  )}
                  <p>
                    {item.refundDueAt
                      ? `Recorded refund deadline: ${formatBusinessDate(item.refundDueAt)}. Check payment records for the actual refund status.`
                      : "No refund deadline is recorded on this request."}
                  </p>
                  {staff && !["APPROVED", "REJECTED"].includes(item.status) && (
                    <>
                      <button
                        className="button secondary"
                        aria-expanded={selected === item.id}
                        onClick={() =>
                          setSelected(selected === item.id ? undefined : item.id)
                        }
                        disabled={order.loading || history.loading}
                      >
                        Review {aftercareKinds[item.kind].toLowerCase()}
                      </button>
                      {selected === item.id && (
                        <AftercareReview
                          key={selectedKey(item)}
                          record={item}
                          order={current}
                          disabled={disabled}
                          canDecide={canDecide}
                          onSaved={changed}
                          onRefresh={refresh}
                          onUncertain={() => setUncertain(true)}
                        />
                      )}
                    </>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
export function OrderAftercare({
  orderId,
  staff = false,
}: {
  orderId: string;
  staff?: boolean;
}) {
  return z.uuid().safeParse(orderId).success ? (
    <AftercareScreen key={orderId} orderId={orderId} staff={staff} />
  ) : (
    <Feedback message="This order reference is invalid. Open a valid order from your order list." />
  );
}
