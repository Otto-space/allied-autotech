"use client";
import { useCallback, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  operationalPolicyInputSchema,
  operationalPolicySchemas,
  type OperationalPolicyKind,
} from "@/lib/api/operational-policy-schemas";
import {
  parsePolicyHistory,
  policyVersionSchema,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import {
  OperationalPolicyFields,
  operationalFacts,
  operationalFormSettings,
} from "./operational-policy-fields";

const definitions = {
  COMPLAINTS: {
    title: "Complaint policy",
    description:
      "Record the approved escalation contact, urgent classifications and acknowledgement calendar.",
    impact:
      "This records complaint handling settings once effective. It does not acknowledge or resolve any complaint, or replace previously saved complaint deadlines.",
  },
  DISPUTES: {
    title: "Dispute policy",
    description:
      "Record the approved primary and backup contacts and working calendar for payment disputes.",
    impact:
      "This records dispute handling settings once effective. It does not submit evidence to a payment provider, resolve a dispute or change existing assignments.",
  },
  RETENTION: {
    title: "Retention policy",
    description:
      "Record approved retention periods, starting events, dispositions and legal bases for company records.",
    impact:
      "This records retention rules once effective. Deletion and anonymization remain disabled; publishing does not remove records, release holds or approve a privacy request.",
  },
} as const;
function PolicyHistory({
  kind,
  history,
}: {
  kind: OperationalPolicyKind;
  history: PolicyVersion[];
}) {
  return (
    <details className="detail-section operational-policy-history">
      <summary>Policy history</summary>
      <p>
        Latest 100 recorded versions, including scheduled changes. The latest recorded
        version may not yet be effective.
      </p>
      {history.map((row) => (
        <article className="detail-section" key={row.id}>
          <h3>
            Version {row.version} · {row.approvalStatus.replaceAll("_", " ")}
          </h3>
          <p>Effective {formatBusinessDate(row.effectiveAt)}</p>
          <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
          {operationalPolicySchemas[kind].safeParse(row.settings).success ? (
            <dl className="totals">
              {operationalFacts(kind, row.settings).map((f) => (
                <div className="spec-row" key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>
              This draft or older version does not contain complete approved settings.
            </p>
          )}
          <p>Approval source: {row.source}</p>
          <p>Approval record: {row.approvalEvidence ?? "Not recorded"}</p>
        </article>
      ))}
    </details>
  );
}
function PolicyEditor({ kind }: { kind: OperationalPolicyKind }) {
  const key = kind.toLowerCase();
  const definition = definitions[kind];
  const parse = useCallback(
    (value: unknown) => {
      const rows = parsePolicyHistory(value);
      if (rows.some((row) => row.key !== key))
        throw new Error("Unexpected policy history");
      return rows;
    },
    [key],
  );
  const record = useResource(`/admin/policies?key=${key}&limit=100`, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const attempted = useRef(false);
  const latest = record.data?.reduce<PolicyVersion | undefined>(
    (found, row) => (!found || row.version > found.version ? row : found),
    undefined,
  );
  const disabled = record.loading || !!record.error || !record.data || uncertain;
  function invalid(text: string, id: string) {
    setValidation(text);
    document.getElementById(id)?.focus();
  }
  function review(form: FormData, submittedAt: number) {
    if (disabled || proposal) return;
    setValidation(undefined);
    setMessage(undefined);
    const parsed = operationalPolicyInputSchema.safeParse({
      kind,
      settings: operationalFormSettings(kind, form),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue?.path[1] ?? "");
      const rules = form.getAll("recordKey");
      const id =
        field === "records"
          ? `${rules[Number(issue?.path[2] ?? 0)]}-${String(issue?.path[3] ?? "recordType")}`
          : field === "days"
            ? "policy-day-0"
            : field === "holidayCalendarApproved"
              ? "policy-calendarApproved"
              : `policy-${field}`;
      const text = field.endsWith("UserId")
        ? "Choose eligible, verified contacts. Dispute contacts must be different and each needs dispute-management permission."
        : field === "days"
          ? "Choose at least one approved working day."
          : field === "holidays"
            ? "Enter valid excluded dates in YYYY-MM-DD format, up to 100 dates."
            : field === "urgentClassifications"
              ? "Enter 1–30 urgent classifications, one per line, each 2–100 characters."
              : field === "records"
                ? "Complete each retention rule: a category, 1–1,200 whole months, a 5–200-character start event, disposition and 20–1,000-character legal basis."
                : field === "holidayCalendarApproved"
                  ? "Confirm the approved calendar."
                  : "Check the approved working hours. Closing time must follow opening time on the same day.";
      invalid(text, id);
      return;
    }
    if (kind !== "RETENTION" && form.get("calendarApproved") !== "on") {
      invalid("Confirm the approved calendar.", "policy-calendarApproved");
      return;
    }
    const source = String(form.get("source") ?? "").trim(),
      approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    if (source.length < 10 || source.length > 500) {
      invalid("Describe the approval source in 10–500 characters.", "policy-source");
      return;
    }
    if (approvalEvidence.length < 20 || approvalEvidence.length > 1000) {
      invalid(
        "Record the written approval or its reference in 20–1,000 characters.",
        "policy-approval",
      );
      return;
    }
    const effective = String(form.get("effectiveAt") ?? "").trim();
    if (
      effective &&
      (!lagosDateTime.safeParse(effective).success ||
        Date.parse(`${effective}:00+01:00`) <= submittedAt)
    ) {
      invalid(
        "Choose a future Lagos date and time, or leave empty to apply on confirmation.",
        "policy-effective",
      );
      return;
    }
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      title: `Approve ${definition.title.toLowerCase()}?`,
      description: definition.impact,
      facts: [
        ...operationalFacts(kind, parsed.data.settings, form),
        {
          label: "Effective",
          value: effective
            ? formatBusinessDate(`${effective}:00+01:00`)
            : "On confirmation",
        },
        { label: "Approval source", value: source },
        { label: "Approval record", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        attempted.current = true;
        const body: RequestBody<"/admin/policies", "post"> = {
          ...parsed.data,
          expectedVersion,
          source,
          approvalEvidence,
          effectiveAt: effective
            ? new Date(`${effective}:00+01:00`).toISOString()
            : new Date().toISOString(),
        };
        const result = policyVersionSchema.parse(
          (await apiRequest("/admin/policies", { method: "POST", csrf: true, body }))
            .data,
        );
        const saved = operationalPolicySchemas[kind].parse(result.settings);
        if (
          result.key !== key ||
          result.version !== expectedVersion + 1 ||
          result.approvalStatus !== "APPROVED" ||
          result.source !== source ||
          result.approvalEvidence !== approvalEvidence ||
          Date.parse(result.effectiveAt) !== Date.parse(body.effectiveAt) ||
          JSON.stringify(saved) !== JSON.stringify(parsed.data.settings)
        )
          throw new Error("Unexpected policy publication");
      },
      onUncertain: () => setUncertain(true),
      retryAfterRejection: false,
    });
  }
  return (
    <>
      <Feedback message={record.error} />
      <Feedback message={validation} />
      <Feedback
        message={message}
        tone="success"
        toast={`${definition.title} approved.`}
      />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The approval outcome is uncertain. Review refreshed policy history before reloading to make another change."
        />
      )}
      <button
        className="button secondary"
        onClick={record.refresh}
        disabled={record.loading || !!proposal}
      >
        Refresh policy history
      </button>
      {record.loading && <p role="status">Loading policy history…</p>}
      {record.data && (
        <>
          <p>
            {latest
              ? `Latest recorded version: ${latest.version}.`
              : "No policy version has been recorded."}
          </p>
          {latest && (
            <p>
              Latest version effective {formatBusinessDate(latest.effectiveAt)}. Review
              scheduled versions before approving another change.
            </p>
          )}
          <form
            className="line-entry-form operational-policy-form"
            key={latest?.version ?? 0}
            onSubmit={(e) => {
              e.preventDefault();
              review(new FormData(e.currentTarget), new Date().getTime());
            }}
          >
            <fieldset disabled={disabled}>
              <legend>{definition.title} approval</legend>
              <OperationalPolicyFields kind={kind} initial={latest?.settings} />
              <div className="field">
                <label htmlFor="policy-effective">
                  Effective date and time (Lagos time, optional)
                </label>
                <input
                  className="input"
                  id="policy-effective"
                  name="effectiveAt"
                  type="datetime-local"
                  aria-describedby="policy-effective-help"
                />
                <span id="policy-effective-help" className="field-hint">
                  Leave empty to apply on confirmation, or schedule a future change.
                </span>
              </div>
              <div className="field">
                <label htmlFor="policy-source">Approval source</label>
                <input
                  className="input"
                  id="policy-source"
                  name="source"
                  required
                  minLength={10}
                  maxLength={500}
                />
              </div>
              <div className="field">
                <label htmlFor="policy-approval">Written approval or reference</label>
                <textarea
                  id="policy-approval"
                  name="approvalEvidence"
                  required
                  minLength={20}
                  maxLength={1000}
                />
              </div>
              <button className="button">Review policy</button>
            </fieldset>
          </form>
          {!record.error && <PolicyHistory kind={kind} history={record.data} />}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve policy"
          onClose={() => {
            setProposal(null);
            if (attempted.current) record.refresh();
            attempted.current = false;
          }}
          onSuccess={() =>
            setMessage(
              `${definition.title} approved. Review its effective date in policy history.`,
            )
          }
        />
      )}
    </>
  );
}
export function OperationalPolicy({ kind }: { kind: OperationalPolicyKind }) {
  const session = useAccountSession();
  const definition = definitions[kind];
  return (
    <>
      <h1>{definition.title}</h1>
      <p>{definition.description}</p>
      <p>{definition.impact}</p>
      {session?.user.role === "SUPER_ADMIN" ? (
        <PolicyEditor kind={kind} />
      ) : (
        <Feedback message="Super Admin access is required to configure this policy." />
      )}
    </>
  );
}
