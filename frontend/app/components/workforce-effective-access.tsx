import type {
  EffectiveWorkforceAccess,
  EffectiveWorkforceGrant,
  WorkforceAccessPreview,
} from "@/lib/api/workforce-effective-access";
import { formatBusinessDate } from "@/lib/format/date";
import { capabilityLabels } from "@/lib/api/capability-schemas";
import type { WorkforceAccount } from "@/lib/api/workforce-schemas";
import "./workforce-effective-access.css";

const taskGroups = [
  {
    label: "View",
    actions: [
      "BOOKINGS_READ",
      "ORDERS_READ",
      "CARE_CASE_VIEW",
      "FINANCE_READ",
      "JOBS_READ",
    ],
  },
  {
    label: "Prepare and edit",
    actions: [
      "ORDERS_PREPARE",
      "FITMENT_AUTHOR",
      "CUSTOMER_ENQUIRIES",
      "COMPLAINTS",
      "CARE_PUBLIC_REPLY",
      "CARE_LIVE_ACCEPT",
      "SALES_ENQUIRIES",
      "JOBS_UPDATE",
    ],
  },
  {
    label: "Independently review and approve",
    actions: ["FITMENT_REVIEW", "QUALITY_APPROVE"],
  },
  {
    label: "Coordinate work",
    actions: ["CARE_CASE_ASSIGN", "ENQUIRIES_ASSIGN", "JOBS_ASSIGN"],
  },
] as const;
function Grants({
  rows,
  assignments = [],
}: {
  rows: EffectiveWorkforceGrant[];
  assignments?: WorkforceAccount["assignments"];
}) {
  if (!rows.length) return <p>None.</p>;
  return (
    <ul className="wf-effective-grants">
      {rows.map((row) => (
        <li key={`${row.capability}:${row.branch.id}`}>
          <strong>{row.label}</strong>
          <p>
            {row.branch.name} ·{" "}
            {row.scope === "BRANCH" ? "Branch-wide work" : "Assigned work only"}
          </p>
          <p className="wf-effective-source">
            Why this access is available:{" "}
            {[...new Set(row.sources.map((s) => s.label))].join("; ")}.
          </p>
          {row.sources.some(
            (source) =>
              source.assignmentId &&
              assignments.some((assignment) => assignment.id === source.assignmentId),
          ) && (
            <ul className="wf-effective-periods">
              {row.sources.flatMap((source) => {
                const assignment = source.assignmentId
                  ? assignments.find((item) => item.id === source.assignmentId)
                  : undefined;
                return assignment
                  ? [
                      <li key={assignment.id}>
                        {assignment.temporary ? "Temporary cover" : "Job duty"}:{" "}
                        {source.label}. Starts {formatBusinessDate(assignment.startsAt)};{" "}
                        {assignment.expiresAt
                          ? `ends ${formatBusinessDate(assignment.expiresAt)}`
                          : "no end date recorded"}
                        .
                        {assignment.temporary &&
                          !assignment.expiresAt &&
                          " Review this existing open-ended cover."}
                      </li>,
                    ]
                  : [];
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
function Boundaries({ delegated }: { delegated: boolean }) {
  return (
    <p className="wf-effective-boundary">
      {delegated &&
        "Only allowed actions and branches within what you may manage are shown. Other access sources stay private. "}
      This is a partial access summary. It lists job duties; account-level permissions are
      not itemized here. Separately approved duties are shown only when your current
      access permits that check. Existing independent approval rules still apply.
    </p>
  );
}
export function WorkforceEffectiveAccess({
  value,
  assignments,
}: {
  value: EffectiveWorkforceAccess | undefined;
  assignments?: WorkforceAccount["assignments"];
}) {
  return (
    <section className="wf-effective" aria-label="What this person can access">
      <h3>What this person can access</h3>
      {!value ? (
        <p>Refresh responsibility access to check the current grant breakdown.</p>
      ) : (
        <>
          {value.baseline === "INACTIVE" && (
            <p className="notice">
              This account cannot use responsibility access while inactive or unverified.
              Recorded assignments remain in its history.
            </p>
          )}
          {value.baseline === "OWNER" && (
            <p>
              The protected owner baseline is separate from the responsibility grants
              below.
            </p>
          )}
          {value.baseline === "LEGACY" && (
            <p>
              This account retains its earlier access setup until an authorised enrollment
              review. No responsibility is inferred from its position.
            </p>
          )}
          <Boundaries delegated={value.visibility === "DELEGATED"} />
          <p>Checked {formatBusinessDate(value.evaluatedAt)}.</p>
          {value.independentCapabilities && (
            <details>
              <summary>
                Separately granted permissions ({value.independentCapabilities.length})
              </summary>
              <p>
                Supplied by explicit owner grants, separately from responsibility
                assignments. Record eligibility, MFA and independent review still apply.
                Removing a responsibility does not revoke these grants.
              </p>
              {value.independentCapabilities.length ? (
                <ul>
                  {value.independentCapabilities.map((capability) => (
                    <li key={capability}>{capabilityLabels[capability]}</li>
                  ))}
                </ul>
              ) : (
                <p>No active separately granted permissions.</p>
              )}
            </details>
          )}
          {value.grants.length ? (
            <details>
              <summary>
                Allowed actions and why they are available ({value.grants.length})
              </summary>
              {taskGroups.map((group) => {
                const rows = value.grants.filter((row) =>
                  group.actions.some((action) => action === row.capability),
                );
                return rows.length ? (
                  <section key={group.label} aria-label={group.label}>
                    <h4>{group.label}</h4>
                    <Grants rows={rows} assignments={assignments} />
                  </section>
                ) : null;
              })}
              {value.grants.some(
                (row) =>
                  !taskGroups.some((group) =>
                    group.actions.some((action) => action === row.capability),
                  ),
              ) && (
                <section aria-label="Other allowed work">
                  <h4>Other allowed work</h4>
                  <Grants
                    rows={value.grants.filter(
                      (row) =>
                        !taskGroups.some((group) =>
                          group.actions.some((action) => action === row.capability),
                        ),
                    )}
                    assignments={assignments}
                  />
                </section>
              )}
            </details>
          ) : (
            <p>No currently active responsibility grants.</p>
          )}
        </>
      )}
    </section>
  );
}
export function WorkforceAccessChange({ value }: { value: WorkforceAccessPreview }) {
  return (
    <section className="wf-effective" aria-label="Responsibility access change">
      <h3>What access changes</h3>
      <Boundaries delegated={value.visibility === "DELEGATED"} />
      {value.scheduled && (
        <p className="notice">
          Projected at the scheduled start: {formatBusinessDate(value.evaluatedAt)}. This
          assignment supplies no access before it starts. Later account or responsibility
          changes may alter that future access.
        </p>
      )}
      <h4>Access added ({value.added.length})</h4>
      <Grants rows={value.added} />
      <h4>Access removed ({value.removed.length})</h4>
      <Grants rows={value.removed} />
      <details>
        <summary>Access retained ({value.retained.length})</summary>
        <Grants rows={value.retained} />
      </details>
      <p>
        Revoking one grant keeps access supplied by another active grant. Branch-wide work
        and assigned work are shown separately when the scope changes.
      </p>
    </section>
  );
}
