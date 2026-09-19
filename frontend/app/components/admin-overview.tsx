"use client";
import { z } from "zod";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { formatBusinessDate } from "@/lib/format/date";
import { useState } from "react";
import { RoleOverview } from "./role-overview";
const parseOperations = (value: unknown) =>
  z
    .object({
      queues: z.array(
        z.object({
          queue: z.string(),
          status: z.string(),
          count: z.number().int().nonnegative(),
        }),
      ),
      openPaymentAnomalies: z.number().int().nonnegative(),
      lastReconciliation: z
        .object({
          status: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          differenceCount: z.number(),
          completedAt: z.string().nullable(),
          startedAt: z.string(),
        })
        .nullable(),
    })
    .parse(value);
function OperationsOverview() {
  const session = useAccountSession();
  const administrator = !!session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const operations = useResource(
    administrator ? "/admin/operations/status" : null,
    parseOperations,
  );

  return (
    <>
      <h2>Workshop processing</h2>
      <p className="lead">
        Monitor payment exceptions and the work waiting to be processed.
      </p>
      {!administrator ? (
        <p>
          Use your assigned operational screens to manage branch work. Organisation-wide
          monitoring requires administrator access.
        </p>
      ) : (
        <>
          <Feedback message={operations.error} />
          <button className="button secondary" onClick={operations.refresh}>
            Refresh operations
          </button>
          {operations.loading && <output>Checking operational status…</output>}
          <section className="detail-section" aria-labelledby="expiry-maintenance-title">
            <h2 id="expiry-maintenance-title">Overdue orders and reservations</h2>
            <p>
              Bulk expiry is unavailable in this workspace. A payment may still be
              processing or awaiting review, so a passed deadline alone is not enough to
              safely release stock or a reserved vehicle.
            </p>
            <div className="actions">
              <Link className="text-link" href="/admin/orders">
                Review orders
              </Link>
              <Link className="text-link" href="/admin/vehicle-sales">
                Review vehicle purchases
              </Link>
            </div>
          </section>
          <div className="metric-grid detail-section">
            <article className="metric">
              <h2>Open payment exceptions</h2>
              <strong>
                {operations.error
                  ? "Unavailable"
                  : (operations.data?.openPaymentAnomalies ?? "Loading…")}
              </strong>
              <p className="muted">All records currently OPEN or INVESTIGATING.</p>
              <Link className="text-link" href="/admin/payment-exceptions">
                Review exceptions
              </Link>
            </article>
            <article className="metric">
              <h2>Latest reconciliation</h2>
              <strong className="metric-status">
                {(() => {
                  if (operations.error) return "Unavailable";
                  if (!operations.data) return "Loading…";
                  return operations.data.lastReconciliation?.status ?? "No run recorded";
                })()}
              </strong>
              <p className="muted">
                {operations.data?.lastReconciliation
                  ? `Started ${formatBusinessDate(operations.data.lastReconciliation.startedAt)}`
                  : "No estimated status is shown."}
              </p>
            </article>
          </div>
          {operations.data && !operations.error && (
            <>
              <section className="detail-section">
                <h2>Processing queues</h2>
                <div className="actions">
                  <Link className="text-link" href="/admin/processing-jobs">
                    Review processing jobs
                  </Link>
                  <Link className="text-link" href="/admin/payment-disputes">
                    Review disputes
                  </Link>
                  <Link className="text-link" href="/admin/refunds">
                    Review refunds
                  </Link>
                </div>
                <p className="muted">
                  Complete server counts grouped by queue and current status. No date
                  filter or comparison period; refresh manually or when returning to this
                  tab.
                </p>
                <section className="table-region" aria-label="Queue status">
                  <table>
                    <thead>
                      <tr>
                        <th>Queue</th>
                        <th>Status</th>
                        <th>Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.data.queues.map((row) => (
                        <tr key={`${row.queue}-${row.status}`}>
                          <td>{row.queue.replaceAll("_", " ")}</td>
                          <td>{row.status.replaceAll("_", " ")}</td>
                          <td>{row.count.toLocaleString("en-NG")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                {operations.data.queues.length === 0 && <p>No queued records.</p>}
              </section>
              {operations.data.lastReconciliation && (
                <section className="detail-section">
                  <h2>Reconciliation period</h2>
                  <p>
                    {formatBusinessDate(operations.data.lastReconciliation.periodStart)} –{" "}
                    {formatBusinessDate(operations.data.lastReconciliation.periodEnd)}
                  </p>
                  <p>
                    Recorded differences:{" "}
                    {operations.data.lastReconciliation.differenceCount}
                  </p>
                </section>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

export function AdminOverview() {
  const session = useAccountSession();
  const [open, setOpen] = useState(false);
  const administrator =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  return (
    <>
      <RoleOverview />
      {administrator && (
        <details
          className="overview-operations"
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary>Processing queues & payment monitoring</summary>
          {open && <OperationsOverview />}
        </details>
      )}
    </>
  );
}
