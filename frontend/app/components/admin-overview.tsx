"use client";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { formatBusinessDate } from "@/lib/format/date";
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
export function AdminOverview() {
  const session = useAccountSession();
  const administrator = !!session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const operations = useResource(
    administrator ? "/admin/operations/status" : null,
    parseOperations,
  );

  return (
    <>
      <h1>Workshop operations</h1>
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
          <div className="metric-grid detail-section">
            <article className="metric">
              <h2>Open payment exceptions</h2>
              <strong>
                {operations.error
                  ? "Unavailable"
                  : (operations.data?.openPaymentAnomalies ?? "Loading…")}
              </strong>
              <p className="muted">All records currently OPEN or INVESTIGATING.</p>
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
            <article className="metric">
              <h2>Sales analytics</h2>
              <strong>Unavailable</strong>
              <p className="muted">
                A sales aggregation endpoint is not provided. Paid revenue and order-value
                totals are not inferred from result pages.
              </p>
            </article>
          </div>
          {operations.data && !operations.error && (
            <>
              <section className="detail-section">
                <h2>Processing queues</h2>
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
