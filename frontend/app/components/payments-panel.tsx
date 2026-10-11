"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CreditCard, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseCustomerPayments } from "@/lib/api/customer-payments-schema";
import {
  customerPaymentQuery,
  paymentStatuses,
  paymentLabels,
  paymentPurpose,
  paymentStatusNotes,
} from "@/lib/customer-payment-query";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";

export function PaymentsPanel() {
  const search = useSearchParams();
  const { params, invalid, path } = customerPaymentQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "";
  const limit = params.get("limit")!;
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const payments = useResource(path, parseCustomerPayments);
  const data = !payments.loading && !payments.error ? payments.data : undefined;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/payments?${customerPaymentQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("paylist-results")?.focus({ preventScroll: true });
      document.getElementById("paylist-results")?.scrollIntoView({ block: "start" });
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
    document.getElementById("paylist-filter")?.focus();
  }
  return (
    <div className="customer-payments">
      <nav className="paylist-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Payments</span>
          </li>
        </ol>
      </nav>
      <header className="paylist-list-heading">
        <div>
          <h1>Your payments</h1>
          <p>Check a payment here before making another attempt.</p>
        </div>
        <div className="paylist-list-actions">
          <button
            className="button"
            onClick={payments.refresh}
            disabled={payments.loading || payments.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {payments.refreshing ? "Updating\u2026" : "Refresh"}
          </button>
          <Link className="button secondary" href="/dashboard/invoices">
            View invoices
          </Link>
        </div>
      </header>
      <aside className="paylist-guidance">
        <CreditCard size={24} aria-hidden="true" />
        <div>
          <h2>Check before paying again</h2>
          <p>
            A payment attempt is not a confirmed payment. Open the details to check the
            latest status.
          </p>
        </div>
      </aside>
      <div className="paylist-filters" role="group" aria-label="Payment filters">
        <div className="paylist-filter-field">
          <label htmlFor="paylist-filter">Payment status</label>
          <select
            id="paylist-filter"
            value={status}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {paymentStatuses.map((value) => (
              <option value={value} key={value}>
                {paymentLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="paylist-filter-field">
          <label htmlFor="paylist-limit">Rows per page</label>
          <select
            id="paylist-limit"
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
          className="paylist-reset"
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
      {payments.refreshError && (
        <p className="paylist-refresh-error" role="alert">
          <span>We could not refresh these payments. The list may be out of date.</span>
          <button type="button" onClick={payments.refresh}>
            Retry payments
          </button>
        </p>
      )}
      <section className="paylist-results" aria-label="Payment results">
        <h2
          id="paylist-results"
          tabIndex={-1}
          className="paylist-result-count"
          aria-live="polite"
        >
          {payments.loading
            ? "Checking payments…"
            : payments.error
              ? "Payments unavailable"
              : data
                ? `${data.items.length} payment${data.items.length === 1 ? "" : "s"} on this page`
                : "Checking payments…"}
        </h2>
        {payments.error && (
          <div className="paylist-list-state" role="alert">
            <CreditCard size={28} aria-hidden="true" />
            <h3>We couldn’t load your payments</h3>
            <p>{payments.error}</p>
            <button className="button secondary" onClick={payments.refresh}>
              Retry payments
            </button>
          </div>
        )}
        {payments.loading && (
          <div className="paylist-list-skeleton" aria-hidden="true">
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
          <div className="paylist-table">
            <table>
              <caption className="sr-only">Your payments on this page</caption>
              <thead>
                <tr>
                  <th scope="col">Payment</th>
                  <th scope="col">For</th>
                  <th scope="col">Status</th>
                  <th scope="col">Amount</th>
                  <th scope="col">
                    <span className="sr-only">Payment details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="paylist-identity">
                      <h3>{payment.paymentNumber}</h3>
                      <small>
                        {payment.createdAt
                          ? formatBusinessDate(payment.createdAt)
                          : "Date not provided"}
                      </small>
                    </td>
                    <td data-label="For" className="paylist-related">
                      <strong>{paymentPurpose(payment.purpose)}</strong>
                      <div className="paylist-related-links">
                        {[
                          { id: payment.orderId, path: "orders", label: "View order" },
                          {
                            id: payment.invoiceId,
                            path: "invoices",
                            label: "View invoice",
                          },
                          {
                            id: payment.bookingId,
                            path: "bookings",
                            label: "View booking",
                          },
                          {
                            id: payment.vehicleTransactionId,
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
                              aria-label={`${record.label} for ${payment.paymentNumber}`}
                            >
                              {record.label}
                            </Link>
                          ))}
                        {!payment.orderId &&
                          !payment.invoiceId &&
                          !payment.bookingId &&
                          !payment.vehicleTransactionId && (
                            <small>See payment details</small>
                          )}
                      </div>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`paylist-state ${["CANCELLED", "EXPIRED"].includes(payment.status) ? "closed" : ""}`}
                      >
                        {paymentLabels[payment.status]}
                      </span>
                      <small>{paymentStatusNotes[payment.status]}</small>
                    </td>
                    <td data-label="Amount">
                      <strong>{formatKobo(payment.amountKobo)}</strong>
                      <small>
                        {payment.status === "SUCCEEDED"
                          ? "Confirmed amount"
                          : "Requested amount"}
                      </small>
                    </td>
                    <td className="paylist-row-action">
                      <Link
                        href={`/dashboard/payments/${payment.id}`}
                        aria-label={`View payment: ${payment.paymentNumber}`}
                        prefetch={false}
                      >
                        View payment <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="paylist-list-state">
            <CreditCard size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No payments on this page"
                : status
                  ? "No payments with this status"
                  : "No payments yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Your payment requests will appear here when created."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset payment filters
              </button>
            ) : (
              <Link className="button secondary" href="/dashboard">
                Back to overview
              </Link>
            )}
          </div>
        )}
      </section>
      <nav className="paylist-pagination" aria-label="Payment pages">
        <button
          className="button secondary"
          disabled={!trail.length || payments.loading}
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
          disabled={!data?.nextCursor || payments.loading}
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
          <button className="paylist-reset" onClick={firstPage}>
            First page
          </button>
        )}
      </nav>
      <footer className="paylist-list-footer">
        <p>Dates shown in Lagos time.</p>
        <p>
          Need help with a payment? <Link href="/dashboard/support">Contact support</Link>
        </p>
      </footer>
    </div>
  );
}
