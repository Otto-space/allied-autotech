"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseOrders } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
export function OrdersPanel() {
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const orders = useResource(
    `/customers/orders?limit=20${status ? `&status=${status}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    parseOrders,
  );
  return (
    <>
      <h1>Your orders</h1>
      <p className="muted">
        Review collection details, confirmed totals and payment status.
      </p>
      <div className="field filter-field">
        <label htmlFor="order-status">Filter by status</label>
        <select
          id="order-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setCursor(undefined);
            setHistory([]);
          }}
        >
          <option value="">All statuses</option>
          {["PENDING", "CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"].map(
            (item) => (
              <option key={item} value={item}>
                {item.toLowerCase()}
              </option>
            ),
          )}
        </select>
      </div>
      <Feedback message={orders.error} />
      {orders.error && (
        <button className="button secondary" onClick={orders.refresh}>
          Retry orders
        </button>
      )}
      {orders.loading && (
        <p role="status">{orders.data ? "Updating orders…" : "Loading orders…"}</p>
      )}
      <div className="list">
        {orders.data?.items.map((order) => (
          <article key={order.id} className="list-item">
            <div>
              <h2>
                <Link href={`/dashboard/orders/${order.id}`} className="text-link">
                  {order.orderNumber}
                </Link>
              </h2>
              <p className="muted">
                {formatBusinessDate(order.createdAt)} · {order.branch.name}
              </p>
              <span className="status">{order.status}</span>
            </div>
            <div>
              <strong>{formatKobo(order.totalKobo)}</strong>
              <p>{order.paidAt ? "Payment recorded" : "Payment not recorded"}</p>
              <Link className="text-link" href={`/dashboard/orders/${order.id}`}>
                View order →
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!orders.loading && !orders.error && orders.data?.items.length === 0 && (
        <div className="empty">
          <h2>{status ? "No orders with this status" : "No orders yet"}</h2>
          <Link className="button" href="/parts">
            Visit Shop
          </Link>
        </div>
      )}
      <nav className="pagination" aria-label="Order pages">
        <button
          className="button secondary"
          disabled={!history.length || orders.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!orders.data?.nextCursor || orders.loading || !!orders.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(orders.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
    </>
  );
}
