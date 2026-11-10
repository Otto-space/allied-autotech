import type { WorkforceAccount } from "@/lib/api/workforce-schemas";
import { workforcePositionLabels } from "@/lib/api/workforce-positions";
import "./workforce-person-header.css";

export function WorkforcePersonHeader({
  account,
  unavailable = false,
}: {
  account?: WorkforceAccount;
  unavailable?: boolean;
}) {
  const identity = account?.identity;
  const position = account?.access?.position;
  return (
    <header className="wf-person-header">
      <p>Team &amp; Access / Person</p>
      <h1>{account?.accountLabel ?? "Person"}</h1>
      {account ? (
        <>
          <dl>
            <div>
              <dt>Account level</dt>
              <dd>
                {identity
                  ? { STAFF: "Staff", ADMIN: "Admin", SUPER_ADMIN: "Super Admin" }[
                      identity.role
                    ]
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Job position</dt>
              <dd>
                {position
                  ? (workforcePositionLabels[
                      position as keyof typeof workforcePositionLabels
                    ] ?? "Position needs review")
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Account branch</dt>
              <dd>
                {identity
                  ? identity.accountBranch
                    ? `${identity.accountBranch.name}${identity.accountBranch.isActive ? "" : " (inactive)"}`
                    : "No account branch assigned"
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>
                {identity
                  ? {
                      ACTIVE: "Active",
                      SUSPENDED: "Suspended",
                      DEACTIVATED: "Deactivated",
                    }[identity.status]
                  : "Unavailable"}
                {identity && !identity.verified && " · Email not verified"}
              </dd>
            </div>
          </dl>
          {!identity && (
            <p className="notice">
              Account details are unavailable from this response. Refresh before relying
              on this person&apos;s account level, branch or status.
            </p>
          )}
          <p>
            The account level, job position and allowed duties are separate. A job title
            does not grant access.
          </p>
        </>
      ) : (
        <p role="status">
          {unavailable
            ? "Person details are unavailable. Refresh to check current identity and access."
            : "Checking this person's current identity and access…"}
        </p>
      )}
    </header>
  );
}
