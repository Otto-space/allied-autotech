"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { disputeCategories, disputeStatuses } from "@/lib/api/operations-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  disputeLabels,
  disputeOverviewQuery,
  disputeOverviewPageParams,
  parseDisputeOverviewPage,
  type OverviewDispute,
} from "@/lib/admin/work-payment-disputes";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { DisputeProviderFacts } from "./dispute-provider-facts";
const root = "/admin/payment-disputes";
export function PaymentDisputes() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return <Feedback message="Administrator access is required to view these records." />;
  return (
    <DisputeOverviewAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function DisputeOverviewAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current dispute overview access could not be confirmed."
        : undefined);
  if (!p || access.loading || error)
    return (
      <div className="work-disputes">
        <h1>Payment disputes</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking dispute overview access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh dispute access
        </button>
      </div>
    );
  return (
    <DisputeOverview
      canManage={p.capabilities.includes("DISPUTE_MANAGE")}
      refreshAccess={access.refresh}
    />
  );
}
function useDisputeOverview(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseDisputeOverviewPage(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function DisputeOverview({
  canManage,
  refreshAccess,
}: {
  canManage: boolean;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = disputeOverviewQuery(new URLSearchParams(search.toString())),
    params = query.params,
    records = useDisputeOverview(query.path),
    expanded = params.get("expanded"),
    error = records.error || records.refreshError;
  function navigate(next: URLSearchParams) {
    router.push(`${root}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function expand(id: string) {
    const next = new URLSearchParams(params);
    if (expanded === id) next.delete("expanded");
    else next.set("expanded", id);
    navigate(next);
  }
  return (
    <div className="work-disputes">
      <nav className="wd-breadcrumb" aria-label="Disputes breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Payment disputes</span>
      </nav>
      <header className="wd-heading">
        <div>
          <p className="wd-eyebrow">Finance / disputes</p>
          <h1>Payment disputes</h1>
          <p>Track recorded disputes, deadlines and provider observations.</p>
        </div>
        <div className="wd-heading-links">
          {canManage && !records.denied && (
            <Link className="text-link" href="/admin/payment-disputes/work">
              Open dispute work queue
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}
          <Link className="text-link" href="/admin/operations">
            Back to operations
          </Link>
        </div>
      </header>
      {records.denied ? (
        <section className="wd-state">
          <h2>Dispute overview access is unavailable</h2>
          <p>Protected records have been cleared.</p>
          <button className="button secondary" onClick={refreshAccess}>
            Refresh dispute access
          </button>
        </section>
      ) : query.invalid ? (
        <section className="wd-state">
          <Feedback message="This dispute view contains unsupported or invalid filters." />
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset dispute view
          </button>
        </section>
      ) : (
        <>
          <section className="wd-filters" aria-label="Dispute filters">
            {(
              [
                { name: "status", label: "Dispute status", options: disputeStatuses },
                {
                  name: "category",
                  label: "Dispute category",
                  options: disputeCategories,
                },
              ] as const
            ).map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={`dispute-${f.name}`}>{f.label}</label>
                <select
                  id={`dispute-${f.name}`}
                  value={params.get(f.name) ?? ""}
                  onChange={(e) => {
                    const next = new URLSearchParams(params);
                    if (e.target.value) next.set(f.name, e.target.value);
                    else next.delete(f.name);
                    next.delete("cursor");
                    next.delete("_trail");
                    navigate(next);
                  }}
                >
                  <option value="">
                    {f.name === "status" ? "All statuses" : "All categories"}
                  </option>
                  {f.options.map((v) => (
                    <option key={v} value={v}>
                      {disputeLabels[v]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="wd-filter-actions">
              <button
                className="button secondary"
                disabled={records.loading || records.refreshing}
                onClick={records.refresh}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Refresh payment disputes
              </button>
              <button
                className="text-link"
                onClick={() => navigate(new URLSearchParams())}
              >
                Clear filters
              </button>
            </div>
          </section>
          <p className="wd-scope">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              Disputed amounts and recorded evidence do not confirm provider acceptance or
              recovered funds.
            </span>
          </p>
          {error && (
            <section className="wd-state">
              <Feedback message={error} />
              {records.data && (
                <p>
                  Records below are from the previous successful load. Refresh to check
                  recent changes.
                </p>
              )}
              <button className="button secondary" onClick={records.refresh}>
                Retry dispute overview
              </button>
            </section>
          )}
          <section className="wd-records" aria-labelledby="dispute-records-title">
            <div className="wd-records-heading">
              <div>
                <h2 id="dispute-records-title">Recorded disputes</h2>
                <p>Live records · newest first</p>
              </div>
              <span>
                {records.data
                  ? `${records.data.items.length} on this page`
                  : "Current result set"}
              </span>
            </div>
            {records.loading ? (
              <p className="wd-empty" role="status">
                Loading payment disputes…
              </p>
            ) : !records.data ? null : !records.data.items.length ? (
              <div className="wd-empty">
                <ShieldCheck aria-hidden="true" />
                <h3>No matching disputes</h3>
                <p>Try another status or category, or refresh for recent observations.</p>
              </div>
            ) : (
              <>
                {expanded && !records.data.items.some((v) => v.id === expanded) && (
                  <p className="wd-outside">
                    The expanded reference is outside this result page. Change filters or
                    page to inspect its loaded record.
                  </p>
                )}
                <div className="wd-column-labels" aria-hidden="true">
                  <span>Provider / reference</span>
                  <span>Disputed amount</span>
                  <span>Confirmed chargeback</span>
                  <span>Response deadline</span>
                  <span>Evidence / details</span>
                </div>
                <ol className="wd-list">
                  {records.data.items.map((row) => (
                    <DisputeOverviewRecord
                      key={row.id}
                      row={row}
                      expanded={expanded === row.id}
                      onToggle={() => expand(row.id)}
                    />
                  ))}
                </ol>
              </>
            )}
            <nav className="wd-pagination" aria-label="Payment disputes pages">
              <span>Cursor pages · refresh for recent changes</span>
              <div>
                <button
                  className="button secondary"
                  disabled={records.loading || !!error || !params.has("cursor")}
                  onClick={() =>
                    navigate(disputeOverviewPageParams(params, undefined, true))
                  }
                >
                  Previous
                </button>
                <button
                  className="button secondary"
                  disabled={records.loading || !!error || !records.data?.nextCursor}
                  onClick={() =>
                    navigate(disputeOverviewPageParams(params, records.data?.nextCursor))
                  }
                >
                  Next
                </button>
              </div>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
function DisputeOverviewRecord({
  row,
  expanded,
  onToggle,
}: {
  row: OverviewDispute;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={`wd-record${expanded ? " is-expanded" : ""}`}>
      <article aria-labelledby={`dispute-title-${row.id}`}>
        <div className="wd-record-summary">
          <div className="wd-identity">
            <h3 id={`dispute-title-${row.id}`}>
              {row.provider === "PAYSTACK"
                ? "Paystack"
                : row.provider === "MONNIFY"
                  ? "Monnify"
                  : "Manual"}
            </h3>
            <p className="wd-provider-ref">{row.providerDisputeId}</p>
            <span
              className={`wd-badge wd-badge-${row.status.toLowerCase()}`}
              data-status={row.status}
            >
              {disputeLabels[row.status]}
            </span>
            <p className="wd-category">{disputeLabels[row.category]}</p>
          </div>
          <dl className="wd-money">
            <dt>Disputed amount</dt>
            <dd>
              <DisputeMoney value={row.amountKobo} />
            </dd>
          </dl>
          <dl className="wd-chargeback">
            <dt>Confirmed chargeback</dt>
            <dd>
              {row.chargebackAmountKobo === null ? (
                <span className="wd-not-recorded">Not confirmed</span>
              ) : (
                <DisputeMoney value={row.chargebackAmountKobo} />
              )}
            </dd>
          </dl>
          <dl className="wd-deadline">
            <dt>Response deadline</dt>
            <dd>
              {row.responseDueAt ? (
                <time dateTime={row.responseDueAt}>
                  {formatBusinessDate(row.responseDueAt)}
                </time>
              ) : (
                <span className="wd-not-recorded">Not recorded</span>
              )}
            </dd>
          </dl>
          <div className="wd-evidence">
            <span className="wd-fact-label">Evidence</span>
            <p>{row.hasEvidence ? "Recorded" : "Not recorded"}</p>
            <button
              className="text-link"
              aria-expanded={expanded}
              aria-controls={`dispute-facts-${row.id}`}
              onClick={onToggle}
            >
              {expanded ? "Hide record details" : "Show record details"}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <section
          id={`dispute-facts-${row.id}`}
          className="wd-details"
          hidden={!expanded}
          aria-label={`Record details for ${row.providerDisputeId}`}
        >
          <h4>Recorded source and provider facts</h4>
          <dl className="wd-facts">
            <DisputeProviderFacts dispute={row} />
            <dt>Provider observation updated</dt>
            <dd>
              {row.providerUpdatedAt
                ? formatStockInstant(row.providerUpdatedAt)
                : "Not recorded"}
            </dd>
            <dt>Dispute reference</dt>
            <dd>{row.id}</dd>
            <dt>Payment attempt reference</dt>
            <dd>{row.paymentAttemptId}</dd>
            <dt>Opened</dt>
            <dd>{formatStockInstant(row.openedAt)}</dd>
            <dt>Response deadline</dt>
            <dd>
              {row.responseDueAt ? formatStockInstant(row.responseDueAt) : "Not recorded"}
            </dd>
            <dt>Response recorded</dt>
            <dd>
              {row.respondedAt ? formatStockInstant(row.respondedAt) : "Not recorded"}
            </dd>
            <dt>Resolution recorded</dt>
            <dd>
              {row.resolvedAt ? formatStockInstant(row.resolvedAt) : "Not recorded"}
            </dd>
            <dt>Last updated</dt>
            <dd>{formatStockInstant(row.updatedAt)}</dd>
          </dl>
          <p>
            Evidence availability describes this application’s record. Submission and
            provider acceptance must be checked separately.
          </p>
        </section>
      </article>
    </li>
  );
}
function DisputeMoney({ value }: { value: string }) {
  return (
    <span className="wd-amount">
      <span>NGN</span>
      <strong>{formatKobo(value).replace("₦", "")}</strong>
    </span>
  );
}
