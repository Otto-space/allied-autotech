"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseCustomerInvoices } from "@/lib/api/customer-invoices-schema";
import {
  customerInvoiceQuery,
  invoiceStatuses,
  invoiceLabels,
  invoiceStatusNotes,
} from "@/lib/customer-invoice-query";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";

export function InvoicesPanel() {
  const search = useSearchParams();
  const { params, invalid, path } = customerInvoiceQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "";
  const limit = params.get("limit")!;
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const invoices = useResource(path, parseCustomerInvoices);
  const data = !invoices.loading && !invoices.error ? invoices.data : undefined;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/invoices?${customerInvoiceQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("invlist-results")?.focus({ preventScroll: true });
      document.getElementById("invlist-results")?.scrollIntoView({ block: "start" });
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
    document.getElementById("invlist-filter")?.focus();
  }
  return (
    <div className="customer-invoices">
      <nav className="invlist-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Invoices</span>
          </li>
        </ol>
      </nav>
      <header className="invlist-list-heading">
        <div>
          <h1>Your invoices</h1>
          <p>Review issued invoices, deposit credits and payment records.</p>
        </div>
        <div className="invlist-list-actions">
          <button
            className="button"
            onClick={invoices.refresh}
            disabled={invoices.loading || invoices.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {invoices.refreshing ? "Updating\u2026" : "Refresh"}
          </button>
          <Link className="button secondary" href="/dashboard/payments">
            View payments
          </Link>
        </div>
      </header>
      <aside className="invlist-guidance">
        <FileText size={24} aria-hidden="true" />
        <div>
          <h2>Invoices and documents</h2>
          <p>
            Open an invoice to review charges, deposit credits and available download or
            share options.
          </p>
        </div>
      </aside>
      <div className="invlist-filters" role="group" aria-label="Invoice filters">
        <div className="invlist-filter-field">
          <label htmlFor="invlist-filter">Invoice status</label>
          <select
            id="invlist-filter"
            value={status}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {invoiceStatuses.map((value) => (
              <option value={value} key={value}>
                {invoiceLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="invlist-filter-field">
          <label htmlFor="invlist-limit">Rows per page</label>
          <select
            id="invlist-limit"
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
          className="invlist-reset"
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
      {invoices.refreshError && (
        <p className="invlist-refresh-error" role="alert">
          <span>We could not refresh these invoices. The list may be out of date.</span>
          <button type="button" onClick={invoices.refresh}>
            Retry invoices
          </button>
        </p>
      )}
      <section className="invlist-results" aria-label="Invoice results">
        <h2
          id="invlist-results"
          tabIndex={-1}
          className="invlist-result-count"
          aria-live="polite"
        >
          {invoices.loading
            ? "Checking invoices…"
            : invoices.error
              ? "Invoices unavailable"
              : data
                ? `${data.items.length} invoice${data.items.length === 1 ? "" : "s"} on this page`
                : "Checking invoices…"}
        </h2>
        {invoices.error && (
          <div className="invlist-list-state" role="alert">
            <FileText size={28} aria-hidden="true" />
            <h3>We couldn’t load your invoices</h3>
            <p>{invoices.error}</p>
            <button className="button secondary" onClick={invoices.refresh}>
              Retry invoices
            </button>
          </div>
        )}
        {invoices.loading && (
          <div className="invlist-list-skeleton" aria-hidden="true">
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
          <div className="invlist-table">
            <table>
              <caption className="sr-only">Your invoices on this page</caption>
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">For</th>
                  <th scope="col">Status</th>
                  <th scope="col">Total</th>
                  <th scope="col">
                    <span className="sr-only">Invoice details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="invlist-identity">
                      <h3>{invoice.invoiceNumber}</h3>
                      <small>
                        {invoice.issuedAt
                          ? `Issued ${formatBusinessDate(invoice.issuedAt)}`
                          : `Created ${formatBusinessDate(invoice.createdAt)}`}
                      </small>
                      <small>
                        {invoice.dueAt
                          ? `Due ${formatBusinessDate(invoice.dueAt)}`
                          : "No due date"}
                      </small>
                    </td>
                    <td data-label="For" className="invlist-related">
                      <div className="invlist-source-names">
                        {invoice.order && (
                          <strong>Order {invoice.order.orderNumber}</strong>
                        )}
                        {invoice.booking && <strong>Service booking</strong>}
                        {invoice.vehicleTransaction && (
                          <strong>
                            Vehicle purchase{" "}
                            {invoice.vehicleTransaction.transactionNumber}
                          </strong>
                        )}
                        {!invoice.order &&
                          !invoice.booking &&
                          !invoice.vehicleTransaction && (
                            <strong>See invoice details</strong>
                          )}
                      </div>
                      <div className="invlist-related-links">
                        {[
                          { id: invoice.order?.id, path: "orders", label: "View order" },
                          {
                            id: invoice.booking?.id,
                            path: "bookings",
                            label: "View booking",
                          },
                          {
                            id: invoice.vehicleTransaction?.id,
                            path: "vehicle-transactions",
                            label: "View vehicle purchase",
                          },
                        ]
                          .filter((record) => record.id)
                          .map((record) => (
                            <Link
                              key={record.path}
                              href={`/dashboard/${record.path}/${record.id}`}
                              prefetch={false}
                              aria-label={`${record.label} for ${invoice.invoiceNumber}`}
                            >
                              {record.label}
                            </Link>
                          ))}
                      </div>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`invlist-state ${invoice.status === "VOID" ? "closed" : ""}`}
                      >
                        {invoiceLabels[invoice.status]}
                      </span>
                      <small>{invoiceStatusNotes[invoice.status]}</small>
                    </td>
                    <td data-label="Total">
                      <strong>{formatKobo(invoice.totalKobo)}</strong>
                      <small>
                        {BigInt(invoice.depositCreditKobo) > BigInt(0)
                          ? `After ${formatKobo(invoice.depositCreditKobo)} credit`
                          : "Invoice total"}
                      </small>
                    </td>
                    <td className="invlist-row-action">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        aria-label={`View invoice: ${invoice.invoiceNumber}`}
                        prefetch={false}
                      >
                        View invoice <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="invlist-list-state">
            <FileText size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No invoices on this page"
                : status
                  ? "No invoices with this status"
                  : "No invoices have been issued"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Your issued invoices will appear here."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset invoice filters
              </button>
            ) : (
              <Link className="button secondary" href="/dashboard">
                Back to overview
              </Link>
            )}
          </div>
        )}
      </section>
      <nav className="invlist-pagination" aria-label="Invoice pages">
        <button
          className="button secondary"
          disabled={!trail.length || invoices.loading}
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
          disabled={!data?.nextCursor || invoices.loading}
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
          <button className="invlist-reset" onClick={firstPage}>
            First page
          </button>
        )}
      </nav>
      <footer className="invlist-list-footer">
        <p>Dates shown in Lagos time.</p>
        <p>
          Need help with an invoice?{" "}
          <Link href="/dashboard/support">Contact support</Link>
        </p>
      </footer>
    </div>
  );
}
