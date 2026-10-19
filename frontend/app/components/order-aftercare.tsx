"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { ApiError, apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  aftercareKinds,
  aftercareLabels,
  staffAftercareSchema,
  matchesAftercareOrder,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import {
  aftercareHistoryMatches,
  aftercarePendingKey,
  aftercarePermission,
  aftercareSnapshot,
  aftercareStages,
  clearWorkAftercarePending,
  parseWorkAftercareHistory,
  parseWorkAftercareOrder,
  readWorkAftercarePending,
  saveWorkAftercarePending,
  type AftercarePending,
  type WorkAftercareRequest,
} from "@/lib/admin/work-aftercare";
import { orderStatusLabels } from "@/lib/admin/work-orders";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { CustomerOrderAftercare } from "./customer-order-aftercare";
import { AftercareReview } from "./aftercare-review";
import { FulfillmentEvidence } from "./fulfillment-evidence";
import { Feedback } from "./feedback";

export function OrderAftercare({
  orderId,
  staff = false,
}: {
  orderId: string;
  staff?: boolean;
}) {
  const session = useAccountSession();
  if (!staff) return <CustomerOrderAftercare orderId={orderId} />;
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Order aftercare</h1>
        <Feedback message="Staff access is required to review order requests." />
      </>
    );
  if (!z.uuid().safeParse(orderId).success)
    return (
      <Feedback message="This order reference is invalid. Open a valid order from your order list." />
    );
  return (
    <AftercareScreen
      key={`${session.user.id}:${session.user.role}:${orderId}`}
      orderId={orderId}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function AftercareScreen({
  orderId,
  owner,
  role,
}: {
  orderId: string;
  owner: string;
  role: string;
}) {
  const parseOrder = useCallback(
    (value: unknown) => {
      const row = parseWorkAftercareOrder(value);
      if (row.id !== orderId) throw new Error("Unexpected order");
      return row;
    },
    [orderId],
  );
  const parseHistory = useCallback(
    (value: unknown) => {
      const rows = parseWorkAftercareHistory(value);
      if (rows.some((row) => row.orderId !== orderId))
        throw new Error("Unexpected request history");
      return rows;
    },
    [orderId],
  );
  const order = useResource(`/staff/orders/${orderId}`, parseOrder);
  const history = useResource(`/staff/orders/${orderId}/aftercare`, parseHistory);
  const access = useResource("/staff/profile", parseOwnStaffProfile);
  const permission = aftercarePermission(access.data, owner, role, order.data);
  const current = permission ? order.data : undefined;
  const validHistory = aftercareHistoryMatches(history.data, current);
  const error =
    order.error ||
    order.refreshError ||
    history.error ||
    history.refreshError ||
    access.error ||
    access.refreshError ||
    (history.data && current && !validHistory
      ? "The request history did not match this order. Refresh before continuing."
      : undefined);
  const canDecide =
    permission && !!access.data?.capabilities.includes("FINANCE_POLICY_APPROVE");
  const reading = [order, history, access].some(
    (resource) => resource.loading || resource.refreshing,
  );
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState<string>();
  const key = aftercarePendingKey(owner, orderId);
  const [pending, setPending] = useState<AftercarePending | "unknown" | undefined>(() =>
    readWorkAftercarePending(key),
  );
  const [writing, setWriting] = useState(false);
  const active = useRef(true),
    request = useRef<AbortController | null>(null);
  const unavailable = reading || !!error || !current || !validHistory || !permission;
  const latestUnavailable = useRef(unavailable);
  useEffect(() => {
    latestUnavailable.current = unavailable;
  }, [unavailable]);
  useEffect(() => {
    active.current = true;
    const discard = () => {
      active.current = false;
      request.current?.abort();
      setSelected(undefined);
      setMessage(undefined);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      request.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  function refresh() {
    order.refresh();
    history.refresh();
    access.refresh();
  }
  function lock(intent: AftercarePending) {
    try {
      saveWorkAftercarePending(key, intent);
    } catch {
      /* Keep the in-memory lock. */
    }
    setPending(intent);
  }
  async function fresh(signal: AbortSignal) {
    const [record, rows, profile] = await Promise.all([
      apiRequest(`/staff/orders/${orderId}`, { signal }),
      apiRequest(`/staff/orders/${orderId}/aftercare`, { signal }),
      apiRequest("/staff/profile", { signal }),
    ]);
    const latest = parseOrder(record.data),
      requests = parseHistory(rows.data),
      permission = parseOwnStaffProfile(profile.data);
    if (
      !active.current ||
      signal.aborted ||
      !aftercarePermission(permission, owner, role, latest) ||
      !aftercareHistoryMatches(requests, latest)
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    return { order: latest, history: requests, access: permission };
  }
  async function runWrite(
    intent: AftercarePending,
    operation: (signal: AbortSignal) => Promise<void>,
  ) {
    if (
      request.current ||
      latestUnavailable.current ||
      pending ||
      !current ||
      !history.data ||
      !access.data
    )
      throw new ApiError(409, { error: { code: "CONFLICT" } });
    const controller = new AbortController();
    request.current = controller;
    setWriting(true);
    let sent = false;
    try {
      const latest = await fresh(controller.signal);
      if (
        aftercareSnapshot(latest.order, latest.history, latest.access) !==
        aftercareSnapshot(current, history.data, access.data)
      ) {
        setMessage(
          "Order details, request history or review permission changed. Review the refreshed information before saving.",
        );
        refresh();
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      }
      try {
        saveWorkAftercarePending(key, intent);
      } catch {
        setMessage(
          "Your browser could not save a recovery marker. Allow session storage before recording a change.",
        );
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      }
      sent = true;
      setPending(intent);
      await operation(controller.signal);
      if (!active.current || controller.signal.aborted)
        throw new Error("Session changed");
      clearWorkAftercarePending(key);
      setPending(undefined);
    } catch (value) {
      if (active.current && !controller.signal.aborted) {
        const rejected =
          value instanceof ApiError && value.status >= 400 && value.status < 500;
        if (rejected) refresh();
        if (sent && rejected) {
          try {
            clearWorkAftercarePending(key);
            setPending(undefined);
          } catch {
            lock(intent);
          }
        } else if (sent) lock(intent);
      }
      throw value;
    } finally {
      if (active.current) {
        request.current = null;
        setWriting(false);
      }
    }
  }
  async function reconcile() {
    if (!pending || writing || unavailable || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWriting(true);
    try {
      const latest = await fresh(controller.signal);
      let result = "Saved evidence and request history loaded.";
      if (pending !== "unknown" && pending.operation === "review") {
        const record = staffAftercareSchema.parse(
          (
            await apiRequest(`/staff/order-requests/${pending.id}`, {
              signal: controller.signal,
            })
          ).data,
        );
        if (record.id !== pending.id || !matchesAftercareOrder(record, latest.order))
          throw new Error("Unconfirmed request");
        result = `Saved request status: ${aftercareLabels[record.status]}.`;
      } else if (pending !== "unknown")
        result = latest.order.fulfillmentEvidenceAt
          ? "Saved delivery or collection evidence is recorded."
          : "No delivery or collection evidence is recorded.";
      if (!active.current || controller.signal.aborted) return;
      clearWorkAftercarePending(key);
      setPending(undefined);
      setSelected(undefined);
      refresh();
      setMessage(`${result} The pending change is cleared. Nothing was resent.`);
    } catch (value) {
      if (active.current)
        setMessage(
          value instanceof ApiError
            ? value.message
            : "The saved records could not be checked. The pending change remains locked.",
        );
    } finally {
      if (active.current) {
        request.current = null;
        setWriting(false);
      }
    }
  }
  const selectedRecord = validHistory
    ? history.data?.find((row) => row.id === selected)
    : undefined;
  const reviewable =
    selectedRecord && aftercareStages(selectedRecord, canDecide).length > 0;
  const selectedIndex = history.data?.findIndex((row) => row.id === selected) ?? -1;
  const blocked = unavailable || !!pending || writing;
  return (
    <div className="work-services work-aftercare">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/orders">Order fulfilment</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href={`/admin/orders/${orderId}`}>
              {current?.orderNumber ?? "Order"}
            </Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Aftercare</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-aftercare-title" tabIndex={-1}>
            Order aftercare
          </h1>
          <p>Review requests and record collection or delivery evidence.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href={`/admin/orders/${orderId}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to order
          </Link>
          <button
            className="button secondary"
            disabled={reading || writing}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh order requests
          </button>
        </div>
      </header>
      <p className="wa-guidance">
        An approved request does not cancel an order, restock goods or confirm a refund.
      </p>
      <Feedback message={message} tone="info" toast={message} />
      {reading && (
        <div className="work-service-state" role="status">
          {current ? "Refreshing order requests…" : "Loading order requests…"}
          {!current && <div className="wa-skeleton" aria-hidden="true" />}
        </div>
      )}
      {error && (
        <section className="wa-error">
          <h2>Order review unavailable</h2>
          <Feedback message={error} />
          {current && (
            <p>
              Previously loaded information may be out of date. Refresh before recording
              another action.
            </p>
          )}
          <button
            className="button secondary"
            disabled={reading || writing}
            onClick={refresh}
          >
            Retry order review
          </button>
        </section>
      )}
      {!reading && !permission && !error && (
        <section className="wa-error">
          <h2>Review access unavailable</h2>
          <p>
            Your current staff access and branch assignment must be confirmed before
            recording an order review.
          </p>
          <button className="button secondary" onClick={refresh}>
            Retry review access
          </button>
        </section>
      )}
      {current && (
        <>
          <dl className="wa-summary">
            <div>
              <dt>Order</dt>
              <dd>{current.orderNumber}</dd>
            </div>
            <div>
              <dt>Fulfilment</dt>
              <dd>{orderStatusLabels[current.status]}</dd>
            </div>
            <div>
              <dt>Order value</dt>
              <dd>{formatKobo(current.totalKobo)}</dd>
            </div>
          </dl>
          <p className="wa-branch">
            {current.branch?.name ?? "Branch not recorded."} ·{" "}
            {current.fulfillmentMethod === "COLLECTION" ? "Collection" : "Delivery"}
          </p>
          {pending && (
            <section className="wa-recovery">
              <h2 id="work-aftercare-recovery-title">Check the saved records</h2>
              <p>
                The outcome of a change is uncertain. Load the saved order and request
                before recording another action. Nothing is resent automatically.
              </p>
              <button
                className="button secondary"
                disabled={unavailable || writing}
                onClick={() => void reconcile()}
              >
                Load saved order and requests
              </button>
            </section>
          )}
          <div className="wa-layout">
            <section className="wa-history" aria-labelledby="wa-history-title">
              <header className="wa-history-heading">
                <div>
                  <h2 id="wa-history-title">Request history</h2>
                  <p>
                    Latest 100 requests for this order, newest first. Active requests of
                    the same type keep their original products and explanation.
                  </p>
                </div>
                {validHistory && (
                  <span>
                    {history.data!.length}{" "}
                    {history.data!.length === 1 ? "request" : "requests"} shown
                  </span>
                )}
              </header>
              <div className="wa-history-list">
                {validHistory && history.data?.length === 0 && (
                  <div className="wa-empty">
                    <h3>No requests recorded</h3>
                    <p>No return or cancellation requests are recorded for this order.</p>
                  </div>
                )}
                {validHistory &&
                  history.data?.map((row, index) => (
                    <RequestRecord
                      key={row.id}
                      item={row}
                      order={current}
                      index={index}
                      selected={selected === row.id}
                      canReview={aftercareStages(row, canDecide).length > 0}
                      blocked={blocked}
                      onSelect={() => {
                        setSelected(selected === row.id ? undefined : row.id);
                        requestAnimationFrame(() => {
                          document
                            .getElementById("aftercare-review-title")
                            ?.focus({ preventScroll: true });
                          document
                            .getElementById("wa-review-panel")
                            ?.scrollIntoView({ block: "nearest", behavior: "instant" });
                        });
                      }}
                    />
                  ))}
              </div>
            </section>
            <div
              className="wa-review-panel"
              id="wa-review-panel"
              style={
                {
                  "--wa-review-order": selectedIndex >= 0 ? selectedIndex * 2 + 2 : 201,
                } as CSSProperties
              }
            >
              {reviewable ? (
                <AftercareReview
                  key={`${selectedRecord.id}:${selectedRecord.status}:${selectedRecord.reviewedAt ?? ""}`}
                  record={selectedRecord}
                  order={current}
                  disabled={blocked}
                  canDecide={canDecide}
                  onSaved={() =>
                    setMessage(
                      "Order review action recorded. Check the refreshed record before the next step.",
                    )
                  }
                  onRefresh={refresh}
                  onUncertain={() => lock({ operation: "review", id: selectedRecord.id })}
                  runWrite={(operation) =>
                    runWrite({ operation: "review", id: selectedRecord.id }, operation)
                  }
                />
              ) : (
                <>
                  <h2>Review this request</h2>
                  <p>
                    {selectedRecord
                      ? "This request has no review actions available to your current access."
                      : "Select an available request from the history to record the next review action."}
                  </p>
                </>
              )}
            </div>
            <div className="wa-evidence">
              <FulfillmentEvidence
                key={`${current.fulfillmentEvidenceAt ?? "new"}`}
                order={current}
                disabled={blocked}
                onSaved={() =>
                  setMessage(
                    "Order review action recorded. Check the refreshed record before the next step.",
                  )
                }
                onRefresh={refresh}
                onUncertain={() => lock({ operation: "evidence" })}
                runWrite={(operation) => runWrite({ operation: "evidence" }, operation)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function RequestRecord({
  item,
  order,
  index,
  selected,
  canReview,
  blocked,
  onSelect,
}: {
  item: WorkAftercareRequest;
  order: AftercareOrder;
  index: number;
  selected: boolean;
  canReview: boolean;
  blocked: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`wa-record${selected ? " is-selected" : ""}`}
      style={{ "--wa-record-order": index * 2 + 1 } as CSSProperties}
    >
      <header>
        <h3>{aftercareKinds[item.kind]}</h3>
        <span className="wa-status">{aftercareLabels[item.status]}</span>
      </header>
      <p className="wa-date">
        Requested{" "}
        <time dateTime={item.requestedAt}>{formatBusinessDate(item.requestedAt)}</time>
      </p>
      <p className="preserve-lines">{item.reason}</p>
      <ul className="wa-products" aria-label="Requested products">
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
      <dl className="wa-facts">
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
        {item.inspectionNote && (
          <div>
            <dt>Internal inspection note</dt>
            <dd className="preserve-lines">{item.inspectionNote}</dd>
          </div>
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
              <small>This is not a refund amount.</small>
            </dd>
          </div>
        )}
      </dl>
      <p className="wa-footnote">
        {item.refundDueAt
          ? `Recorded refund deadline: ${formatBusinessDate(item.refundDueAt)}. Check payment records for the actual refund status.`
          : "No refund deadline is recorded on this request."}
      </p>
      {canReview && (
        <button
          className="button secondary"
          disabled={blocked}
          aria-expanded={selected}
          aria-controls="wa-review-panel"
          onClick={onSelect}
        >
          Review {aftercareKinds[item.kind].toLowerCase()}
        </button>
      )}
    </article>
  );
}
