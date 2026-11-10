import type {
  EffectiveWorkforceAccess,
  EffectiveWorkforceGrant,
  WorkforceAccessPreview,
} from "@/lib/api/workforce-effective-access";
import { formatBusinessDate } from "@/lib/format/date";
import { capabilityLabels } from "@/lib/api/capability-schemas";
import "./workforce-effective-access.css";

function Grants({ rows }: { rows: EffectiveWorkforceGrant[] }) {
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
}: {
  value: EffectiveWorkforceAccess | undefined;
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
              <Grants rows={value.grants} />
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
