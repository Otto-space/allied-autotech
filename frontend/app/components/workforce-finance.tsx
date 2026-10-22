"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  financeHref,
  paymentSourceLabels,
  workforcePaymentAmount,
  paymentPurposeLabels,
  paymentStatusLabels,
  parseScopedWorkforceFinance,
  workforceFinancePageParams,
  workforceFinanceQuery,
} from "@/lib/admin/workforce-finance";
import { formatBusinessDate } from "@/lib/format/date";
import { WorkforcePaymentDetail } from "./workforce-payment-detail";
import "./workforce-complaints.css";
import "./workforce-finance.css";

export function WorkforceFinance({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const query = workforceFinanceQuery(new URLSearchParams(search.toString()));
  const [revision, setRevision] = useState(0);
  const record = useResource(query.path, parseScopedWorkforceFinance);
  const busy = record.loading || record.refreshing;
  const failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const selected = query.params.get("selected");
  const filtered = ["q", "status", "purpose"].some((name) => query.params.has(name));
  const navigate = (params: URLSearchParams) =>
    router.push(financeHref(params), { scroll: false });
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
    if (!id && selected) document.getElementById(`wff-open-${selected}`)?.focus();
  }
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  return (
    <div className="workforce-complaints workforce-finance">
      <nav className="wfc-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Payment records</span>
          </li>
        </ol>
      </nav>
      <header className="wfc-heading">
        <div>
          <h1>Payment records</h1>
          <p>Review recorded payments within your permitted branches.</p>
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
        aria-label="Filter payments"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const name of ["q", "status", "purpose"]) {
            const v = String(values.get(name) ?? "").trim();
            if (v) params.set(name, v);
          }
          navigate(params);
          if (params.toString() === query.params.toString()) record.refresh();
        }}
      >
        <div className="field wfc-search">
          <label htmlFor="wfc-q">Search payments</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfc-q"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Payment, order or invoice reference"
              aria-describedby="wfc-search-hint"
            />
          </div>
        </div>
        {(
          [
            ["status", "Payment status", "All payment states", paymentStatusLabels],
            ["purpose", "Purpose", "All purposes", paymentPurposeLabels],
          ] as const
        ).map(([name, label, all, choices]) => (
          <div className="field" key={name}>
            <label htmlFor={`wff-${name}`}>{label}</label>
            <select
              id={`wff-${name}`}
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
        <p id="wfc-search-hint">Search covers all payments in your current scope.</p>
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
              ? "Payment filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Payment access unavailable"
                  : "Payments could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid payment filters. Clear filters to start again."
              : "Refresh payments to check your current access and records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfc-results"
        aria-labelledby="wfc-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfc-results-title">Payments</h2>
        </header>
        {busy && !query.invalid ? (
          <div className="wfc-state" role="status">
            Checking permitted payments…
            <div className="wfc-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Payments in your current responsibility scope
            </caption>
            <thead>
              <tr>
                <th scope="col">Payment</th>
                <th scope="col">Related record</th>
                <th scope="col">Branch</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className={row.id === selected ? "is-selected" : undefined}
                >
                  <th scope="row">
                    {row.paymentNumber}
                    <small>
                      <time dateTime={row.createdAt}>
                        {formatBusinessDate(row.createdAt)}
                      </time>
                    </small>
                  </th>
                  <td data-label="Related record">
                    {row.sources.map((source, i) => (
                      <span className="wff-source" key={i}>
                        {paymentSourceLabels[source.kind]}
                        <small>{source.reference}</small>
                      </span>
                    ))}
                  </td>
                  <td data-label="Branch">
                    {[
                      ...new Map(
                        row.sources.map((source) => [
                          source.branch.id,
                          source.branch.name,
                        ]),
                      ).values(),
                    ].join(" � ")}
                  </td>
                  <td data-label="Amount" className="wff-amount">
                    {workforcePaymentAmount(row.amountKobo, row.currency)}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`wfc-status is-${row.status.toLowerCase()}`}
                      data-status={row.status}
                    >
                      {paymentStatusLabels[row.status]}
                    </span>
                  </td>
                  <td data-label="Open">
                    <button
                      className="button secondary"
                      id={`wff-open-${row.id}`}
                      aria-label={`View payment: ${row.paymentNumber}`}
                      aria-pressed={row.id === selected}
                      onClick={() => select(row.id)}
                    >
                      View payment
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
                  ? "No payments match these filters"
                  : "No payments in your current scope"}
              </h3>
              <p>
                {filtered
                  ? "Adjust or clear filters to see other permitted payments."
                  : "Payments appear here when available within your responsibilities."}
              </p>
            </div>
          )
        )}
        {data && (
          <footer>
            <p role="status">
              {data.items.length} {data.items.length === 1 ? "payment" : "payments"} on
              this page
            </p>
            <nav aria-label="Payment pages">
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
                  navigate(workforceFinancePageParams(query.params, undefined, true))
                }
              >
                Previous page
              </button>
              <button
                className="button secondary"
                disabled={!data.nextCursor}
                onClick={() =>
                  navigate(workforceFinancePageParams(query.params, data.nextCursor))
                }
              >
                Next payments
              </button>
            </nav>
          </footer>
        )}
      </section>
      {selected && !query.invalid ? (
        <WorkforcePaymentDetail
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
            Select a payment to review its related records and recorded dates.
          </p>
        )
      )}
    </div>
  );
}
