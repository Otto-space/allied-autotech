"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  orderMatchesFilters,
  orderStatusLabels,
  parseWorkOrders,
  workOrdersQuery,
  type WorkOrder,
} from "@/lib/admin/work-orders";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";

export function StaffOrders() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Order fulfilment</h1>
        <Feedback message="Staff access is required to view order fulfilment." />
      </>
    );
  return (
    <OrdersWorkspace
      key={`${session.user.id}:${session.user.role}`}
      administrator={session.user.role !== "STAFF"}
    />
  );
}
function navigate(params: URLSearchParams) {
  window.history.pushState(null, "", `/admin/orders${params.size ? `?${params}` : ""}`);
}
function OrdersWorkspace({ administrator }: { administrator: boolean }) {
  const search = useSearchParams();
  const { params, api, invalid, path } = workOrdersQuery(
    new URLSearchParams(search.toString()),
    administrator,
  );
  const resource = useResource(path, parseWorkOrders);
  const mismatch = resource.data?.items.some((order) => !orderMatchesFilters(order, api));
  const data = mismatch || invalid ? undefined : resource.data;
  const error = mismatch
    ? "The returned orders do not match your filters. Refresh to try again."
    : resource.error || resource.refreshError;
  const busy = resource.loading || resource.refreshing;
  const blocked = busy || !!error || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function page(direction: "previous" | "next") {
    const next = new URLSearchParams(params);
    if (direction === "next" && data?.nextCursor) {
      const history = [...trail, cursor ?? "start"];
      next.set("cursor", data.nextCursor);
      if (history.length <= 20 && history[0] === "start")
        next.set("_trail", history.join(","));
      else next.delete("_trail");
    } else {
      const history = [...trail],
        previous = history.pop();
      if (previous && previous !== "start") next.set("cursor", previous);
      else next.delete("cursor");
      if (history.length) next.set("_trail", history.join(","));
      else next.delete("_trail");
    }
    navigate(next);
    document.getElementById("work-orders-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-services work-orders">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Order fulfilment</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-orders-title" tabIndex={-1}>
            Order fulfilment
          </h1>
          <p>Manage orders within your permitted branches.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || invalid}
          onClick={resource.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh orders
        </button>
      </header>
      {invalid ? (
        <section className="work-service-state">
          <h2>Order filters unavailable</h2>
          <p>This link contains invalid or unavailable order filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <OrderFilters
            key={filters.toString()}
            params={filters}
            administrator={administrator}
            busy={busy}
          />
          <p className="work-orders-note">
            Fulfilment status and recorded payment are shown separately.
          </p>
          <section
            className="work-service-catalogue work-orders-catalogue"
            aria-labelledby="work-orders-records"
          >
            <div className="work-service-band">
              <h2 id="work-orders-records">Order records</h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "order" : "orders"} on
                  this page
                </span>
              )}
            </div>
            {busy && (
              <div className="work-service-state" role="status">
                {data ? "Refreshing orders…" : "Loading orders…"}
                {!data && <div className="work-orders-skeleton" aria-hidden="true" />}
              </div>
            )}
            {error && (
              <div className="work-service-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded orders are shown. Refresh before moving to another page."
                    : "Orders could not be loaded. Try again when your connection is available."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={resource.refresh}
                >
                  Retry orders
                </button>
              </div>
            )}
            {data && data.items.length > 0 && <OrdersTable orders={data.items} />}
            {!busy && !error && data?.items.length === 0 && (
              <div className="work-service-state">
                <h3>
                  {filters.size
                    ? "No orders match these filters"
                    : "No orders on this page"}
                </h3>
                <p>
                  {filters.size
                    ? "Check the full order number or clear filters to see other orders."
                    : "New orders will appear here when customers complete checkout."}
                </p>
                {(filters.size > 0 || !!cursor) && (
                  <button
                    className="button secondary"
                    onClick={() => navigate(new URLSearchParams())}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <nav className="work-service-pagination" aria-label="Order pages">
              <button
                className="button secondary"
                disabled={blocked || !cursor}
                onClick={() => page("previous")}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {cursor && !trail.length ? "First page" : "Previous"}
              </button>
              <span>
                {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
              </span>
              <button
                className="button secondary"
                disabled={blocked || !data?.nextCursor || data.nextCursor === cursor}
                onClick={() => page("next")}
              >
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
function OrderFilters({
  params,
  administrator,
  busy,
}: {
  params: URLSearchParams;
  administrator: boolean;
  busy: boolean;
}) {
  const [orderNumber, setNumber] = useState(params.get("orderNumber") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [branchId, setBranch] = useState(params.get("branchId") ?? "");
  const [error, setError] = useState("");
  return (
    <form
      className={`work-orders-filters${administrator ? " has-branch" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        if (orderNumber.trim()) next.set("orderNumber", orderNumber.trim());
        if (status) next.set("status", status);
        if (administrator && branchId) next.set("branchId", branchId);
        if (params.has("customerId")) next.set("customerId", params.get("customerId")!);
        const query = workOrdersQuery(next, administrator);
        if (query.invalid) {
          setError(
            "Enter a full order number of up to 120 characters without control characters.",
          );
          return;
        }
        setError("");
        navigate(query.params);
      }}
    >
      <div className="field">
        <label htmlFor="work-order-number">Order number</label>
        <input
          id="work-order-number"
          value={orderNumber}
          maxLength={120}
          onChange={(event) => setNumber(event.target.value)}
          placeholder="Enter the full order number"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "work-order-number-error" : undefined}
        />
        {error && (
          <p className="field-error" role="alert" id="work-order-number-error">
            {error}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="work-order-status">Fulfilment status</label>
        <select
          id="work-order-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(orderStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {administrator && (
        <div className="field">
          <label htmlFor="work-order-branch">Branch</label>
          <AdminBranchPicker
            id="work-order-branch"
            value={branchId}
            onChange={setBranch}
            activeOnly={false}
          />
        </div>
      )}
      <div className="work-order-filter-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setNumber("");
            setStatus("");
            setBranch("");
            setError("");
            navigate(new URLSearchParams());
          }}
        >
          Clear filters
        </button>
        <button className="button" disabled={busy} type="submit">
          Apply filters
        </button>
      </div>
      {params.has("customerId") && (
        <div className="work-order-customer-filter">
          <span>Filtered to one customer</span>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("customerId");
              navigate(next);
            }}
          >
            Clear customer filter
          </button>
        </div>
      )}
    </form>
  );
}
function OrdersTable({ orders }: { orders: WorkOrder[] }) {
  return (
    <table className="work-orders-table" aria-label="Order fulfilment records">
      <thead>
        <tr>
          {["Order", "Branch", "Fulfilment", "Payment", "Order value"].map((label) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <th scope="row">
              <Link className="work-order-link" href={`/admin/orders/${order.id}`}>
                {order.orderNumber}
              </Link>
              <small>
                Created{" "}
                <time dateTime={order.createdAt}>
                  {formatBusinessDate(order.createdAt)}
                </time>
              </small>
              <span className="work-order-method">
                {order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Collection"}
              </span>
            </th>
            <td>
              <span className="work-order-mobile-label" aria-hidden="true">
                Branch
              </span>
              {order.branch.name}
            </td>
            <td>
              <span className="work-order-mobile-label" aria-hidden="true">
                Fulfilment
              </span>
              <span className="work-order-status" data-status={order.status}>
                {orderStatusLabels[order.status]}
              </span>
            </td>
            <td>
              <span className="work-order-mobile-label" aria-hidden="true">
                Payment
              </span>
              <span className="work-order-status">
                {order.paidAt ? "Recorded" : "Not recorded"}
              </span>
              {order.paidAt && (
                <small>
                  <time dateTime={order.paidAt}>{formatBusinessDate(order.paidAt)}</time>
                </small>
              )}
            </td>
            <td>
              <span className="work-order-mobile-label" aria-hidden="true">
                Order value
              </span>
              <span className="work-order-value">{formatKobo(order.totalKobo)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
