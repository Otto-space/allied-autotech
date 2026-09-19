"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CarFront,
  ClipboardCheck,
  FileText,
  Package,
  RefreshCw,
  Wallet,
  Undo2,
} from "lucide-react";
import {
  overviewDates,
  overviewMoney,
  validOverviewDates,
  type Overview,
} from "@/lib/api/overview-schemas";
import { useOverview } from "@/lib/api/use-overview";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { OverviewActivity } from "./overview-activity";

const statusLabel = (value: string) => value.toLowerCase().replaceAll("_", " ");
function Status({ value }: { readonly value: string }) {
  return (
    <span
      className={`overview-status ${["COMPLETED", "CONFIRMED", "PAID"].includes(value) ? "positive" : ["CANCELLED", "EXPIRED", "NO_SHOW"].includes(value) ? "closed" : "pending"}`}
    >
      {statusLabel(value)}
    </span>
  );
}
function SummaryCards({
  data,
  base,
}: {
  readonly data: Overview;
  readonly base: string;
}) {
  const cards = [
    {
      label: "New bookings",
      value: data.counts.bookings.toLocaleString("en-NG"),
      note: "All booking statuses",
      href: `${base}/bookings`,
      icon: CalendarDays,
    },
    {
      label: "Parts orders",
      value: data.counts.orders.toLocaleString("en-NG"),
      note: "All order statuses",
      href: `${base}/orders`,
      icon: Package,
    },
    ...(data.finance
      ? [
          {
            label: "Payments collected",
            value: data.finance.payments.length
              ? data.finance.payments
                  .map((row) => overviewMoney(row.amountKobo, row.currency))
                  .join(" · ")
              : "—",
            note: data.finance.payments.length
              ? "Verified, settled payments"
              : "No settled payments in period",
            href: "/admin/payments",
            icon: Wallet,
          },
          {
            label: "Refunds completed",
            value: data.finance.refunds.length
              ? data.finance.refunds
                  .map((row) => overviewMoney(row.amountKobo, row.currency))
                  .join(" · ")
              : "—",
            note: data.finance.refunds.length
              ? "Successfully processed refunds"
              : "No completed refunds in period",
            href: "/admin/refunds",
            icon: Undo2,
          },
        ]
      : [
          {
            label: "Quotations issued",
            value: data.counts.quotations.toLocaleString("en-NG"),
            note: "Issued in this period",
            href: `${base}/bookings`,
            icon: FileText,
          },
          {
            label: data.scope === "CUSTOMER" ? "Vehicles added" : "Stock added",
            value: data.counts.vehicles.toLocaleString("en-NG"),
            note:
              data.scope === "CUSTOMER"
                ? "Added to your garage"
                : "Vehicle records added",
            href: `${base}/vehicles`,
            icon: CarFront,
          },
        ]),
    {
      label: "Inspection requests",
      value: data.counts.inspections.toLocaleString("en-NG"),
      note: "Requested in this period",
      href: `${base}/inspections`,
      icon: ClipboardCheck,
    },
  ];
  return (
    <div className="overview-metrics">
      {cards.map(({ icon: Icon, ...card }, index) => (
        <Link
          prefetch={false}
          className={`overview-metric tint-${index}`}
          key={card.label}
          href={card.href}
        >
          <div className="overview-metric-label">
            <span>{card.label}</span>
            <Icon size={18} aria-hidden="true" />
          </div>
          <strong className={card.value.length > 15 ? "overview-money" : undefined}>
            {card.value}
          </strong>
          <span className="overview-metric-note">
            {card.note}
            <ArrowUpRight size={15} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function RoleOverview() {
  const session = useAccountSession();
  const customer = session?.user.role === "CUSTOMER";
  const administrator =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const base = customer ? "/dashboard" : "/admin";
  const [range, setRange] = useState(() => overviewDates(30));
  const [draft, setDraft] = useState(range);
  const [dateError, setDateError] = useState<string | null>(null);
  const endDate = useRef<HTMLInputElement>(null);
  const path = session
    ? `/${customer ? "customers" : "staff"}/overview?from=${range.from}&to=${range.to}`
    : null;
  const resource = useOverview(path);
  const data = resource.data;
  const scopeMatches =
    data &&
    (customer
      ? data.scope === "CUSTOMER" && !data.finance
      : administrator
        ? data.scope === "ORGANISATION" && !!data.finance
        : data.scope === "BRANCH" && !data.finance);
  const error =
    resource.error ||
    (data && !scopeMatches
      ? "The overview could not be verified for your account. Please retry."
      : null);
  const visible = !error && scopeMatches ? data : undefined;
  return (
    <div className="overview">
      <div className="overview-welcome">
        <div>
          <h1>{customer ? "Your vehicle care, connected." : "Welcome back."}</h1>
          <p>
            {customer
              ? "Your bookings, orders and vehicle care at a glance."
              : data?.branch && !error
                ? `${data.branch.name} · Your branch at a glance.`
                : "Your workshop activity at a glance."}
          </p>
        </div>
        <div className="overview-top-actions">
          <label className="sr-only" htmlFor="overview-preset">
            Overview date preset
          </label>
          <select
            id="overview-preset"
            value=""
            onChange={(event) => {
              const next = overviewDates(Number(event.target.value));
              setRange(next);
              setDraft(next);
              setDateError(null);
            }}
          >
            <option value="" disabled>
              Select period
            </option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            className="button overview-refresh"
            type="button"
            disabled={resource.loading}
            onClick={resource.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {resource.loading ? "Updating…" : "Refresh"}
          </button>
        </div>
      </div>
      <form
        className="overview-range"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validOverviewDates(draft.from, draft.to)) {
            setDateError("Choose a valid range of 1 to 90 days, from 2000 onward.");
            endDate.current?.focus();
            return;
          }
          setDateError(null);
          setRange(draft);
        }}
      >
        <label>
          From
          <input
            type="date"
            min="2000-01-01"
            value={draft.from}
            aria-invalid={!!dateError}
            aria-describedby={dateError ? "overview-date-error" : undefined}
            required
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            min="2000-01-01"
            value={draft.to}
            ref={endDate}
            aria-invalid={!!dateError}
            aria-describedby={dateError ? "overview-date-error" : undefined}
            required
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <button type="submit" className="button secondary">
          Apply dates
        </button>
        <span>Inclusive dates · Africa/Lagos · Up to 90 days</span>
      </form>
      {dateError && (
        <p id="overview-date-error" role="alert" className="form-error">
          {dateError}
        </p>
      )}
      <div className="overview-update" role="status">
        {resource.loading
          ? visible
            ? "Refreshing your overview…"
            : "Loading your overview…"
          : error
            ? "Overview unavailable"
            : visible
              ? `Updated ${formatBusinessDate(visible.generatedAt)} · Refreshes every minute while visible`
              : ""}
      </div>
      {error && (
        <div className="overview-error" role="alert">
          <h2>We couldn’t load your overview</h2>
          <p>{error}</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry overview
          </button>
        </div>
      )}
      {!visible && !error && (
        <div className="overview-skeleton" aria-hidden="true">
          <div className="overview-metrics">
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className={`overview-metric tint-${key}`}>
                <span />
                <strong />
                <span />
              </div>
            ))}
          </div>
          <div className="overview-grid">
            <div className="overview-panel" />
            <div className="overview-panel" />
          </div>
        </div>
      )}
      {visible && (
        <>
          <SummaryCards data={visible} base={base} />
          <div className="overview-grid">
            <section className="overview-panel">
              <OverviewActivity
                key={`${range.from}:${range.to}`}
                rows={visible.activity}
              />
            </section>
            <section className="overview-panel overview-status-panel">
              <div className="overview-panel-heading">
                <div>
                  <h2>Booking progress</h2>
                  <p>Current status of bookings created in this period</p>
                </div>
              </div>
              {visible.bookingStatuses.length ? (
                <ul className="overview-status-list">
                  {visible.bookingStatuses.map((row) => (
                    <li key={row.status}>
                      <div>
                        <Status value={row.status} />
                        <strong>{row.count.toLocaleString("en-NG")}</strong>
                      </div>
                      <meter
                        min="0"
                        max={Math.max(1, visible.counts.bookings)}
                        value={row.count}
                        aria-label={`${statusLabel(row.status)} bookings`}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="overview-empty">No bookings in this period.</p>
              )}
              <Link className="text-link overview-panel-link" href={`${base}/bookings`}>
                View all bookings <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </section>
          </div>
          <div className="overview-grid">
            <section className="overview-panel overview-records">
              <div className="overview-panel-heading">
                <div>
                  <h2>Recent bookings</h2>
                  <p>Latest five created in the selected period</p>
                </div>
                <Link className="text-link" href={`${base}/bookings`}>
                  View all
                </Link>
              </div>
              {visible.recentBookings.length ? (
                <div
                  className="table-region"
                  role="region"
                  aria-label="Recent bookings"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Appointment (Lagos)</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Booking details</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.recentBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            <strong>{booking.serviceName}</strong>
                            <small>#{booking.id.slice(0, 8)}</small>
                          </td>
                          <td>
                            {formatBusinessDate(booking.scheduledAt).replace(
                              " (Lagos time)",
                              "",
                            )}
                          </td>
                          <td>
                            <Status value={booking.status} />
                          </td>
                          <td>
                            <Link
                              className="overview-record-link"
                              href={`${base}/bookings/${booking.id}`}
                              aria-label={`View booking ${booking.id.slice(0, 8)} for ${booking.serviceName}`}
                            >
                              <ArrowUpRight size={18} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="overview-empty">
                  Bookings will appear here when they fall within this period.
                </p>
              )}
            </section>
            <section className="overview-panel overview-orders">
              <div className="overview-panel-heading">
                <div>
                  <h2>Recent orders</h2>
                  <p>Latest four in this period</p>
                </div>
              </div>
              {visible.recentOrders.length ? (
                <ul>
                  {visible.recentOrders.map((order) => (
                    <li key={order.id}>
                      <Package size={21} aria-hidden="true" />
                      <div>
                        <Link href={`${base}/orders/${order.id}`}>
                          {order.orderNumber}
                        </Link>
                        <small>
                          {overviewMoney(order.totalKobo, order.currency)} · order value
                        </small>
                        <Status value={order.status} />
                      </div>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="overview-empty">No parts orders in this period.</p>
              )}
              <Link className="text-link overview-panel-link" href={`${base}/orders`}>
                View all orders <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </section>
          </div>
          <details className="overview-definitions">
            <summary>How these figures are calculated</summary>
            <p>
              Bookings, orders, inspections and vehicle additions use their creation date.
              Quotations use their issue date; unpublished drafts are excluded. Counts
              include all statuses in your permitted scope. Charts count records, and
              booking progress shows their current status. Recent lists are previews; the
              summary counts cover the entire selected period.
            </p>
            {administrator && (
              <p>
                Payments collected includes successful payment requests with a verified
                settled attempt, dated by successful settlement. Refunds completed
                includes successfully processed refunds, dated by completion. These
                amounts are shown separately for each currency and are not net revenue.
                Order value is not proof of payment.
              </p>
            )}
            <p>
              Dates run from midnight on the first date through the end of the last date
              in Africa/Lagos. Automatic refresh pauses while hidden or offline and slows
              after errors. Links open complete permitted record lists; their filters are
              independent of this overview.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
