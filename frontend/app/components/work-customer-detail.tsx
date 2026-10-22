"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, ArrowLeft } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  customerActivityAmount,
  customerActivityHref,
  customerActivityPageParams,
  customerActivityQuery,
  customerCollectionLabels,
  customerCollections,
  parseCustomerActivity,
  parseWorkCustomerDetail,
  type CustomerActivity,
  type CustomerCollection,
} from "@/lib/admin/work-customer-detail";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
export function WorkCustomerDetail({ customerId }: { customerId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <CustomerDetailAccess
      key={`${session.user.id}:${session.user.role}:${customerId}`}
      id={customerId}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-inspections work-customer-detail">
      <h1>Customer details</h1>
      <Feedback message="Administrator access is required to view customers." />
    </div>
  );
}
function CustomerDetailAccess({
  id,
  owner,
  role,
}: {
  id: string;
  owner: string;
  role: string;
}) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current customer access could not be confirmed."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-customer-detail">
        <h1>Customer details</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={access.loading || access.refreshing}
              onClick={access.refresh}
            >
              Retry customer access
            </button>
          </>
        ) : (
          <p role="status">Checking customer access…</p>
        )}
      </div>
    );
  return <CustomerDetailWorkspace id={id} />;
}
function CustomerDetailWorkspace({ id }: { id: string }) {
  const parse = useCallback((value: unknown) => parseWorkCustomerDetail(value, id), [id]),
    detail = useResource(`/admin/customers/${id}`, parse),
    r = detail.data,
    error = detail.error || detail.refreshError,
    busy = detail.loading || detail.refreshing;
  const name = r
    ? `${r.firstName} ${r.lastName}`.trim() || "Unnamed customer"
    : "Customer details";
  return (
    <div className="work-inspections work-customers work-customer-detail">
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link href="/admin/customers">Customers</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{name}</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1>{name}</h1>
          {r && (
            <span className="status" data-status={r.status}>
              {
                { ACTIVE: "Active", SUSPENDED: "Suspended", DEACTIVATED: "Deactivated" }[
                  r.status
                ]
              }
            </span>
          )}
        </div>
        <div className="wcd-actions">
          <button className="button secondary" disabled={busy} onClick={detail.refresh}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh customer
          </button>
          <Link className="button secondary" href="/admin/customers">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to customers
          </Link>
        </div>
      </header>
      {busy && (
        <p role="status" className="wi-state">
          {r ? "Refreshing customer details…" : "Loading customer details…"}
        </p>
      )}
      {error && (
        <section className="wi-state">
          <Feedback message={error} />
          <p>
            {r
              ? "Previously loaded customer facts are shown. Refresh before loading activity."
              : "This customer could not be loaded under your current access."}
          </p>
          <button className="button secondary" disabled={busy} onClick={detail.refresh}>
            Retry customer details
          </button>
        </section>
      )}
      {r && (
        <>
          <div className="wcd-overview">
            <section className="wi-card">
              <h2>Contact and account</h2>
              <dl className="wcd-facts">
                {[
                  ["Customer ID", r.id],
                  ["Full name", name],
                  ["Email", r.email],
                  ["Phone", r.phone],
                  ["Email verification", r.emailVerified ? "Verified" : "Not verified"],
                  ["Phone verification", r.phoneVerified ? "Verified" : "Not verified"],
                  ["Registered", formatStockInstant(r.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="wi-card">
              <h2>Address</h2>
              <dl className="wcd-facts">
                {[
                  ["Street", r.address],
                  ["City", r.city],
                  ["State", r.state],
                  ["Country", r.country],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <CustomerActivityWorkspace id={id} disabled={busy || !!error} />
        </>
      )}
    </div>
  );
}
function useActivityPage(path: string | null, cursor?: string | null) {
  const parse = useCallback(
    (value: unknown) => parseCustomerActivity(value, cursor),
    [cursor],
  );
  return useResource(path, parse);
}
function CustomerActivityWorkspace({ id, disabled }: { id: string; disabled: boolean }) {
  const search = useSearchParams(),
    router = useRouter(),
    query = customerActivityQuery(new URLSearchParams(search.toString()), id),
    records = useActivityPage(disabled ? null : query.path, query.params.get("cursor")),
    data = records.data,
    error = records.error || records.refreshError,
    busy = records.loading || records.refreshing,
    blocked = disabled || busy || !!error || !data;
  const navigate = (params: URLSearchParams) =>
      router.push(`/admin/customers/${id}${params.size ? `?${params}` : ""}`, {
        scroll: false,
      }),
    base = new URLSearchParams(query.params);
  base.delete("cursor");
  base.delete("_trail");
  return (
    <section aria-labelledby="wcd-activity">
      <div className="wi-band">
        <h2 id="wcd-activity">Customer activity</h2>
        {data && <span>{data.items.length} records on this page</span>}
        <button
          className="button secondary"
          disabled={disabled || busy || query.invalid}
          onClick={records.refresh}
        >
          Refresh activity
        </button>
      </div>
      <div className="wcd-collections" role="group" aria-label="Customer activity">
        {customerCollections.map((kind) => (
          <button
            className="button secondary"
            key={kind}
            disabled={disabled || busy}
            aria-pressed={kind === query.collection}
            onClick={() =>
              navigate(
                kind === "vehicles"
                  ? new URLSearchParams()
                  : new URLSearchParams({ collection: kind }),
              )
            }
          >
            {customerCollectionLabels[kind]}
          </button>
        ))}
      </div>
      {query.invalid ? (
        <div className="wi-state">
          <h3>Activity filters unavailable</h3>
          <p>This link contains invalid customer activity filters.</p>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset activity filters
          </button>
        </div>
      ) : (
        <>
          {disabled && (
            <p className="wi-state">Refresh customer details before loading activity.</p>
          )}
          {busy && (
            <p className="wi-state" role="status">
              {data ? "Refreshing activity…" : "Loading activity…"}
            </p>
          )}
          {error && (
            <div className="wi-state">
              <Feedback message={error} />
              <p>
                {data
                  ? "Previously loaded activity is shown. Refresh before moving to another page."
                  : "This activity could not be loaded under your current access."}
              </p>
              <button
                className="button secondary"
                disabled={busy || disabled}
                onClick={records.refresh}
              >
                Retry activity
              </button>
            </div>
          )}
          {!busy && !error && !disabled && data && !data.items.length && (
            <div className="wi-state">
              <h3>No {query.collection} on this page</h3>
              <p>Customer records will appear here when available.</p>
            </div>
          )}
          <div className="wcd-records">
            {data?.items.map((record) => (
              <ActivityRecord key={record.id} record={record} kind={query.collection} />
            ))}
          </div>
          <nav className="wi-pagination" aria-label="Customer activity pages">
            <button
              className="button secondary"
              disabled={blocked || !query.params.has("_trail")}
              onClick={() =>
                navigate(customerActivityPageParams(query.params, undefined, true))
              }
            >
              Previous
            </button>
            <button
              className="button secondary"
              disabled={blocked || !query.params.has("cursor")}
              onClick={() => navigate(base)}
            >
              First page
            </button>
            <button
              className="button secondary"
              disabled={blocked || !data?.nextCursor}
              onClick={() =>
                navigate(customerActivityPageParams(query.params, data?.nextCursor))
              }
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
function ActivityRecord({
  record: r,
  kind,
}: {
  record: CustomerActivity;
  kind: CustomerCollection;
}) {
  const href = customerActivityHref(kind, r.id);
  return (
    <article className="wcd-record" aria-labelledby={`activity-${r.id}`}>
      <div>
        <h3 id={`activity-${r.id}`}>
          {href ? (
            <Link className="text-link" href={href}>
              {r.title || "Untitled record"}
            </Link>
          ) : (
            r.title || "Untitled record"
          )}
        </h3>
        <p className="wc-reference">Reference: {r.id}</p>
      </div>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{r.status?.replaceAll("_", " ") || "Not applicable"}</dd>
        </div>
      </dl>
      <dl>
        <div>
          <dt>Recorded amount</dt>
          <dd>{customerActivityAmount(r)}</dd>
        </div>
      </dl>
      <dl>
        <div>
          <dt>Created</dt>
          <dd>{formatStockInstant(r.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}
