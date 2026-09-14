"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseOrders } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function StaffOrders() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const orders = useResource(
    `/staff/orders?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseOrders,
  );
  return (
    <>
      <h1>Order fulfilment</h1>
      <p className="lead">
        Manage orders within your permitted branches. Fulfilment status and recorded
        payment are shown separately.
      </p>
      <div className="field">
        <label htmlFor="staff-order-status">Order status</label>
        <select
          id="staff-order-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {["PENDING", "CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"].map(
            (value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ),
          )}
        </select>
      </div>
      <Feedback message={orders.error} />
      <button
        className="button secondary"
        disabled={orders.loading}
        onClick={orders.refresh}
      >
        Refresh orders
      </button>
      {orders.loading && <p role="status">Checking orders…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Order fulfilment records"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Branch</th>
              <th>Fulfilment</th>
              <th>Payment</th>
              <th>Order value</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.items.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link className="text-link" href={`/admin/orders/${order.id}`}>
                    {order.orderNumber}
                  </Link>
                  <p className="muted">{formatBusinessDate(order.createdAt)}</p>
                </td>
                <td>{order.branch.name}</td>
                <td>{order.status}</td>
                <td>{order.paidAt ? "Recorded" : "Not recorded"}</td>
                <td>{formatKobo(order.totalKobo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.loading && !orders.error && orders.data?.items.length === 0 && (
        <div className="empty">
          <h2>{status ? "No orders match this status" : "No orders on this page"}</h2>
          {status && (
            <button
              className="button secondary"
              onClick={() => {
                setStatus("");
                pagination.reset();
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={orders.data?.nextCursor}
        disabled={orders.loading || !!orders.error}
        label="Staff orders"
      />
    </>
  );
}
