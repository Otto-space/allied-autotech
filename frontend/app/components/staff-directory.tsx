"use client";
import { useState } from "react";
import Link from "next/link";
import {
  parseStaffMembers,
  privilegedRoles,
  staffStatuses,
  staffName,
} from "@/lib/api/staff-admin-schemas";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function StaffDirectory() {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [filters, setFilters] = useState({ role: "", status: "", branchId: "" });
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(
    allowed ? `/admin/staff?${query}` : null,
    parseStaffMembers,
  );
  if (!allowed)
    return (
      <>
        <h1>Staff directory</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <>
      <h1>Staff directory</h1>
      <p className="lead">
        Review staff and administrator accounts, branch assignments and account access.
      </p>
      <Link className="button" href="/admin/staff/invite">
        Promote staff & invite administrators
      </Link>
      <div className="catalogue-filters">
        {(
          [
            { name: "role", label: "Account role", options: privilegedRoles },
            { name: "status", label: "Account status", options: staffStatuses },
          ] as const
        ).map((field) => (
          <div className="field" key={field.name}>
            <label htmlFor={`staff-${field.name}`}>{field.label}</label>
            <select
              id={`staff-${field.name}`}
              value={filters[field.name]}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }));
                pagination.reset();
              }}
            >
              <option value="">All</option>
              {field.options.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="field">
          <label htmlFor="staff-branch">Branch</label>
          <AdminBranchPicker
            id="staff-branch"
            value={filters.branchId}
            activeOnly={false}
            onChange={(branchId) => {
              setFilters((current) => ({ ...current, branchId }));
              pagination.reset();
            }}
          />
        </div>
      </div>
      <Feedback message={records.error} />
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={records.refresh}
        >
          Refresh staff directory
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setFilters({ role: "", status: "", branchId: "" });
            pagination.reset();
          }}
        >
          Clear staff filters
        </button>
      </div>
      {records.loading && <p role="status">Checking staff accounts…</p>}
      {!records.loading && !records.error && !records.data?.items.length && (
        <div className="empty">
          <h2>No matching staff accounts</h2>
          <p>
            Clear the filters or refresh to check for updates. Invitations appear here
            after they are accepted.
          </p>
        </div>
      )}
      {records.data?.items.map((member) => (
        <section className="detail-section" key={member.id}>
          <h2>{staffName(member)}</h2>
          <p>{member.email}</p>
          <p>
            {member.role.replaceAll("_", " ")} · {member.status}
          </p>
          <p>
            {member.staffProfile?.branch?.name ?? "No branch assigned"}
            {member.staffProfile?.branch && !member.staffProfile.branch.isActive
              ? " (inactive)"
              : ""}
          </p>
          <Link className="text-link" href={`/admin/staff/${member.id}`}>
            View account for {staffName(member)}
          </Link>
        </section>
      ))}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Staff directory"
      />
    </>
  );
}
