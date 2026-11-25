"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { canManageStaff } from "@/lib/api/staff-admin-schemas";
import {
  directoryName,
  parseStaffDirectory,
  staffLabels,
} from "@/lib/admin/work-staff-directory";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { StaffAccessForm } from "./staff-access-form";
import { StaffCapabilities } from "./staff-capabilities";
import { WorkforceAccessPanel } from "./workforce-access-panel";
import { StaffChangeCoordinator } from "./staff-change-coordinator";
import "@/app/admin/staff/[staffUserId]/staff-account.css";

function StaffBreadcrumb({
  name = "Staff account",
  peopleView = false,
}: {
  name?: string;
  peopleView?: boolean;
}) {
  return (
    <nav className="wsad-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href="/admin">Overview</Link>
        </li>
        <li>
          <ChevronRight size={14} aria-hidden="true" />
          <Link
            href={peopleView ? "/admin/workforce/access" : "/admin/staff"}
            prefetch={false}
          >
            {peopleView ? "People" : "Staff directory"}
          </Link>
        </li>
        <li>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page" title={name}>
            {name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
export function StaffAccountDetail({
  id,
  peopleView = false,
}: {
  id: string;
  peopleView?: boolean;
}) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <div className="work-staff-account">
        <StaffBreadcrumb peopleView={peopleView} />
        <h1>Staff account</h1>
        <Feedback message="Administrator access is required to view these records." />
      </div>
    );
  return (
    <StaffAccountAccess
      key={`${session.user.id}:${session.user.role}:${id}`}
      id={id}
      owner={session.user.id}
      role={session.user.role}
      peopleView={peopleView}
    />
  );
}
function StaffAccountAccess({
  id,
  owner,
  role,
  peopleView,
}: {
  id: string;
  owner: string;
  role: string;
  peopleView: boolean;
}) {
  const access = useOwnStaffPermissions(),
    p = access.data;
  const error =
    access.error ||
    access.refreshError ||
    (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      ? "Current staff-account access could not be confirmed."
      : undefined);
  if (!p || error)
    return (
      <div className="work-staff-account">
        <StaffBreadcrumb peopleView={peopleView} />
        <h1>Staff account</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking staff account access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh staff access
        </button>
      </div>
    );
  return (
    <StaffAccountWorkspace
      id={id}
      owner={owner}
      role={role}
      peopleView={peopleView}
      accessRefreshing={access.loading || access.refreshing}
      refreshAccess={access.refresh}
    />
  );
}
function StaffAccountWorkspace({
  id,
  owner,
  role,
  peopleView,
  accessRefreshing,
  refreshAccess,
}: {
  id: string;
  owner: string;
  role: string;
  peopleView: boolean;
  accessRefreshing: boolean;
  refreshAccess: () => void;
}) {
  const parse = useCallback(
    (value: unknown) => {
      const member = parseStaffDirectory({ items: [value] }, new URLSearchParams())
        .items[0]!;
      if (member.id !== id) throw Error("Unexpected account response");
      return member;
    },
    [id],
  );
  const record = useResource(`/admin/staff/${id}`, parse);
  const [message, setMessage] = useState<string>();
  const member = record.data,
    name = member ? directoryName(member) : "Staff account";
  const error = record.error || record.refreshError,
    busy = record.loading || record.refreshing || accessRefreshing;
  return (
    <StaffChangeCoordinator
      owner={owner}
      role={role}
      member={member}
      disabled={busy || !!error}
      refresh={record.refresh}
    >
      {(change, recovery) => (
        <div className="work-staff-account">
          <StaffBreadcrumb name={name} peopleView={peopleView} />
          <header className="wsad-header">
            <div>
              <h1>Manage team member</h1>
              <p>Account, responsibilities and permissions in one place.</p>
            </div>
            <button
              className="button secondary"
              disabled={busy || change.reviewing}
              aria-label="Refresh staff account"
              onClick={() => {
                refreshAccess();
                record.refresh();
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh account
            </button>
          </header>
          <Feedback message={error} />
          <Feedback message={message} tone="success" toast="Account change recorded." />
          {recovery}
          {busy && <p role="status">Checking account details…</p>}
          {error && member && (
            <p className="notice">
              Previously loaded account details are shown. Refresh successfully before
              changing access.
            </p>
          )}
          {record.denied && (
            <p className="notice">
              Account access is unavailable. Protected records have been cleared.
            </p>
          )}
          {member && (
            <>
              <nav className="wsad-sections" aria-label="Team member sections">
                <a href="#staff-identity-title">Overview</a>
                <a href="#staff-manage-title">Account settings</a>
                <a href="#workforce-access-title">Responsibilities</a>
                <a href="#capabilities-title">Permissions</a>
              </nav>
              <section className="wsad-identity" aria-labelledby="staff-identity-title">
                <div>
                  <h2 id="staff-identity-title">{name}</h2>
                  {member.staffProfile?.jobTitle && <p>{member.staffProfile.jobTitle}</p>}
                  <p>{member.email}</p>
                  {member.id === owner && <span className="wsad-self">Your account</span>}
                </div>
                <dl>
                  <div>
                    <dt>Account role</dt>
                    <dd>{staffLabels[member.role]}</dd>
                  </div>
                  <div>
                    <dt>Account status</dt>
                    <dd>
                      <span
                        className={`wsad-status wsad-status-${member.status.toLowerCase()}`}
                        data-status={member.status}
                      >
                        {staffLabels[member.status]}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>
                      {member.staffProfile?.branch?.name ?? "Not assigned"}
                      {member.staffProfile?.branch &&
                        !member.staffProfile.branch.isActive && (
                          <small>Inactive branch</small>
                        )}
                    </dd>
                  </div>
                </dl>
              </section>
              <div className="wsad-main">
                <section className="wsad-facts" aria-labelledby="staff-facts-title">
                  <h2 id="staff-facts-title">Account information</h2>
                  <dl>
                    <div>
                      <dt>Phone</dt>
                      <dd>{member.staffProfile?.phone || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Email verified</dt>
                      <dd>
                        {member.emailVerifiedAt
                          ? formatBusinessDate(member.emailVerifiedAt)
                          : "Not verified"}
                      </dd>
                    </div>
                    <div>
                      <dt>Account created</dt>
                      <dd>{formatBusinessDate(member.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Account updated</dt>
                      <dd>{formatBusinessDate(member.updatedAt)}</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>Account reference</summary>
                    <p>{member.id}</p>
                    {!member.staffProfile && (
                      <p>No staff profile is recorded for this account.</p>
                    )}
                  </details>
                </section>
                <section className="wsad-manage" aria-labelledby="staff-manage-title">
                  <h2 id="staff-manage-title">Account settings</h2>
                  {canManageStaff({ id: owner, role }, member) ? (
                    <>
                      <p className="wsad-access-note">
                        Changes revoke this account’s existing sessions. Review the
                        person, scope and current state before confirming.
                      </p>
                      <StaffAccessForm
                        key={`access-${id}-${change.epoch}`}
                        member={member}
                        superAdmin={role === "SUPER_ADMIN"}
                        disabled={change.locked}
                        uncertain={change.pending}
                        onReview={(value) => {
                          setMessage(undefined);
                          change.review(value, "account", () =>
                            setMessage(
                              "Change recorded. The account’s existing sessions were revoked.",
                            ),
                          );
                        }}
                      />
                    </>
                  ) : (
                    <p className="notice">
                      Role, status and branch changes are unavailable for your own account
                      or a Super Admin account. Administrators can manage staff accounts
                      only.
                    </p>
                  )}
                </section>
              </div>
              {role === "SUPER_ADMIN" && !error && (
                <div className="wsad-secondary">
                  <WorkforceAccessPanel
                    key={`workforce-${member.id}-${change.epoch}`}
                    userId={member.id}
                  />
                  <StaffCapabilities
                    key={`${member.id}-${change.epoch}`}
                    member={member}
                    disabled={change.locked}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </StaffChangeCoordinator>
  );
}
