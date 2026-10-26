import type {
  EffectiveWorkforceAccess,
  EffectiveWorkforceGrant,
  WorkforceAccessPreview,
} from "@/lib/api/workforce-effective-access";
import { formatBusinessDate } from "@/lib/format/date";
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
            Supplied by: {[...new Set(row.sources.map((s) => s.label))].join("; ")}.
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
        "Only capabilities and branches within your management envelope are shown. Other grant sources stay private. "}
      This breakdown covers responsibility grants. Account baseline and separately granted
      permissions keep their existing rules. Independent approval is still required where
      applicable.
    </p>
  );
}
export function WorkforceEffectiveAccess({
  value,
}: {
  value: EffectiveWorkforceAccess | undefined;
}) {
  return (
    <section className="wf-effective" aria-label="Effective responsibility access">
      <h3>Effective responsibility access</h3>
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
              This account retains its existing legacy access until an authorised
              enrollment review. No responsibility is inferred from its position.
            </p>
          )}
          <Boundaries delegated={value.visibility === "DELEGATED"} />
          <p>Checked {formatBusinessDate(value.evaluatedAt)}.</p>
          {value.grants.length ? (
            <details>
              <summary>Capabilities and grant sources ({value.grants.length})</summary>
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
