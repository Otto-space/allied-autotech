"use client";
import { useState } from "react";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import { workshopResourceSettingsSchema } from "@/lib/admin/workshop-resource-settings";
import { resourceReviewFacts } from "@/lib/admin/workshop-resource-draft";
import { formatBusinessDate } from "@/lib/format/date";
import { useResourceNames } from "./workshop-resource-fields";
import { Feedback } from "./feedback";
function Facts({
  row,
  branch,
  onDenied,
}: {
  row: PolicyVersion;
  branch: string;
  onDenied: () => void;
}) {
  const parsed = workshopResourceSettingsSchema.safeParse(row.settings);
  return parsed.success ? (
    <NamedFacts plan={parsed.data} branch={branch} onDenied={onDenied} />
  ) : (
    <p>
      This historical version does not contain a complete current-format resource plan.
    </p>
  );
}
function NamedFacts({
  plan,
  branch,
  onDenied,
}: {
  plan: import("@/lib/admin/workshop-resource-settings").WorkshopResources;
  branch: string;
  onDenied: () => void;
}) {
  const names = useResourceNames(
    branch,
    plan.services.map((s) => s.serviceId),
    plan.technicians.map((t) => t.staffId),
    onDenied,
  );
  return (
    <>
      <Feedback message={names.error} />
      {names.loading && <p role="status">Loading recorded names…</p>}
      {names.error && (
        <button type="button" className="button secondary" onClick={names.refresh}>
          Retry recorded names
        </button>
      )}
      <dl className="resource-facts">
        {resourceReviewFacts(plan, names.labels).map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
export function ResourceVersion({
  row,
  branch,
  onDenied,
  initialOpen = false,
}: {
  row: PolicyVersion;
  branch: string;
  onDenied: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details
      className="resource-version"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        Version {row.version} · {row.approvalStatus.toLowerCase().replaceAll("_", " ")} ·{" "}
        {formatBusinessDate(row.effectiveAt)}
      </summary>
      {open && (
        <>
          <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
          <p>Approval source: {row.source}</p>
          <p>Written evidence: {row.approvalEvidence ?? "Not recorded"}</p>
          <Facts row={row} branch={branch} onDenied={onDenied} />
        </>
      )}
    </details>
  );
}
