"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Package, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseCustomerOrders } from "@/lib/api/customer-orders-schema";
import {
  customerOrderQuery,
  orderStatuses,
  orderLabel,
} from "@/lib/customer-order-query";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";

export function OrdersPanel() {
  const search = useSearchParams();
  const { params, invalid, path } = customerOrderQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "";
  const limit = params.get("limit")!;
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const orders = useResource(path, parseCustomerOrders);
  const data = !orders.loading && !orders.error ? orders.data : undefined;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/orders?${customerOrderQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("order-results")?.focus({ preventScroll: true });
      document.getElementById("order-results")?.scrollIntoView({ block: "start" });
    }
  }
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }
  function firstPage() {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next, true);
  }
  function reset() {
    navigate(new URLSearchParams());
    document.getElementById("order-filter")?.focus();
  }
  return (
    <div className="customer-orders">
      <nav className="order-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Orders</span>
          </li>
        </ol>
      </nav>
      <header className="order-list-heading">
        <div>
          <h1>Your orders</h1>
          <p>Review items, collection or delivery, totals and payment records.</p>
        </div>
        <div className="order-list-actions">
          <Link className="button" href="/parts">
            Browse parts
          </Link>
          <button
            className="button secondary"
            onClick={orders.refresh}
            disabled={orders.loading || orders.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {orders.refreshing ? "Updating…" : "Refresh"}
          </button>
        </div>
      </header>
      <aside className="order-guidance">
        <Package size={24} aria-hidden="true" />
        <div>
          <h2>Your next step is in the details</h2>
          <p>Open an order to review its items, payment options and available actions.</p>
        </div>
      </aside>
      <div className="order-filters" role="group" aria-label="Order filters">
        <div className="order-filter-field">
          <label htmlFor="order-filter">Order status</label>
          <select
            id="order-filter"
            value={status}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {orderStatuses.map((value) => (
              <option value={value} key={value}>
                {orderLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="order-filter-field">
          <label htmlFor="order-limit">Rows per page</label>
          <select
            id="order-limit"
            value={limit}
            onChange={(event) => filter("limit", event.target.value)}
          >
            {[10, 20, 50].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="order-reset"
          onClick={reset}
          disabled={!status && limit === "20" && !cursor && !invalid}
        >
          Reset filters
        </button>
      </div>
      {invalid && (
        <p role="status">
          Some invalid filters were ignored. Reset filters to clear them.
        </p>
      )}
      {orders.refreshError && (
        <p className="order-refresh-error" role="alert">
          We could not refresh these orders. The list may be out of date.{" "}
          <button type="button" onClick={orders.refresh}>
            Retry orders
          </button>
        </p>
      )}
      <section className="order-results" aria-label="Order results">
        <h2
          id="order-results"
          tabIndex={-1}
          className="order-result-count"
          aria-live="polite"
        >
          {orders.loading
            ? "Checking orders…"
            : orders.error
              ? "Orders unavailable"
              : data
                ? `${data.items.length} order${data.items.length === 1 ? "" : "s"} on this page`
                : "Checking orders…"}
        </h2>
        {orders.error && (
          <div className="order-list-state" role="alert">
            <Package size={28} aria-hidden="true" />
            <h3>We couldn’t load your orders</h3>
            <p>{orders.error}</p>
            <button className="button secondary" onClick={orders.refresh}>
              Retry orders
            </button>
          </div>
        )}
        {orders.loading && (
          <div className="order-list-skeleton" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                {[1, 2, 3, 4, 5].map((column) => (
                  <span key={column} />
                ))}
              </div>
            ))}
          </div>
        )}
        {data && data.items.length > 0 && (
          <div className="order-table">
            <table>
              <caption className="sr-only">Your orders on this page</caption>
              <thead>
                <tr>
                  <th scope="col">Order &amp; items</th>
                  <th scope="col">Collection or delivery</th>
                  <th scope="col">Status</th>
                  <th scope="col">Total &amp; payment</th>
                  <th scope="col">
                    <span className="sr-only">Order details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id}>
                    <td className="order-identity">
                      <h3>{order.orderNumber}</h3>
                      <small>{formatBusinessDate(order.createdAt)}</small>
                      {order.items.slice(0, 2).map((item) => (
                        <p key={item.id}>
                          {item.productName}{" "}
                          <span className="order-quantity">&times; {item.quantity}</span>
                        </p>
                      ))}
                      {order.items.length > 2 && (
                        <small>
                          +{order.items.length - 2} more{" "}
                          {order.items.length === 3 ? "item" : "items"}
                        </small>
                      )}
                      {!order.items.length && <p>See order for item details</p>}
                    </td>
                    <td data-label="Collection or delivery" className="order-fulfillment">
                      <strong>
                        {order.fulfillmentMethod === "COLLECTION"
                          ? "Collection"
                          : "Delivery"}
                      </strong>
                      <p>
                        {order.fulfillmentMethod === "COLLECTION"
                          ? (order.branch?.name ?? "Collection branch not assigned")
                          : [order.deliveryCity, order.deliveryState]
                              .filter(Boolean)
                              .join(", ") || "See order for delivery details"}
                      </p>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`order-state ${order.status === "CANCELLED" ? "closed" : ""}`}
                      >
                        {orderLabel(order.status)}
                      </span>
                    </td>
                    <td data-label="Total & payment">
                      <strong>{formatKobo(order.totalKobo)}</strong>
                      <p>{order.paidAt ? "Payment recorded" : "Payment not recorded"}</p>
                    </td>
                    <td className="order-row-action">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        aria-label={`View order: ${order.orderNumber}`}
                        prefetch={false}
                      >
                        View order <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="order-list-state">
            <Package size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No orders on this page"
                : status
                  ? "No orders with this status"
                  : "No orders yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Browse parts and review your order at checkout."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset order filters
              </button>
            ) : (
              <Link className="button" href="/parts">
                Browse parts
              </Link>
            )}
          </div>
        )}
      </section>
      <nav className="order-pagination" aria-label="Order pages">
        <button
          className="button secondary"
          disabled={!trail.length || orders.loading}
          onClick={() => {
            const next = new URLSearchParams(params);
            const previous = trail.at(-1)!;
            if (previous === "start") next.delete("cursor");
            else next.set("cursor", previous);
            const remaining = trail.slice(0, -1);
            if (remaining.length) next.set("_trail", remaining.join(","));
            else next.delete("_trail");
            navigate(next, true);
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Previous
        </button>
        <span>{cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}</span>
        <button
          className="button secondary"
          disabled={!data?.nextCursor || orders.loading}
          onClick={() => {
            if (!data?.nextCursor) return;
            const next = new URLSearchParams(params);
            next.set("cursor", data.nextCursor);
            if ((!cursor || trail.length) && trail.length < 50)
              next.set("_trail", [...trail, cursor ?? "start"].join(","));
            else next.delete("_trail");
            navigate(next, true);
          }}
        >
          Next
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {cursor && !trail.length && (
          <button className="order-reset" onClick={firstPage}>
            First page
          </button>
        )}
      </nav>
      <footer className="order-list-footer">
        <p>Dates shown in Lagos time.</p>
        <p>
          Need help with an order? <Link href="/dashboard/support">Contact support</Link>
        </p>
      </footer>
    </div>
  );
}
