"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  invoiceQuery,
  invoicePageParams,
  invoiceSource,
  invoiceSourceLabels,
  invoiceStatusLabels,
  parseWorkInvoices,
  type WorkInvoice,
} from "@/lib/admin/work-invoices";
import {
  redactInvoiceChanges,
  forgetInvoiceDraft,
} from "@/lib/admin/work-invoice-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { InvoiceCreateForm } from "./invoice-create-form";
import { InvoiceFilters, type InvoiceFiltersValue } from "./invoice-filters";
export function StaffInvoices() {
  const session = useAccountSession();
  if (!session) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <InvoiceAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-inspections work-invoices">
      <h1>Invoices</h1>
      <Feedback message="Administrator access is required for finance." />
    </div>
  );
}
function InvoiceAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current administrator access could not be confirmed."
        : undefined);
  if (!p || error || access.loading)
    return (
      <div className="work-inspections work-invoices">
        <h1>Invoices</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking invoice access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh invoice access
        </button>
      </div>
    );
  return (
    <InvoiceWorkspace
      owner={owner}
      role={role}
      refreshAccess={access.refresh}
      accessBusy={access.loading || access.refreshing}
    />
  );
}
function InvoiceWorkspace({
  owner,
  role,
  refreshAccess,
  accessBusy,
}: {
  owner: string;
  role: string;
  refreshAccess: () => void;
  accessBusy: boolean;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = invoiceQuery(new URLSearchParams(search.toString()));
  const parse = useCallback(
    (v: unknown) => parseWorkInvoices(v, new URLSearchParams(query.path?.split("?")[1])),
    [query.path],
  );
  const records = useResource(query.path, parse),
    [unavailable, setUnavailable] = useState(false),
    [opened, setOpened] = useState(query.params.has("create"));
  const deny = useCallback(() => {
    redactInvoiceChanges();
    try {
      forgetInvoiceDraft(owner, role);
    } catch {
      /* A session change already clears account drafts. */
    }
    setUnavailable(true);
  }, [owner, role]);
  useEffect(() => {
    if (records.denied) {
      const timer = setTimeout(deny, 0);
      return () => clearTimeout(timer);
    }
  }, [records.denied, deny]);
  const blocked = unavailable || records.denied,
    busy = records.loading || records.refreshing || accessBusy,
    error = records.error || records.refreshError;
  const creating = query.params.has("create"),
    filtersOpen = query.params.has("filters"),
    rows = blocked ? undefined : records.data?.items;
  const filterValues: InvoiceFiltersValue = {
    invoiceNumber: query.params.get("invoiceNumber") ?? "",
    status: (query.params.get("status") ?? "") as InvoiceFiltersValue["status"],
    branchId: query.params.get("branchId") ?? "",
    customerId: query.params.get("customerId") ?? "",
    sourceType: (query.params.get("sourceType") ??
      "") as InvoiceFiltersValue["sourceType"],
    sourceId: query.params.get("sourceId") ?? "",
  };
  function navigate(p: URLSearchParams) {
    router.push(`/admin/invoices${p.size ? `?${p}` : ""}`, { scroll: false });
  }
  function toggle(key: "create" | "filters" | "expanded", value = "1") {
    const p = new URLSearchParams(query.params);
    if (p.get(key) === value) p.delete(key);
    else p.set(key, value);
    if (key === "create") setOpened(true);
    navigate(p);
  }
  function firstPage() {
    const p = new URLSearchParams(query.params);
    p.delete("cursor");
    p.delete("_trail");
    navigate(p);
  }
  function clear() {
    const p = new URLSearchParams();
    for (const k of ["create", "filters"]) if (query.params.has(k)) p.set(k, "1");
    navigate(p);
  }
  return (
    <div className="work-inspections work-invoices">
      <nav className="wi-breadcrumb" aria-label="Invoice breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Invoices</span>
          </li>
        </ol>
      </nav>
      <header className="wi-header">
        <div>
          <h1>Invoices</h1>
          <p>Invoice values and confirmed payments are separate records.</p>
        </div>
        <div className="iv-header-actions">
          <button
            className="button"
            disabled={blocked || query.invalid || !!error || busy}
            aria-expanded={blocked ? undefined : creating}
            aria-controls={
              !blocked && (opened || creating) ? "invoice-create-workspace" : undefined
            }
            onClick={() => toggle("create")}
          >
            {creating ? "Close invoice form" : "Create an invoice"}
          </button>
          <button
            className="button secondary"
            disabled={busy || blocked || query.invalid}
            onClick={records.refresh}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh invoices
          </button>
          <button className="text-link" disabled={accessBusy} onClick={refreshAccess}>
            Refresh invoice access
          </button>
        </div>
      </header>
      {blocked ? (
        <section className="panel iv-unavailable">
          <h2>Invoice access is unavailable</h2>
          <Feedback message="Protected invoice information has been cleared. Refresh your access before continuing." />
        </section>
      ) : (
        <>
          <InvoiceFilters
            key={JSON.stringify(filterValues)}
            value={filterValues}
            open={filtersOpen}
            onToggle={() => toggle("filters")}
            onDenied={deny}
            onClear={clear}
            disabled={busy}
            onApply={(values) => {
              const p = new URLSearchParams(query.params);
              for (const [k, v] of Object.entries(values)) {
                if (v) p.set(k, v);
                else p.delete(k);
              }
              for (const k of ["cursor", "_trail", "expanded"]) p.delete(k);
              navigate(p);
            }}
          />
          {(opened || creating) && (
            <div id="invoice-create-workspace" hidden={!creating}>
              <InvoiceCreateForm
                owner={owner}
                role={role}
                onSaved={records.refresh}
                onDenied={deny}
                disabled={busy || !!error || query.invalid}
              />
            </div>
          )}
          {query.invalid && (
            <section className="iv-notice">
              <Feedback message="This invoice link contains invalid or unsupported filters. Clear the filters to load records." />
              <button className="button secondary" onClick={clear}>
                Clear invalid invoice link
              </button>
            </section>
          )}
          <Feedback message={error} />
          {error && rows && (
            <p className="iv-notice">
              Previously loaded records are shown for reference. Refresh successfully
              before creating an invoice or changing pages.
            </p>
          )}
          <section
            className="iv-discovery"
            aria-labelledby="invoice-records-heading"
            aria-busy={busy}
          >
            <div className="iv-list-heading">
              <div>
                <h2 id="invoice-records-heading">Invoice records</h2>
                <p>
                  {rows
                    ? `${rows.length} ${rows.length === 1 ? "invoice" : "invoices"} on this page · Newest first`
                    : "Records load after access and filters are checked."}
                </p>
              </div>
              <span className="iv-currency">NGN · Nigerian naira</span>
            </div>
            {records.loading && !rows && (
              <div className="iv-loading panel" role="status">
                <FileText size={24} aria-hidden="true" />
                <p>Loading invoice records…</p>
                <div className="iv-skeleton" />
                <div className="iv-skeleton" />
              </div>
            )}
            {busy && rows && <p role="status">Checking invoice records…</p>}
            {rows && rows.length > 0 && (
              <div className="iv-records">
                <div className="iv-columns" aria-hidden="true">
                  <span>Invoice</span>
                  <span>Source & branch</span>
                  <span>Status</span>
                  <span>Invoice value</span>
                  <span>Due date</span>
                  <span>Review</span>
                </div>
                {rows.map((v) => (
                  <InvoiceRecord
                    key={v.id}
                    invoice={v}
                    expanded={query.params.get("expanded") === v.id}
                    onExpand={() => toggle("expanded", v.id)}
                  />
                ))}
              </div>
            )}
            {!busy && !error && rows?.length === 0 && (
              <div className="iv-empty panel">
                <FileText size={27} aria-hidden="true" />
                <h3>
                  {Object.values(filterValues).some(Boolean)
                    ? "No invoices match these filters"
                    : "No invoices on this page"}
                </h3>
                <p>
                  Try another invoice number, source or branch. Create a draft from an
                  eligible source when you are ready.
                </p>
                <button className="button secondary" onClick={clear}>
                  Clear invoice filters
                </button>
              </div>
            )}
            {error && !rows && (
              <section className="iv-empty panel">
                <h3>Invoice records could not be loaded</h3>
                <p>Check your connection, then refresh invoices.</p>
              </section>
            )}
          </section>
          <nav className="iv-pagination" aria-label="Invoices pagination">
            <span>{query.params.has("cursor") ? "Continuation page" : "First page"}</span>
            <div className="actions">
              {query.params.has("cursor") && (
                <button
                  className="button secondary"
                  disabled={busy || !!error || query.invalid}
                  onClick={firstPage}
                >
                  First page
                </button>
              )}
              <button
                className="button secondary"
                disabled={!query.params.has("_trail") || busy || !!error || query.invalid}
                onClick={() => navigate(invoicePageParams(query.params, undefined, true))}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={!records.data?.nextCursor || busy || !!error || query.invalid}
                onClick={() =>
                  navigate(invoicePageParams(query.params, records.data?.nextCursor))
                }
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
function InvoiceRecord({
  invoice: v,
  expanded,
  onExpand,
}: {
  invoice: WorkInvoice;
  expanded: boolean;
  onExpand: () => void;
}) {
  const source = invoiceSource(v);
  return (
    <article className="iv-record" aria-labelledby={`invoice-${v.id}`}>
      <div className="iv-record-primary">
        <div className="iv-invoice">
          <h3 id={`invoice-${v.id}`}>
            <Link href={`/admin/invoices/${v.id}`}>{v.invoiceNumber}</Link>
          </h3>
          <span>Created {formatBusinessDate(v.createdAt)}</span>
          <button
            className="text-link iv-detail-toggle"
            aria-expanded={expanded}
            aria-controls={expanded ? `invoice-details-${v.id}` : undefined}
            onClick={onExpand}
          >
            {expanded ? "Hide details" : "Details"}
          </button>
        </div>
        <div className="iv-source">
          <span className="iv-mobile-label">Source & branch</span>
          <strong>{invoiceSourceLabels[source.kind]}</strong>
          <span>{source.reference}</span>
          <span>{source.branch?.name ?? "Unassigned branch"}</span>
        </div>
        <div className="iv-status-cell">
          <span className="iv-mobile-label">Status</span>
          <span className={`iv-status iv-status-${v.status.toLowerCase()}`}>
            {invoiceStatusLabels[v.status]}
          </span>
        </div>
        <div className="iv-value">
          <span className="iv-mobile-label">Invoice value</span>
          <strong>{formatKobo(v.totalKobo)}</strong>
          <span>NGN</span>
        </div>
        <div className="iv-due">
          <span className="iv-mobile-label">Due date</span>
          <span>{v.dueAt ? formatBusinessDate(v.dueAt) : "Not set"}</span>
        </div>
        <Link
          className="text-link iv-view"
          href={`/admin/invoices/${v.id}`}
          aria-label={`View invoice ${v.invoiceNumber}`}
        >
          View invoice
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {expanded && (
        <div id={`invoice-details-${v.id}`} className="iv-details">
          <h4>Invoice details</h4>
          <dl className="iv-facts">
            <Fact label="Invoice reference" value={v.id} />
            <Fact label="Source reference" value={source.id} />
            <Fact
              label="Source status"
              value={
                (v.order ?? v.booking ?? v.vehicleTransaction)?.status ?? "Unavailable"
              }
            />
            <Fact label="Branch reference" value={source.branch?.id ?? "Unassigned"} />
            <Fact label="Branch code" value={source.branch?.code ?? "Unassigned"} />
            <Fact label="Version" value={String(v.version)} />
            <Fact label="Subtotal" value={formatKobo(v.subtotalKobo)} />
            <Fact label="Tax" value={formatKobo(v.taxKobo)} />
            <Fact label="Deposit credit" value={formatKobo(v.depositCreditKobo)} />
            <Fact label="Invoice total" value={formatKobo(v.totalKobo)} />
            {(
              [
                ["Created (Lagos)", v.createdAt],
                ["Updated (Lagos)", v.updatedAt],
                ["Issued (Lagos)", v.issuedAt],
                ["Due (Lagos)", v.dueAt],
                ["Paid (Lagos)", v.paidAt],
                ["Voided (Lagos)", v.voidedAt],
              ] as const
            ).map(([label, date]) => (
              <Fact
                key={label}
                label={label}
                value={date ? formatStockInstant(date) : "Not set"}
              />
            ))}
          </dl>
          <Link className="text-link" href={source.href}>
            View source record
          </Link>
          <h4>Linked payment records</h4>
          <p>These records do not represent a calculated remaining balance.</p>
          {v.payments.length ? (
            <ul className="iv-linked-payments">
              {v.payments.map((p) => (
                <li key={p.id}>
                  <strong>{p.paymentNumber}</strong>
                  <span>
                    {p.status} · {formatKobo(p.amountKobo)} · {p.currency}
                  </span>
                  <span>Payment reference: {p.id}</span>
                  <span>
                    Succeeded (Lagos):{" "}
                    {p.succeededAt ? formatStockInstant(p.succeededAt) : "Not recorded"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No linked payment records were returned.</p>
          )}
          <Link className="text-link" href="/admin/payments">
            Open payment records
          </Link>
        </div>
      )}
    </article>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
