"use client";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CreditCard,
  Package,
  RefreshCw,
  Store,
  Truck,
} from "lucide-react";
import { ApiError, apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import type { RequestBody } from "@/lib/api/contracts";
import {
  clearOrderPending,
  fulfilmentReason,
  markOrderPending,
  nextOrderStatus,
  orderActivity,
  orderChangeSnapshot,
  parseStaffOrderDetail,
  pendingOrderChange,
  pendingOrderKey,
  type StaffOrderRecord,
} from "@/lib/admin/work-order-detail";
import { orderStatusLabels } from "@/lib/admin/work-orders";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { OrderDeliveryDetails } from "./order-delivery-details";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";

export function StaffOrderDetail({ orderId }: { orderId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Order details</h1>
        <Feedback message="Staff access is required to view this order." />
      </>
    );
  return (
    <OrderRecord
      key={`${session.user.id}:${session.user.role}:${orderId}`}
      orderId={orderId}
      owner={session.user.id}
      administrator={session.user.role !== "STAFF"}
    />
  );
}
function OrderRecord({
  orderId,
  owner,
  administrator,
}: {
  orderId: string;
  owner: string;
  administrator: boolean;
}) {
  const order = useResource(`/staff/orders/${orderId}`, parseStaffOrderDetail);
  const mismatch = !!order.data && order.data.id !== orderId;
  const current = mismatch ? undefined : order.data;
  const error = mismatch
    ? "The returned order does not match this page. Refresh to try again."
    : order.error || order.refreshError;
  const busy = order.loading || order.refreshing;
  const key = pendingOrderKey(owner, orderId);
  const [pending, setPending] = useState(() => pendingOrderChange(key));
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [validation, setValidation] = useState<{ field: string; message: string }>();
  const [epoch, setEpoch] = useState(0);
  const [reconciling, setReconciling] = useState(false);
  const active = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    function discard() {
      active.current = false;
      controller.current?.abort();
      setProposal(null);
      setMessage(undefined);
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      controller.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  const blocked = busy || !!error || pending || reconciling || !!proposal || !current;
  function invalidate(field: string, message: string) {
    setValidation({ field, message });
    document.getElementById(field)?.focus();
  }
  function review(form: FormData) {
    setValidation(undefined);
    setMessage(undefined);
    if (blocked || !current) return;
    const status = nextOrderStatus.safeParse(form.get("status"));
    if (!status.success || !current.allowedTransitions.includes(status.data)) {
      invalidate("fulfilment-status", "Choose an available next status.");
      return;
    }
    const reason = fulfilmentReason.safeParse(String(form.get("reason") ?? ""));
    if (!reason.success || (status.data === "CANCELLED" && !reason.data)) {
      invalidate(
        "fulfilment-reason",
        "Enter a reason of up to 500 characters, in one paragraph. A reason is required for cancellation.",
      );
      return;
    }
    const observed = current;
    const body: RequestBody<"/staff/orders/{orderId}/status", "post"> = {
      status: status.data,
      expectedVersion: observed.version,
      ...(reason.data ? { reason: reason.data } : {}),
    };
    setProposal({
      title: "Update order fulfilment?",
      description:
        status.data === "CANCELLED"
          ? "Cancellation affects stock reservations. It does not by itself confirm a refund."
          : "Confirm that the required workshop or collection step has actually occurred. This action does not record a payment.",
      facts: [
        { label: "Order", value: observed.orderNumber },
        { label: "From", value: orderStatusLabels[observed.status] },
        { label: "To", value: orderStatusLabels[status.data] },
        { label: "Payment", value: observed.paidAt ? "Recorded" : "Not recorded" },
        ...(reason.data ? [{ label: "Reason", value: reason.data }] : []),
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        markOrderPending(key);
        setPending(true);
      },
      submit: async () => {
        const request = new AbortController();
        controller.current = request;
        const latest = parseStaffOrderDetail(
          (await apiRequest(`/staff/orders/${orderId}`, { signal: request.signal })).data,
        );
        if (!active.current || request.signal.aborted) throw new Error("Session changed");
        if (
          latest.id !== orderId ||
          orderChangeSnapshot(latest) !== orderChangeSnapshot(observed) ||
          !latest.allowedTransitions.includes(status.data)
        ) {
          setMessage(
            "This order has changed. Review the refreshed details before making another change.",
          );
          order.refresh();
          throw new ApiError(409, { error: { code: "CONFLICT" } });
        }
        markOrderPending(key);
        setPending(true);
        try {
          const saved = parseStaffOrderDetail(
            (
              await apiRequest(`/staff/orders/${orderId}/status`, {
                method: "POST",
                csrf: true,
                body,
                signal: request.signal,
              })
            ).data,
          );
          if (!active.current || request.signal.aborted)
            throw new Error("Session changed");
          if (
            saved.id !== orderId ||
            saved.status !== status.data ||
            saved.version !== observed.version + 1
          )
            throw new Error("Unconfirmed order response");
          clearOrderPending(key);
          setPending(false);
        } catch (value) {
          if (value instanceof ApiError && value.status >= 400 && value.status < 500) {
            clearOrderPending(key);
            if (active.current) {
              setPending(false);
              order.refresh();
            }
          }
          throw value;
        }
      },
    });
  }
  async function reconcile() {
    if (busy || reconciling || !current || error) return;
    setReconciling(true);
    setValidation(undefined);
    const request = new AbortController();
    controller.current = request;
    try {
      const saved = parseStaffOrderDetail(
        (await apiRequest(`/staff/orders/${orderId}`, { signal: request.signal })).data,
      );
      if (!active.current || request.signal.aborted) return;
      if (saved.id !== orderId) throw new Error("Unexpected order");
      clearOrderPending(key);
      setPending(false);
      setEpoch((value) => value + 1);
      order.refresh();
      setMessage(
        `Saved status: ${orderStatusLabels[saved.status]}. The pending change has been cleared; nothing was resent.`,
      );
    } catch (value) {
      if (active.current)
        setMessage(
          value instanceof ApiError
            ? value.message
            : "The saved order could not be checked. The pending change remains locked.",
        );
    } finally {
      if (active.current) setReconciling(false);
    }
  }
  return (
    <div className="work-services work-order-detail">
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
            <span aria-current="page">{current?.orderNumber ?? "Order details"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-order-detail-title" tabIndex={-1}>
            {current?.orderNumber ?? "Order details"}
          </h1>
          <p>Review items, delivery and recorded fulfilment.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/orders">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to orders
          </Link>
          <button
            className="button secondary"
            disabled={busy || !!proposal || reconciling}
            onClick={order.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh order
          </button>
        </div>
      </header>
      <Feedback message={message} tone="info" toast={message} />
      {busy && (
        <div className="work-service-state" role="status">
          {current ? "Refreshing order details…" : "Loading order details…"}
          {!current && <div className="work-order-detail-skeleton" aria-hidden="true" />}
        </div>
      )}
      {error && (
        <section className="work-order-read-error">
          <h2>Order unavailable</h2>
          <Feedback message={error} />
          {current && (
            <p>
              Previously loaded details may be out of date. Refresh before making changes.
            </p>
          )}
          <button className="button secondary" disabled={busy} onClick={order.refresh}>
            Retry order
          </button>
        </section>
      )}
      {current && (
        <>
          <WorkflowProgress workflow="order" status={current.status} />
          <dl className="work-order-summary">
            <div>
              <dt>
                <Package size={18} aria-hidden="true" />
                Fulfilment
              </dt>
              <dd className="status" data-status={current.status}>
                {orderStatusLabels[current.status]}
              </dd>
            </div>
            <div>
              <dt>
                <CreditCard size={18} aria-hidden="true" />
                Payment
              </dt>
              <dd>{current.paidAt ? "Recorded" : "Not recorded"}</dd>
            </div>
            <div>
              <dt>
                {current.fulfillmentMethod === "COLLECTION" ? (
                  <Store size={18} aria-hidden="true" />
                ) : (
                  <Truck size={18} aria-hidden="true" />
                )}
                Method
              </dt>
              <dd>
                {current.fulfillmentMethod === "COLLECTION" ? "Collection" : "Delivery"}
              </dd>
            </div>
          </dl>
          <div className="work-order-detail-layout">
            <div className="work-order-primary">
              <OrderItems order={current} />
              <section
                className="work-order-panel work-order-customer"
                aria-label="Customer and fulfilment details"
              >
                <div>
                  <h2>Customer</h2>
                  <p>{current.customerName}</p>
                  <p>{current.customerEmail}</p>
                  <p>{current.customerPhone || "Phone not provided."}</p>
                </div>
                <div>
                  {current.fulfillmentMethod === "COLLECTION" ? (
                    <>
                      <h2>Collection</h2>
                      <p>{current.branch?.name ?? "Branch not recorded."}</p>
                    </>
                  ) : (
                    <OrderDeliveryDetails order={current} />
                  )}
                  {current.fulfillmentMethod === "DELIVERY" && (
                    <p className="work-order-muted">
                      {current.branch?.name ?? "Branch not recorded."}
                    </p>
                  )}
                  {current.fulfillmentEvidenceReference && (
                    <p className="work-order-muted">
                      Evidence reference: {current.fulfillmentEvidenceReference}
                    </p>
                  )}
                </div>
              </section>
              <section
                className="work-order-panel work-order-activity"
                aria-labelledby="order-activity-title"
              >
                <h2 id="order-activity-title">Order activity</h2>
                <ol>
                  {orderActivity(current).map((entry) => (
                    <li key={entry.label}>
                      <strong>{entry.label}</strong>
                      <time dateTime={entry.at}>{formatBusinessDate(entry.at)}</time>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="work-order-secondary">
              <section
                className="work-order-panel work-order-value-panel"
                aria-labelledby="recorded-order-value"
              >
                <header>
                  <h2 id="recorded-order-value">Recorded order value</h2>
                  <strong>{formatKobo(current.totalKobo)}</strong>
                </header>
                <div className="work-order-value-body">
                  <dl className="work-order-totals">
                    <div>
                      <dt>Products subtotal</dt>
                      <dd>{formatKobo(current.subtotalKobo)}</dd>
                    </div>
                    <div>
                      <dt>Discount</dt>
                      <dd>{formatKobo(current.discountAmountKobo)}</dd>
                    </div>
                    <div>
                      <dt>VAT (as recorded)</dt>
                      <dd>
                        {current.taxKobo === undefined
                          ? "Not provided."
                          : formatKobo(current.taxKobo)}
                      </dd>
                    </div>
                    <div>
                      <dt>Delivery</dt>
                      <dd>{formatKobo(current.deliveryFeeKobo)}</dd>
                    </div>
                  </dl>
                  <p className="work-order-muted">These are the saved order amounts.</p>
                  {current.paymentDueAt && (
                    <p className="work-order-muted">
                      Payment deadline:{" "}
                      <time dateTime={current.paymentDueAt}>
                        {formatBusinessDate(current.paymentDueAt)}
                      </time>
                    </p>
                  )}
                  {administrator &&
                    (current.invoice ? (
                      <Link
                        className="work-order-invoice-link text-link"
                        href={`/admin/invoices/${current.invoice.id}`}
                      >
                        View invoice {current.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <p className="work-order-muted">
                        No invoice is linked to this order.
                      </p>
                    ))}
                </div>
              </section>
              <section
                className="work-order-panel work-order-fulfilment"
                aria-labelledby="update-fulfilment-title"
              >
                <h2 id="update-fulfilment-title">Update fulfilment</h2>
                {pending && (
                  <div className="work-order-pending">
                    <Feedback
                      tone="warning"
                      message="The last change could not be confirmed. Check the saved order before making another change. Nothing will be resent automatically."
                    />
                    <button
                      id="work-order-reconcile"
                      className="button secondary"
                      disabled={busy || !!error || !!proposal || reconciling}
                      onClick={() => void reconcile()}
                    >
                      Load saved order and clear pending change
                    </button>
                  </div>
                )}
                {current.cancellationReason && (
                  <p>Cancellation reason: {current.cancellationReason}</p>
                )}
                {!current.paidAt &&
                  !["COMPLETED", "CANCELLED"].includes(current.status) && (
                    <p className="work-order-muted">
                      Verified payment is required before confirming or fulfilling this
                      order.
                    </p>
                  )}
                {["CONFIRMED", "PROCESSING"].includes(current.status) &&
                  !current.allowedTransitions.includes("CANCELLED") && (
                    <p className="work-order-muted">
                      Cancellation after confirmation requires an approved cancellation
                      review in aftercare.
                    </p>
                  )}
                {current.allowedTransitions.length > 0 ? (
                  <form
                    key={`${current.version}:${epoch}`}
                    noValidate
                    data-draft-key={JSON.stringify([
                      "staff-order-detail:2",
                      orderId,
                      current.version,
                      epoch,
                    ])}
                    onSubmit={(event) => {
                      event.preventDefault();
                      review(new FormData(event.currentTarget));
                    }}
                  >
                    <fieldset disabled={blocked}>
                      <div className="field">
                        <label htmlFor="fulfilment-status">Next status</label>
                        <select
                          id="fulfilment-status"
                          name="status"
                          defaultValue=""
                          aria-invalid={validation?.field === "fulfilment-status"}
                          aria-describedby={
                            validation?.field === "fulfilment-status"
                              ? "fulfilment-validation"
                              : undefined
                          }
                        >
                          <option value="">Choose next status</option>
                          {current.allowedTransitions.map((status) => (
                            <option key={status} value={status}>
                              {orderStatusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="fulfilment-reason">
                          Reason (required for cancellation)
                        </label>
                        <textarea
                          id="fulfilment-reason"
                          name="reason"
                          maxLength={500}
                          rows={3}
                          aria-invalid={validation?.field === "fulfilment-reason"}
                          aria-describedby={
                            validation?.field === "fulfilment-reason"
                              ? "fulfilment-validation"
                              : undefined
                          }
                        />
                      </div>
                      {validation && (
                        <p
                          className="field-error"
                          role="alert"
                          id="fulfilment-validation"
                        >
                          {validation.message}
                        </p>
                      )}
                      <button
                        className="button"
                        type="submit"
                        id="review-fulfilment-change"
                      >
                        Review fulfilment change
                      </button>
                    </fieldset>
                  </form>
                ) : (
                  <p className="work-order-muted">
                    No further fulfilment changes are available.
                  </p>
                )}
                <p className="work-order-muted">
                  A status change does not record a payment or refund.
                </p>
              </section>
              <section className="work-order-panel work-order-aftercare">
                <h2>Returns and cancellation review</h2>
                <p>Review requests and collection or delivery evidence for this order.</p>
                <Link className="text-link" href={`/admin/orders/${orderId}/aftercare`}>
                  Open aftercare
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
      {proposal && current && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            requestAnimationFrame(() => {
              const target = document.getElementById(
                pending ? "work-order-reconcile" : "review-fulfilment-change",
              );
              if (target instanceof HTMLButtonElement && !target.matches(":disabled"))
                target.focus();
              else
                document
                  .getElementById("work-order-detail-title")
                  ?.focus({ preventScroll: true });
            });
          }}
          onSuccess={() => {
            setMessage("Order change recorded. Review the refreshed status.");
            setEpoch((value) => value + 1);
            order.refresh();
          }}
        />
      )}
    </div>
  );
}
function OrderItems({ order }: { order: StaffOrderRecord }) {
  return (
    <section
      className="work-order-panel work-order-items"
      aria-labelledby="work-order-items-title"
    >
      <h2 id="work-order-items-title">
        Order items <span>({order.items.length})</span>
      </h2>
      {order.items.length ? (
        <table className="work-order-item-table" aria-label="Order items">
          <thead>
            <tr>
              {["Product", "Quantity", "Unit price", "Line subtotal"].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  <strong>{item.productName}</strong>
                  <small>SKU: {item.sku}</small>
                </th>
                <td>
                  <span className="work-order-item-label" aria-hidden="true">
                    Quantity
                  </span>
                  {item.quantity}
                </td>
                <td>
                  <span className="work-order-item-label" aria-hidden="true">
                    Unit price
                  </span>
                  {formatKobo(item.unitPriceKobo)}
                </td>
                <td>
                  <span className="work-order-item-label" aria-hidden="true">
                    Line subtotal
                  </span>
                  {formatKobo(item.subtotalKobo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="work-order-muted">No line items are recorded for this order.</p>
      )}
    </section>
  );
}
