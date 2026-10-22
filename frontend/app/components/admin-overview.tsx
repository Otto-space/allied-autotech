"use client";
import Link from "next/link";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseOperationsOverview } from "@/lib/api/operations-overview-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { RoleOverview } from "./role-overview";

const label = (value: string) => value.toLowerCase().replaceAll(/[_-]/g, " ");
function OperationsOverview() {
  const session = useAccountSession();
  const administrator = !!session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const operations = useResource(
    administrator ? "/admin/operations/status" : null,
    parseOperationsOverview,
  );
  const data = administrator && !operations.error ? operations.data : undefined;
  const busy = operations.loading || operations.refreshing;
  if (!administrator) return null;
  return (
    <div className="work-operations-body">
      <div className="work-operations-heading">
        <div>
          <h2>Workshop processing</h2>
          <p>Organisation-wide current status. Independent of activity dates.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={operations.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy ? "Checking operations…" : "Refresh operations"}
        </button>
      </div>
      <Feedback message={operations.error} />
      {busy && <p role="status">Checking operational status…</p>}
      {operations.refreshError && (
        <p className="work-stale" role="status">
          Operations may be out of date. Refresh operations to check current status.
        </p>
      )}
      {data && (
        <>
          <div className="work-operations-summary">
            <section aria-labelledby="work-exceptions-title">
              <h3 id="work-exceptions-title">Open payment exceptions</h3>
              <strong className="work-operation-value">
                {data.openPaymentAnomalies.toLocaleString("en-NG")}
              </strong>
              <p>All records currently OPEN or INVESTIGATING.</p>
              <Link className="text-link" href="/admin/payment-exceptions">
                Review exceptions
              </Link>
            </section>
            <section aria-labelledby="work-reconciliation-title">
              <h3 id="work-reconciliation-title">Latest reconciliation</h3>
              <strong className="work-operation-value work-status-label">
                {data.lastReconciliation
                  ? label(data.lastReconciliation.status)
                  : "No run recorded"}
              </strong>
              {data.lastReconciliation && (
                <>
                  <p>Started {formatBusinessDate(data.lastReconciliation.startedAt)}</p>
                  <p>
                    Recorded differences:{" "}
                    {data.lastReconciliation.differenceCount.toLocaleString("en-NG")}
                  </p>
                  <details>
                    <summary>Reconciliation period</summary>
                    <p>
                      {formatBusinessDate(data.lastReconciliation.periodStart)} –{" "}
                      {formatBusinessDate(data.lastReconciliation.periodEnd)}
                    </p>
                    <p>
                      {data.lastReconciliation.completedAt
                        ? `Completed ${formatBusinessDate(data.lastReconciliation.completedAt)}`
                        : "No completion is recorded."}
                    </p>
                  </details>
                </>
              )}
            </section>
          </div>
          <nav className="work-monitor-links" aria-label="Operations review">
            <Link className="text-link" href="/admin/processing-jobs">
              Review processing jobs
            </Link>
            <Link className="text-link" href="/admin/payment-disputes">
              Review disputes
            </Link>
            <Link className="text-link" href="/admin/refunds">
              Review refunds
            </Link>
          </nav>
          <section className="work-monitor-section" aria-labelledby="work-queues-title">
            <h3 id="work-queues-title">Processing queues</h3>
            <p>
              Complete server counts grouped by queue and current status. No date filter
              or comparison period; refresh manually or when returning to this tab.
            </p>
            {data.queues.length ? (
              <div
                className="work-table"
                role="region"
                aria-label="Queue status"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Queue</th>
                      <th>Status</th>
                      <th>Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queues.map((row) => (
                      <tr key={`${row.queue}-${row.status}`}>
                        <td data-label="Queue" className="work-status-label">
                          {label(row.queue)}
                        </td>
                        <td data-label="Status">
                          <span className="work-status-label" data-status={row.status}>
                            {label(row.status)}
                          </span>
                        </td>
                        <td data-label="Records">{row.count.toLocaleString("en-NG")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No queued records.</p>
            )}
          </section>
          <section className="work-monitor-section" aria-labelledby="work-workers-title">
            <h3 id="work-workers-title">Worker health</h3>
            <p>Server-reported heartbeat status does not certify provider delivery.</p>
            {data.workers === undefined ? (
              <p>Worker status was not supplied. Refresh operations to check again.</p>
            ) : data.workers.length === 0 ? (
              <p>No workers were reported.</p>
            ) : (
              <div
                className="work-table"
                role="region"
                aria-label="Worker health"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Last success (Lagos)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map((worker) => (
                      <tr key={worker.name}>
                        <td data-label="Worker" className="work-status-label">
                          {label(worker.name)}
                        </td>
                        <td data-label="Last success">
                          {worker.lastSucceededAt
                            ? formatBusinessDate(worker.lastSucceededAt)
                            : "Not recorded"}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`work-worker-status${worker.missing || worker.overdue ? " attention" : ""}`}
                          >
                            {worker.missing
                              ? "Not reported"
                              : worker.overdue
                                ? "Overdue"
                                : "Recent success"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="work-monitor-section" aria-labelledby="work-alerts-title">
            <h3 id="work-alerts-title">Open alerts</h3>
            <p>
              Oldest 100 unresolved alerts. This is a bounded preview, not an all-time
              total.
            </p>
            {data.operationalAlerts === undefined ? (
              <p>Alert status was not supplied. Refresh operations to check again.</p>
            ) : data.operationalAlerts.length === 0 ? (
              <p>No unresolved alerts were returned.</p>
            ) : (
              <ul className="work-alerts">
                {data.operationalAlerts.map((alert) => (
                  <li key={alert.id}>
                    <div>
                      <strong className="work-status-label">
                        {label(alert.category)}
                      </strong>
                      <time dateTime={alert.createdAt}>
                        {formatBusinessDate(alert.createdAt)}
                      </time>
                    </div>
                    <p>{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <section className="work-expiry" aria-labelledby="expiry-maintenance-title">
        <h3 id="expiry-maintenance-title">Overdue orders and reservations</h3>
        <p>
          Bulk expiry is unavailable in this workspace. A payment may still be processing
          or awaiting review, so a passed deadline alone is not enough to safely release
          stock or a reserved vehicle.
        </p>
        <div className="work-monitor-links">
          <Link className="text-link" href="/admin/orders">
            Review orders
          </Link>
          <Link className="text-link" href="/admin/vehicle-sales">
            Review vehicle purchases
          </Link>
        </div>
      </section>
    </div>
  );
}

export function AdminOverview() {
  const session = useAccountSession();
  const [open, setOpen] = useState(false);
  const administrator =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  return (
    <div className="work-dashboard">
      <RoleOverview workDesign />
      {administrator && (
        <details
          className="overview-operations"
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary>Processing queues &amp; payment monitoring</summary>
          {open && <OperationsOverview key={session.user.id} />}
        </details>
      )}
    </div>
  );
}
