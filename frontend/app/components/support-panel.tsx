"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useResource } from "@/lib/api/use-resource";
import {
  enquiryTypes,
  parseSupportPage,
  priorities,
  supportStatuses,
  type SupportKind,
} from "@/lib/api/support-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { StaffPicker } from "./staff-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { SupportCreateForm } from "./support-create-form";
function SupportList({ kind, staff }: { kind: SupportKind; staff: boolean }) {
  const role = useAccountSession()?.user.role;
  const admin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    priority: "",
    branchId: "",
    assignedStaffId: "",
  });
  const [reset, setReset] = useState(0);
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "20" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const parse = useCallback(
    (value: unknown) => parseSupportPage(kind, staff, value),
    [kind, staff],
  );
  const records = useResource(
    `/${staff ? "staff" : "customers"}/support/${kind}?${query}`,
    parse,
  );
  function filter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    pagination.reset();
  }
  return (
    <section className="detail-section" aria-labelledby="support-list-heading">
      <h2 id="support-list-heading">{staff ? "Support queue" : "Your records"}</h2>
      {staff && (
        <p>
          Your role and branch determine which records the server returns. Reading this
          queue is recorded in the audit log.
        </p>
      )}
      <div className="catalogue-filters">
        <div className="field">
          <label htmlFor="support-status-filter">Record status</label>
          <select
            id="support-status-filter"
            value={filters.status}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {supportStatuses[kind].map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {staff && (
          <>
            <div className="field">
              <label htmlFor="support-kind-filter">
                {kind === "enquiries" ? "Enquiry type" : "Complaint priority"}
              </label>
              <select
                id="support-kind-filter"
                value={kind === "enquiries" ? filters.type : filters.priority}
                onChange={(event) =>
                  filter(kind === "enquiries" ? "type" : "priority", event.target.value)
                }
              >
                <option value="">All</option>
                {(kind === "enquiries" ? enquiryTypes : priorities).map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            {admin && (
              <div className="field">
                <label htmlFor="support-branch-filter">Branch filter</label>
                <AdminBranchPicker
                  key={reset}
                  id="support-branch-filter"
                  activeOnly={false}
                  value={filters.branchId}
                  onChange={(value) => {
                    setFilters((previous) => ({
                      ...previous,
                      branchId: value,
                      assignedStaffId: "",
                    }));
                    pagination.reset();
                  }}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="support-assignee-filter">Assigned staff filter</label>
              <StaffPicker
                key={`${filters.branchId}:${reset}`}
                id="support-assignee-filter"
                branchId={filters.branchId || null}
                onSelect={(value) => filter("assignedStaffId", value)}
              />
            </div>
          </>
        )}
      </div>
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={records.refresh}
        >
          Refresh support records
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setFilters({
              status: "",
              type: "",
              priority: "",
              branchId: "",
              assignedStaffId: "",
            });
            pagination.reset();
            setReset((value) => value + 1);
          }}
        >
          Clear support filters
        </button>
      </div>
      <Feedback message={records.error} />
      {records.loading && <p role="status">Checking support records…</p>}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p className="empty">
          {Object.values(filters).some(Boolean) || pagination.page > 1
            ? "No support records match this page and filters."
            : "No support records yet."}
        </p>
      )}
      {!records.error && (
        <div className="support-record-list">
          {records.data?.items.map((record) => (
            <article className="support-record" key={record.id}>
              <h3>
                <Link
                  href={`${staff ? "/admin" : "/dashboard"}/support/${kind}/${record.id}`}
                  className="text-link"
                >
                  {record.subject}
                </Link>
              </h3>
              <p>
                {record.status.toLowerCase().replaceAll("_", " ")} ·{" "}
                {record.branch?.name ?? "Unassigned branch"}
              </p>
              {record.kind === "complaints" && (
                <p>Priority: {record.priority.toLowerCase()}</p>
              )}
              <time dateTime={record.createdAt}>
                {formatBusinessDate(record.createdAt)}
              </time>
              {record.contact && <p>From {record.contact.name}</p>}
            </article>
          ))}
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Support records"
      />
    </section>
  );
}
export function SupportPanel({ staff = false }: { staff?: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<SupportKind>("enquiries");
  const [locked, setLocked] = useState<SupportKind[]>([]);
  return (
    <>
      <span className="eyebrow">Customer care</span>
      <h1>{staff ? "Support workspace" : "Your conversations"}</h1>
      <p>
        Track enquiries and complaints, read responses and continue the conversation. This
        does not indicate a live agent is available.
      </p>
      <div className="field">
        <label htmlFor="support-record-kind">Record category</label>
        <select
          id="support-record-kind"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value === "complaints" ? "complaints" : "enquiries")
          }
        >
          <option value="enquiries">Enquiries</option>
          <option value="complaints">Complaints</option>
        </select>
      </div>
      <SupportList key={kind} kind={kind} staff={staff} />
      {!staff && (
        <SupportCreateForm
          key={kind}
          kind={kind}
          locked={locked.includes(kind)}
          onUncertain={() => setLocked((values) => [...values, kind])}
          onSaved={(id) => router.push(`/dashboard/support/${kind}/${id}`)}
        />
      )}
    </>
  );
}
