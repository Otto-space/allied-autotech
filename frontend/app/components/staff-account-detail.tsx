"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  canManageStaff,
  parseStaffMember,
  staffName,
} from "@/lib/api/staff-admin-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { StaffAccessForm } from "./staff-access-form";
import { StaffCapabilities } from "./staff-capabilities";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffAccountDetail({ id }: { id: string }) {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const parse = useCallback(
    (value: unknown) => {
      const member = parseStaffMember(value);
      if (member.id !== id) throw new Error("Unexpected account response");
      return member;
    },
    [id],
  );
  const record = useResource(allowed ? `/admin/staff/${id}` : null, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  if (!allowed)
    return (
      <>
        <h1>Staff account</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  const member = record.data;
  return (
    <>
      <h1>Staff account</h1>
      <Link className="text-link" href="/admin/staff">
        Back to staff directory
      </Link>
      <Feedback message={record.error} />
      <Feedback message={message} tone="success" toast="Account change recorded." />
      <div className="actions">
        <button
          className="button secondary"
          disabled={record.loading || !!proposal}
          onClick={record.refresh}
        >
          Refresh staff account
        </button>
      </div>
      {record.loading && <p role="status">Checking account details…</p>}
      {member && (
        <section className="detail-section">
          <h2>{staffName(member)}</h2>
          <dl className="totals">
            <dt>Email</dt>
            <dd>{member.email}</dd>
            <dt>User reference</dt>
            <dd>{member.id}</dd>
            <dt>Role</dt>
            <dd>{member.role.replaceAll("_", " ")}</dd>
            <dt>Status</dt>
            <dd>{member.status}</dd>
            <dt>Branch</dt>
            <dd>
              {member.staffProfile?.branch?.name ?? "Not assigned"}
              {member.staffProfile?.branch && !member.staffProfile.branch.isActive
                ? " (inactive)"
                : ""}
            </dd>
            <dt>Phone</dt>
            <dd>{member.staffProfile?.phone ?? "Not recorded"}</dd>
            <dt>Job title</dt>
            <dd>{member.staffProfile?.jobTitle ?? "Not recorded"}</dd>
            <dt>Email verified</dt>
            <dd>
              {member.emailVerifiedAt
                ? formatBusinessDate(member.emailVerifiedAt)
                : "Not recorded"}
            </dd>
            <dt>Account created</dt>
            <dd>{formatBusinessDate(member.createdAt)}</dd>
            <dt>Account updated</dt>
            <dd>{formatBusinessDate(member.updatedAt)}</dd>
          </dl>
          {session && canManageStaff(session.user, member) ? (
            <>
              <h3>Manage access</h3>
              <p>
                Changes revoke this account’s existing sessions. Review the person, scope
                and current state before confirming.
              </p>
              <StaffAccessForm
                member={member}
                superAdmin={session.user.role === "SUPER_ADMIN"}
                disabled={record.loading || !!record.error || !!proposal}
                uncertain={uncertain}
                onReview={(value) => {
                  setMessage(undefined);
                  setProposal({ ...value, onUncertain: () => setUncertain(true) });
                }}
              />
            </>
          ) : (
            <p className="notice">
              Role, status and branch changes are unavailable for your own account or a
              Super Admin account. Administrators can manage staff accounts only.
            </p>
          )}
        </section>
      )}
      {member && session?.user.role === "SUPER_ADMIN" && (
        <StaffCapabilities
          key={member.id}
          member={member}
          disabled={record.loading || !!record.error || !!proposal}
        />
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() =>
            setMessage("Change recorded. The account’s existing sessions were revoked.")
          }
        />
      )}
    </>
  );
}
