"use client";
import "./care-workspace.css";
import Link from "next/link";
import { rememberCareQueue } from "./care-back-link";
import { enquiryLabel } from "@/lib/support/enquiry-label";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  enquiryTypes,
  priorities,
  supportStatuses,
  type SupportKind,
  type SupportRecord,
} from "@/lib/api/support-schemas";
import {
  parseWorkSupport,
  supportLabel,
  supportPageParams,
  workSupportQuery,
} from "@/lib/admin/work-support";
import { StatusBadge } from "./status-progress";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { StaffPicker } from "./staff-picker";
import { Feedback } from "./feedback";
import { SupportChannelWorkspace } from "./support-channel-workspace";

export function WorkSupport() {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <SupportAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff access is required to view support records." />
  );
}
function SupportAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p &&
      (p.id !== owner ||
        p.role !== role ||
        p.status !== "ACTIVE" ||
        (role === "STAFF" && !p.staffProfile?.branchId))
        ? "Current support access and branch assignment could not be confirmed."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-support">
        <h1>Customer care</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              onClick={access.refresh}
              disabled={access.loading || access.refreshing}
            >
              Retry support access
            </button>
          </>
        ) : (
          <p role="status">Checking support access…</p>
        )}
      </div>
    );
  return (
    <SupportWorkspace
      key={`${role}:${role === "STAFF" ? p.staffProfile?.branchId : "all"}`}
      role={role}
      branchId={role === "STAFF" ? p.staffProfile?.branchId : undefined}
    />
  );
}
function useSupportPage(
  path: string | null,
  kind: SupportKind,
  role: string,
  branchId?: string | null,
) {
  const parse = useCallback(
    (value: unknown) =>
      parseWorkSupport(
        value,
        kind,
        role,
        branchId,
        new URLSearchParams(path?.split("?")[1]),
      ),
    [path, kind, role, branchId],
  );
  return useResource(path, parse);
}
function SupportWorkspace({
  role,
  branchId,
}: {
  role: string;
  branchId?: string | null;
}) {
  const search = useSearchParams(),
    router = useRouter(),
    query = workSupportQuery(new URLSearchParams(search.toString()), role, branchId),
    records = useSupportPage(query.path, query.kind, role, branchId),
    data = records.data,
    error = records.error || records.refreshError,
    busy = records.loading || records.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(query.params);
  filters.delete("cursor");
  filters.delete("_trail");
  const navigate = (params: URLSearchParams) =>
    router.push(`/admin/support${params.size ? `?${params}` : ""}`, { scroll: false });
  return (
    <div className="work-inspections work-support">
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Customer care</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1 id="wsu-title" tabIndex={-1}>
            Customer care
          </h1>
          <p>
            Review enquiries and complaints, then open a conversation to continue handling
            it.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={records.refresh}
          disabled={busy || query.invalid}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh support records
        </button>
      </header>
      {!query.invalid && (
        <SupportChannelWorkspace
          kind={query.kind}
          branchId={filters.get("branchId") || branchId}
        />
      )}
      <div className="wsu-kinds" role="group" aria-label="Support category">
        {(["enquiries", "complaints"] as const).map((kind) => (
          <button
            className="button secondary"
            key={kind}
            aria-pressed={kind === query.kind}
            disabled={busy}
            onClick={() =>
              navigate(
                kind === "enquiries"
                  ? new URLSearchParams()
                  : new URLSearchParams({ kind }),
              )
            }
          >
            {kind === "enquiries" ? "Enquiries" : "Complaints"}
          </button>
        ))}
      </div>
      {query.invalid ? (
        <section className="wi-state">
          <h2>Support filters unavailable</h2>
          <p>This link contains invalid or unavailable support filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear support filters
          </button>
        </section>
      ) : (
        <>
          <SupportFilters
            key={filters.toString()}
            kind={query.kind}
            params={filters}
            role={role}
            branchId={branchId}
            busy={busy}
            navigate={navigate}
          />
          <div
            className="wsu-applied-filters"
            role="group"
            aria-label="Applied support filters"
          >
            {["q", "status", "type", "priority", "branchId", "assignedStaffId"]
              .filter((key) => filters.has(key))
              .map((key) => {
                const title =
                  key === "branchId"
                    ? "Branch filter"
                    : key === "assignedStaffId"
                      ? "Assigned staff filter"
                      : `${key === "type" ? "Type" : key === "priority" ? "Priority" : "Status"}: ${supportLabel(filters.get(key)!)}`;
                return (
                  <button
                    type="button"
                    className="button secondary"
                    key={key}
                    disabled={busy}
                    aria-label={`Remove ${title}`}
                    onClick={() => {
                      const next = new URLSearchParams(filters);
                      next.delete(key);
                      if (key === "branchId") next.delete("assignedStaffId");
                      navigate(next);
                      document
                        .getElementById("wsu-records")
                        ?.focus({ preventScroll: true });
                    }}
                  >
                    {title}
                    <X size={14} aria-hidden="true" />
                  </button>
                );
              })}
          </div>
          {role === "STAFF" && (
            <p className="wi-scope">Showing support records for your assigned branch.</p>
          )}
          <section aria-labelledby="wsu-records">
            <div className="wi-band">
              <h2 id="wsu-records" tabIndex={-1}>
                {query.kind === "enquiries" ? "Enquiry records" : "Complaint records"}
              </h2>
              {data && <span>{data.items.length} records on this page</span>}
            </div>
            {busy && (
              <p role="status" className="wi-state">
                {data ? "Refreshing support records…" : "Checking support records…"}
              </p>
            )}
            {error && (
              <div className="wi-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded support records are shown. Refresh before moving to another page."
                    : "Support records could not be loaded."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={records.refresh}
                >
                  Retry support records
                </button>
              </div>
            )}
            {!busy && !error && data && !data.items.length && (
              <div className="wi-state">
                <h3>
                  {["status", "type", "priority", "branchId", "assignedStaffId"].some(
                    (key) => filters.has(key),
                  )
                    ? "No support records match these filters"
                    : "No support records on this page"}
                </h3>
                <p>
                  {query.params.has("cursor")
                    ? "Return to the first page to check current records."
                    : "New enquiries and complaints will appear here."}
                </p>
              </div>
            )}
            <div
              className="care-table-region"
              role="region"
              aria-label="Customer care cases"
              tabIndex={0}
            >
              <table className="care-table">
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((record) => (
                    <SupportCard
                      key={record.id}
                      record={record}
                      returnParams={query.params.toString()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="wi-pagination" aria-label="Support records pages">
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("_trail")}
                onClick={() => navigate(supportPageParams(query.params, undefined, true))}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("cursor")}
                onClick={() => navigate(filters)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={blocked || !data?.nextCursor}
                onClick={() => {
                  navigate(supportPageParams(query.params, data?.nextCursor));
                  document.getElementById("wsu-title")?.focus({ preventScroll: true });
                }}
              >
                Next
              </button>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
function SupportFilters({
  kind,
  params,
  role,
  branchId,
  busy,
  navigate,
}: {
  kind: SupportKind;
  params: URLSearchParams;
  role: string;
  branchId?: string | null;
  busy: boolean;
  navigate: (p: URLSearchParams) => void;
}) {
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [searchError, setSearchError] = useState<string>();
  const [status, setStatus] = useState(params.get("status") ?? ""),
    [classification, setClassification] = useState(
      params.get(kind === "enquiries" ? "type" : "priority") ?? "",
    ),
    [branch, setBranch] = useState(params.get("branchId") ?? ""),
    [assignee, setAssignee] = useState(params.get("assignedStaffId") ?? ""),
    [pickerGeneration, setPickerGeneration] = useState(0);
  return (
    <form
      className="wi-filters wsu-filters"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (
          term.trim() &&
          (term.trim().length < 2 || /[\u0000-\u001f\u007f]/.test(term))
        ) {
          setSearchError("Enter at least 2 characters without control characters.");
          document.getElementById("care-search")?.focus();
          return;
        }
        setSearchError(undefined);
        const next = new URLSearchParams();
        if (kind !== "enquiries") next.set("kind", kind);
        if (term.trim()) next.set("q", term.trim());
        if (status) next.set("status", status);
        if (classification)
          next.set(kind === "enquiries" ? "type" : "priority", classification);
        if (role !== "STAFF" && branch) next.set("branchId", branch);
        if (assignee) next.set("assignedStaffId", assignee);
        navigate(next);
      }}
    >
      <fieldset disabled={busy}>
        <legend className="sr-only">Support filters</legend>
        <div className="wsu-filter-grid">
          <div className="field">
            <label htmlFor="care-search">Search cases</label>
            <input
              id="care-search"
              type="search"
              value={term}
              maxLength={120}
              minLength={2}
              onChange={(event) => {
                setTerm(event.target.value);
                setSearchError(undefined);
              }}
              aria-invalid={!!searchError}
              aria-describedby={
                searchError ? "care-search-hint care-search-error" : "care-search-hint"
              }
            />
            <p id="care-search-hint" className="field-hint">
              Subject or original request text. At least 2 characters.
            </p>
          </div>
          <div className="field">
            <label htmlFor="support-status-filter">Record status</label>
            <select
              id="support-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {supportStatuses[kind].map((v) => (
                <option key={v} value={v}>
                  {supportLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="support-kind-filter">
              {kind === "enquiries" ? "Enquiry type" : "Complaint priority"}
            </label>
            <select
              id="support-kind-filter"
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
            >
              <option value="">All</option>
              {(kind === "enquiries" ? enquiryTypes : priorities).map((v) => (
                <option key={v} value={v}>
                  {supportLabel(v)}
                </option>
              ))}
            </select>
          </div>
          {role !== "STAFF" && (
            <div className="field">
              <label htmlFor="support-branch-filter">Branch filter</label>
              <AdminBranchPicker
                id="support-branch-filter"
                value={branch}
                activeOnly={false}
                onChange={(value) => {
                  setBranch(value);
                  setAssignee("");
                  setPickerGeneration((v) => v + 1);
                }}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="support-assignee-filter">Assigned staff filter</label>
            <StaffPicker
              key={`${branch}:${pickerGeneration}`}
              id="support-assignee-filter"
              emptyLabel="All staff"
              required={false}
              initialId={assignee}
              branchId={role === "STAFF" ? (branchId ?? null) : branch || null}
              onSelect={setAssignee}
            />
            {assignee && (
              <p className="field-hint">Selected staff reference: {assignee}</p>
            )}
          </div>
        </div>
        <div className="wsu-filter-actions">
          <div id="care-search-error">
            <Feedback message={searchError} />
          </div>
          <button className="button">Apply support filters</button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setStatus("");
              setTerm("");
              setSearchError(undefined);
              setClassification("");
              setBranch("");
              setAssignee("");
              setPickerGeneration((v) => v + 1);
              navigate(
                kind === "enquiries"
                  ? new URLSearchParams()
                  : new URLSearchParams({ kind }),
              );
            }}
          >
            Clear support filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function SupportCard({
  record: r,
  returnParams,
}: {
  record: SupportRecord;
  returnParams: string;
}) {
  const session = useAccountSession();
  return (
    <tr className="wsu-record">
      <td>
        <strong>{r.subject}</strong>
      </td>
      <td>{r.contact?.name || "Contact not recorded"}</td>
      <td>
        {r.kind === "enquiries"
          ? enquiryLabel(r.type, r.vehicleEnquiryIntent)
          : "Complaint"}
      </td>
      <td>
        <StatusBadge status={r.status} />
      </td>
      <td>
        {r.assignedStaff
          ? r.assignedStaff.firstName + " " + r.assignedStaff.lastName
          : "Unassigned"}
      </td>
      <td>
        <time dateTime={r.updatedAt}>
          {new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Lagos",
          }).format(new Date(r.updatedAt))}
        </time>
      </td>
      <td>
        <Link
          className="text-link"
          href={"/admin/support/" + r.kind + "/" + r.id}
          onClick={() => {
            if (session) rememberCareQueue(session.user.id, r.id, r.kind, returnParams);
          }}
        >
          Open case <ChevronRight size={14} aria-hidden="true" />
          <span className="sr-only"> {r.subject}</span>
        </Link>
      </td>
    </tr>
  );
}
