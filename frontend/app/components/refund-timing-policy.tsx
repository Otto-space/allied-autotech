"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  bankRefundClockSettingsSchema,
  parsePolicyHistory,
  policyVersionSchema,
  refundStartEvents,
  weekDays,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type ClockInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "BANK_REFUND_CLOCK" }
>;
const counting =
  "10 banking days, excluding the start date, due at the same Lagos time. Selected weekdays count; listed holidays do not.";
const parseHistory = (value: unknown) => {
  const history = parsePolicyHistory(value);
  if (history.some((row) => row.key !== "bank_refund_clock"))
    throw new Error("Unexpected refund timing policy");
  return history;
};
function timingFacts(settings: ClockInput["settings"]) {
  return [
    { label: "Clock starts when", value: refundStartEvents[settings.startEvent] },
    { label: "Counting rule", value: counting },
    {
      label: "Banking days",
      value: settings.bankingDays.map((day) => weekDays[day]).join(", "),
    },
    { label: "Excluded dates", value: settings.holidays.join(", ") || "None recorded" },
  ];
}
function ClockHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="detail-section">
      <summary>Refund timing history</summary>
      <p>
        Latest 100 recorded versions, including scheduled changes. The backend selects an
        approved version effective when a bank refund was requested. Saved deadlines keep
        their original policy.
      </p>
      {history.length === 0 && <p>No bank refund timing policy has been recorded.</p>}
      {history.map((row) => {
        const settings = bankRefundClockSettingsSchema.safeParse(row.settings);
        return (
          <article className="detail-section" key={row.id}>
            <h3>
              Version {row.version} · {row.approvalStatus.replaceAll("_", " ")}
            </h3>
            <p>Effective {formatBusinessDate(row.effectiveAt)}</p>
            <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
            {settings.success ? (
              <dl className="totals">
                {timingFacts(settings.data).map((fact) => (
                  <div className="spec-row" key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>
                This draft or older version does not contain a complete approved banking
                calendar.
              </p>
            )}
            <p>Approval source: {row.source}</p>
            <p>Approval record: {row.approvalEvidence ?? "Not recorded"}</p>
          </article>
        );
      })}
    </details>
  );
}
function ClockEditor() {
  const record = useResource(
    "/admin/policies?key=bank_refund_clock&limit=100",
    parseHistory,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const writeAttempted = useRef(false);
  const latest = record.data?.reduce<PolicyVersion | undefined>(
    (found, row) => (!found || row.version > found.version ? row : found),
    undefined,
  );
  const previous = bankRefundClockSettingsSchema.safeParse(latest?.settings);
  const disabled =
    record.loading || !!record.error || !record.data || !!proposal || uncertain;
  function invalid(message: string, id: string) {
    setValidation(message);
    document.getElementById(id)?.focus();
  }
  function review(form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    setMessage(undefined);
    const settings = bankRefundClockSettingsSchema.safeParse({
      startEvent: form.get("startEvent"),
      businessDays: 10,
      countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME",
      bankingDays: form.getAll("bankingDays").map(Number),
      holidays: [
        ...new Set(
          String(form.get("holidays") ?? "")
            .split(/[\s,]+/)
            .filter(Boolean),
        ),
      ].sort(),
      timezone: "Africa/Lagos",
    });
    if (!settings.success) {
      const field = settings.error.issues[0]?.path[0];
      invalid(
        field === "startEvent"
          ? "Choose the approved event that starts the refund clock."
          : field === "bankingDays"
            ? "Choose at least one approved banking day."
            : "Enter valid holiday dates in YYYY-MM-DD format, up to 366 dates.",
        field === "startEvent"
          ? "refund-start"
          : field === "bankingDays"
            ? "refund-day-0"
            : "refund-holidays",
      );
      return;
    }
    if (form.get("calendarApproved") !== "on") {
      invalid(
        "Confirm that the banking days and holiday list have been approved.",
        "refund-calendar-approved",
      );
      return;
    }
    const source = String(form.get("source") ?? "").trim();
    const approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    if (source.length < 10 || source.length > 500) {
      invalid("Describe the approval source in 10–500 characters.", "refund-source");
      return;
    }
    if (approvalEvidence.length < 20 || approvalEvidence.length > 1000) {
      invalid(
        "Record the written approval or its reference in 20–1,000 characters.",
        "refund-approval",
      );
      return;
    }
    const start = String(form.get("effectiveAt") ?? "").trim();
    const immediate = start === "";
    if (
      !immediate &&
      (!lagosDateTime.safeParse(start).success ||
        Date.parse(`${start}:00+01:00`) <= submittedAt)
    ) {
      invalid(
        "Choose a future Lagos date and time, or leave it empty to apply on confirmation.",
        "refund-effective",
      );
      return;
    }
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      title: "Approve bank refund timing?",
      description:
        "This records the approved timing for manual bank refunds requested once effective. The backend records a deadline after the chosen event occurs. Publishing does not move money, confirm receipt or recalculate existing saved deadlines.",
      facts: [
        ...timingFacts(settings.data),
        {
          label: "Effective",
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Approval source", value: source },
        { label: "Approval record", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        writeAttempted.current = true;
        const body: ClockInput = {
          kind: "BANK_REFUND_CLOCK",
          expectedVersion,
          effectiveAt: immediate
            ? new Date().toISOString()
            : new Date(`${start}:00+01:00`).toISOString(),
          source,
          approvalEvidence,
          settings: settings.data,
        };
        const result = policyVersionSchema.parse(
          (await apiRequest("/admin/policies", { method: "POST", csrf: true, body }))
            .data,
        );
        const saved = bankRefundClockSettingsSchema.parse(result.settings);
        if (
          result.key !== "bank_refund_clock" ||
          result.version !== expectedVersion + 1 ||
          result.approvalStatus !== "APPROVED" ||
          result.source !== source ||
          result.approvalEvidence !== approvalEvidence ||
          Date.parse(result.effectiveAt) !== Date.parse(body.effectiveAt) ||
          JSON.stringify(saved) !== JSON.stringify(settings.data)
        )
          throw new Error("Unexpected refund timing result");
      },
      onUncertain: () => setUncertain(true),
      retryAfterRejection: false,
    });
  }
  return (
    <>
      <Feedback message={record.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Bank refund timing approved." />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The approval outcome is uncertain. Review the refreshed policy history before reloading to make any further change."
        />
      )}
      <button
        className="button secondary"
        disabled={record.loading || !!proposal}
        onClick={record.refresh}
      >
        Refresh refund timing
      </button>
      {record.loading && <p role="status">Loading refund timing…</p>}
      {record.data && (
        <>
          <p>
            {latest
              ? `Latest recorded version: ${latest.version}.`
              : "No bank refund timing policy has been recorded."}
          </p>
          {latest && (
            <p>
              Latest version effective {formatBusinessDate(latest.effectiveAt)}. Review
              scheduled versions before approving another change.
            </p>
          )}
          <form
            className="line-entry-form"
            key={latest?.version ?? 0}
            onSubmit={(event) => {
              event.preventDefault();
              review(new FormData(event.currentTarget), new Date().getTime());
            }}
          >
            <fieldset disabled={record.loading || !!record.error || uncertain}>
              <legend>Approved banking calendar</legend>
              <p>{counting}</p>
              <div className="field">
                <label htmlFor="refund-start">Clock starts when</label>
                <select
                  id="refund-start"
                  name="startEvent"
                  required
                  defaultValue={previous.success ? previous.data.startEvent : ""}
                >
                  <option value="">Choose the approved start event</option>
                  {Object.entries(refundStartEvents).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend>Banking days</legend>
                <div className="record-form-grid">
                  {weekDays.map((day, index) => (
                    <label
                      key={day}
                      className="check-label"
                      htmlFor={`refund-day-${index}`}
                    >
                      <input
                        id={`refund-day-${index}`}
                        type="checkbox"
                        name="bankingDays"
                        value={index}
                        defaultChecked={
                          previous.success && previous.data.bankingDays.includes(index)
                        }
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="refund-holidays">Excluded holiday dates (optional)</label>
                <textarea
                  id="refund-holidays"
                  name="holidays"
                  defaultValue={previous.success ? previous.data.holidays.join("\n") : ""}
                  aria-describedby="refund-holidays-help"
                />
                <span id="refund-holidays-help" className="field-hint">
                  Use YYYY-MM-DD, one date per line or separated by commas. Up to 366
                  dates. Leave empty only if no holidays are excluded by the approved
                  calendar.
                </span>
              </div>
              <label className="check-label" htmlFor="refund-calendar-approved">
                <input
                  id="refund-calendar-approved"
                  type="checkbox"
                  name="calendarApproved"
                  required
                />
                I confirm that these banking days and holiday dates are approved.
              </label>
              <div className="field">
                <label htmlFor="refund-effective">
                  Effective date and time (Lagos time, optional)
                </label>
                <input
                  id="refund-effective"
                  name="effectiveAt"
                  type="datetime-local"
                  aria-describedby="refund-effective-help"
                />
                <span id="refund-effective-help" className="field-hint">
                  Leave empty to apply on confirmation, or schedule a future change.
                </span>
              </div>
              <div className="field">
                <label htmlFor="refund-source">Approval source</label>
                <input
                  id="refund-source"
                  name="source"
                  required
                  minLength={10}
                  maxLength={500}
                />
              </div>
              <div className="field">
                <label htmlFor="refund-approval">Written approval or reference</label>
                <textarea
                  id="refund-approval"
                  name="approvalEvidence"
                  required
                  minLength={20}
                  maxLength={1000}
                />
              </div>
              <button className="button">Review refund timing</button>
            </fieldset>
          </form>
          <ClockHistory history={record.data} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve refund timing"
          onClose={() => {
            setProposal(null);
            if (writeAttempted.current) record.refresh();
            writeAttempted.current = false;
          }}
          onSuccess={() =>
            setMessage(
              "Bank refund timing approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </>
  );
}
export function RefundTimingPolicy() {
  const session = useAccountSession();
  return (
    <>
      <h1>Bank refund timing</h1>
      <p>
        Record the approved start event and banking calendar for manual bank refund
        deadlines.
      </p>
      {session?.user.role === "SUPER_ADMIN" ? (
        <ClockEditor />
      ) : (
        <Feedback message="Super Admin access is required to configure bank refund timing." />
      )}
    </>
  );
}
