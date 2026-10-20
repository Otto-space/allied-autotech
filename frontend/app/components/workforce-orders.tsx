"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  ordersHref,
  fulfillmentLabels,
  orderStatusLabels,
  parseScopedWorkforceOrders,
  workforceOrdersPageParams,
  workforceOrdersQuery,
} from "@/lib/admin/workforce-orders";
import { formatBusinessDate } from "@/lib/format/date";
import { WorkforceOrderDetail } from "./workforce-order-detail";
import "./workforce-complaints.css";
import "./workforce-orders.css";

export function WorkforceOrders({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const query = workforceOrdersQuery(new URLSearchParams(search.toString()));
  const [revision, setRevision] = useState(0);
  const record = useResource(query.path, parseScopedWorkforceOrders);
  const busy = record.loading || record.refreshing;
  const failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const selected = query.params.get("selected");
  const filtered = ["q", "status", "fulfillmentMethod"].some((name) =>
    query.params.has(name),
  );
  const navigate = (params: URLSearchParams) =>
    router.push(ordersHref(params), { scroll: false });
  function refresh() {
    refreshAccess();
    record.refresh();
    setRevision((v) => v + 1);
  }
  function select(id?: string) {
    const params = new URLSearchParams(query.params);
    if (id) params.set("selected", id);
    else params.delete("selected");
    navigate(params);
  }
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  return (
    <div className="workforce-complaints workforce-orders">
      <nav className="wfc-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Order progress</span>
          </li>
        </ol>
      </nav>
      <header className="wfc-heading">
        <div>
          <h1>Order progress</h1>
          <p>Track orders and prepare paid collections within your responsibilities.</p>
        </div>
        <div className="wfc-refresh">
          <button
            className="button secondary"
            onClick={refresh}
            disabled={busy || query.invalid}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing records…" : "Refresh records"}
          </button>
          {data && (
            <p>
              Updated{" "}
              <time dateTime={data.generatedAt}>
                {formatBusinessDate(data.generatedAt)}
              </time>
            </p>
          )}
        </div>
      </header>
      <form
        key={search.toString()}
        className="wfc-filters"
        aria-label="Filter orders"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const name of ["q", "status", "fulfillmentMethod"]) {
            const v = String(values.get(name) ?? "").trim();
            if (v) params.set(name, v);
          }
          navigate(params);
          if (params.toString() === query.params.toString()) record.refresh();
        }}
      >
        <div className="field wfc-search">
          <label htmlFor="wfc-q">Search orders</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfc-q"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Order number or product"
              aria-describedby="wfc-search-hint"
            />
          </div>
        </div>
        {(
          [
            ["status", "Order status", "All order states", orderStatusLabels],
            ["fulfillmentMethod", "Fulfillment", "All methods", fulfillmentLabels],
          ] as const
        ).map(([name, label, all, choices]) => (
          <div className="field" key={name}>
            <label htmlFor={`wfo-${name}`}>{label}</label>
            <select
              id={`wfo-${name}`}
              name={name}
              defaultValue={query.params.get(name) ?? ""}
            >
              <option value="">{all}</option>
              {Object.entries(choices).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p id="wfc-search-hint">Search covers all orders in your current scope.</p>
        <div className="wfc-filter-actions">
          <button className="button" disabled={busy}>
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={(e) => {
              e.currentTarget.form?.reset();
              navigate(new URLSearchParams());
            }}
          >
            Clear filters
          </button>
        </div>
      </form>
      {(query.invalid || failure || mismatch) && (
        <section className="wfc-feedback" role="alert">
          <h2>
            {query.invalid
              ? "Order filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Order access unavailable"
                  : "Orders could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid order filters. Clear filters to start again."
              : "Refresh orders to check your current access and records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfc-results"
        aria-labelledby="wfc-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfc-results-title">Orders</h2>
        </header>
        {busy && !query.invalid ? (
          <div className="wfc-state" role="status">
            Checking permitted orders…
            <div className="wfc-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Orders in your current responsibility scope
            </caption>
            <thead>
              <tr>
                {["Order", "Branch", "Fulfillment", "Payment", "Status", "Open"].map(
                  (label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className={row.id === selected ? "is-selected" : undefined}
                >
                  <th scope="row">
                    {row.orderNumber}
                    <small>
                      <time dateTime={row.createdAt}>
                        {formatBusinessDate(row.createdAt)}
                      </time>
                    </small>
                  </th>
                  <td data-label="Branch">{row.branch?.name ?? "Branch not recorded"}</td>
                  <td data-label="Fulfillment">
                    {fulfillmentLabels[row.fulfillmentMethod]}
                  </td>
                  <td data-label="Payment">
                    {row.paidAt ? "Paid recorded" : "Not recorded"}
                  </td>
                  <td data-label="Status">
                    <span className={`wfc-status is-${row.status.toLowerCase()}`}>
                      {orderStatusLabels[row.status]}
                    </span>
                  </td>
                  <td data-label="Open">
                    <button
                      className="button secondary"
                      aria-label={`View order: ${row.orderNumber}`}
                      aria-pressed={row.id === selected}
                      onClick={() => select(row.id)}
                    >
                      View order
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          data && (
            <div className="wfc-state">
              <h3>
                {filtered
                  ? "No orders match these filters"
                  : "No orders in your current scope"}
              </h3>
              <p>
                {filtered
                  ? "Adjust or clear filters to see other permitted orders."
                  : "Orders appear here when available within your responsibilities."}
              </p>
            </div>
          )
        )}
        {data && (
          <footer>
            <p role="status">
              {data.items.length} {data.items.length === 1 ? "order" : "orders"} on this
              page
            </p>
            <nav aria-label="Order pages">
              <button
                className="button secondary"
                disabled={!query.params.has("cursor")}
                onClick={() => navigate(first)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={!query.params.has("_trail")}
                onClick={() =>
                  navigate(workforceOrdersPageParams(query.params, undefined, true))
                }
              >
                Previous page
              </button>
              <button
                className="button secondary"
                disabled={!data.nextCursor}
                onClick={() =>
                  navigate(workforceOrdersPageParams(query.params, data.nextCursor))
                }
              >
                Next orders
              </button>
            </nav>
          </footer>
        )}
      </section>
      {selected && !query.invalid ? (
        <WorkforceOrderDetail
          key={`${access.userId}:${selected}`}
          id={selected}
          access={access}
          close={() => select()}
          refresh={refresh}
          refreshKey={revision}
          enabled={!!data}
          denied={record.denied || mismatch}
        />
      ) : (
        data && (
          <p className="wfc-selection-hint">
            Select an order to review its items, progress and available actions.
          </p>
        )
      )}
    </div>
  );
}
