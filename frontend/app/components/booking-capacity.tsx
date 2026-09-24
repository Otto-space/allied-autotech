"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  capacitySettingsSchema,
  parsePolicyHistory,
  policyVersionSchema,
  weekDays,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { AdminBranchPicker } from "./admin-branch-picker";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type CapacityInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "BRANCH_CAPACITY" }
>;
function PolicyHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="detail-section">
      <summary>Policy history</summary>
      <p>
        Latest 100 recorded versions. A scheduled version takes effect at its recorded
        start time. Existing confirmed bookings are not rescheduled by publishing a
        policy.
      </p>
      {history.length === 0 ? (
        <p>No policy has been recorded for this branch.</p>
      ) : (
        history.map((item) => {
          const settings = capacitySettingsSchema.safeParse(item.settings);
          return (
            <article className="detail-section" key={item.id}>
              <h3>
                Version {item.version} · {item.approvalStatus.replaceAll("_", " ")}
              </h3>
              <p>Effective {formatBusinessDate(item.effectiveAt)}</p>
              <p>Recorded {formatBusinessDate(item.recordedAt)}</p>
              {settings.success ? (
                <dl className="totals">
                  <dt>Daily booking limit</dt>
                  <dd>{settings.data.dailyLimit}</dd>
                  <dt>Opening days</dt>
                  <dd>
                    {settings.data.openingDays.map((day) => weekDays[day]).join(", ")}
                  </dd>
                  <dt>Appointment hours</dt>
                  <dd>08:00–18:00, Lagos time</dd>
                  <dt>Closed dates</dt>
                  <dd>{settings.data.holidays.join(", ") || "None recorded"}</dd>
                </dl>
              ) : (
                <p>The settings in this older version are unavailable in this form.</p>
              )}
              <p>Approval source: {item.source}</p>
              <p>Approval record: {item.approvalEvidence ?? "Not recorded"}</p>
            </article>
          );
        })
      )}
    </details>
  );
}
function CapacityEditor({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const key = `booking-capacity:${branchId}`;
  const parse = useCallback(
    (value: unknown) => {
      const history = parsePolicyHistory(value);
      if (history.some((policy) => policy.key !== key))
        throw new Error("Unexpected branch policy");
      return history;
    },
    [key],
  );
  const record = useResource(
    `/admin/policies?key=${encodeURIComponent(key)}&limit=100`,
    parse,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const latest = record.data?.reduce<PolicyVersion | undefined>(
    (found, row) => (!found || row.version > found.version ? row : found),
    undefined,
  );
  const previous = capacitySettingsSchema.safeParse(latest?.settings);
  const disabled =
    record.loading || !!record.error || !record.data || !!proposal || uncertain;
  function invalid(message: string, field: string) {
    setValidation(message);
    document.getElementById(field)?.focus();
  }
  function handleReview(form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    setMessage(undefined);
    const daily = Number(form.get("dailyLimit"));
    const openingDays = form.getAll("openingDays").map(Number);
    const holidays = [
      ...new Set(
        String(form.get("holidays") ?? "")
          .split(/[\s,]+/)
          .filter(Boolean),
      ),
    ].sort();
    const settings = capacitySettingsSchema.safeParse({
      dailyLimit: daily,
      openingDays,
      holidays,
      opensAt: "08:00",
      closesAt: "18:00",
      timezone: "Africa/Lagos",
    });
    if (!settings.success) {
      const field = settings.error.issues[0]?.path[0];
      invalid(
        field === "dailyLimit"
          ? "Enter a daily limit from 1 to 1,000 bookings."
          : field === "openingDays"
            ? "Choose at least one opening day."
            : "Use valid closed dates in YYYY-MM-DD format, up to 366 dates.",
        field === "openingDays"
          ? "capacity-day-0"
          : field === "dailyLimit"
            ? "capacity-limit"
            : "capacity-holidays",
      );
      return;
    }
    const source = String(form.get("source") ?? "").trim();
    const approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    if (source.length < 10 || source.length > 500) {
      invalid("Describe the approval source in 10–500 characters.", "capacity-source");
      return;
    }
    if (approvalEvidence.length < 20 || approvalEvidence.length > 1000) {
      invalid(
        "Record the written approval or its reference in 20–1,000 characters.",
        "capacity-approval",
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
        "capacity-effective",
      );
      return;
    }
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      title: "Approve this booking capacity?",
      description:
        "This publishes a new branch policy. Staff confirmation will check its daily limit, opening days and closed dates, together with staff and equipment availability. It does not confirm any booking automatically.",
      facts: [
        { label: "Branch", value: branchName },
        { label: "Daily limit", value: String(daily) },
        {
          label: "Opening days",
          value: openingDays.map((day) => weekDays[day]).join(", "),
        },
        { label: "Appointment hours", value: "08:00–18:00, Lagos time" },
        { label: "Closed dates", value: holidays.join(", ") || "None" },
        {
          label: "Effective",
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Source", value: source },
        { label: "Approval record", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        const body: CapacityInput = {
          kind: "BRANCH_CAPACITY",
          branchId,
          expectedVersion,
          effectiveAt: immediate
            ? new Date().toISOString()
            : new Date(`${start}:00+01:00`).toISOString(),
          source,
          approvalEvidence,
          settings: settings.data,
        };
        const response = policyVersionSchema.parse(
          (await apiRequest("/admin/policies", { method: "POST", csrf: true, body }))
            .data,
        );
        const saved = capacitySettingsSchema.parse(response.settings);
        if (
          response.key !== key ||
          response.version !== expectedVersion + 1 ||
          response.approvalStatus !== "APPROVED" ||
          response.source !== source ||
          response.approvalEvidence !== approvalEvidence ||
          Date.parse(response.effectiveAt) !== Date.parse(body.effectiveAt) ||
          JSON.stringify(saved) !== JSON.stringify(settings.data)
        )
          throw new Error("Unexpected policy result");
      },
      onUncertain: () => setUncertain(true),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section" aria-labelledby="capacity-editor-title">
      <h2 id="capacity-editor-title">{branchName}</h2>
      <Feedback message={record.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Booking capacity approved." />
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
        Refresh capacity policy
      </button>
      {record.loading && <p role="status">Loading branch policy…</p>}
      {record.data && (
        <>
          <p>
            {latest
              ? `Latest recorded version: ${latest.version}.`
              : "No booking capacity policy is recorded. Staff cannot confirm appointments until an approved policy is effective."}
          </p>
          {latest && (
            <p>
              Latest version effective {formatBusinessDate(latest.effectiveAt)}. Review
              any scheduled versions in the history before approving another change.
            </p>
          )}
          <form
            key={latest?.version ?? 0}
            onSubmit={(event) => {
              event.preventDefault();
              handleReview(new FormData(event.currentTarget), new Date().getTime());
            }}
          >
            <fieldset disabled={disabled}>
              <legend>Approve branch capacity</legend>
              <div className="field">
                <label htmlFor="capacity-limit">Maximum confirmed bookings per day</label>
                <input
                  id="capacity-limit"
                  name="dailyLimit"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  defaultValue={previous.success ? previous.data.dailyLimit : ""}
                />
              </div>
              <fieldset>
                <legend>Opening days</legend>
                {weekDays.map((day, index) => (
                  <label className="check-label" key={day}>
                    <input
                      id={`capacity-day-${index}`}
                      type="checkbox"
                      name="openingDays"
                      value={index}
                      defaultChecked={
                        previous.success && previous.data.openingDays.includes(index)
                      }
                    />{" "}
                    {day}
                  </label>
                ))}
              </fieldset>
              <p>
                Appointments must fit between 08:00 and 18:00, Lagos time. Set the daily
                limit from the people, bays and equipment available at this branch.
              </p>
              <div className="field">
                <label htmlFor="capacity-holidays">Closed dates (optional)</label>
                <textarea
                  id="capacity-holidays"
                  name="holidays"
                  defaultValue={previous.success ? previous.data.holidays.join("\n") : ""}
                  aria-describedby="capacity-holidays-help"
                  maxLength={5000}
                />
                <span id="capacity-holidays-help" className="field-hint">
                  Enter one date per line in YYYY-MM-DD format. Include holidays and
                  planned closures.
                </span>
              </div>
              <div className="field">
                <label htmlFor="capacity-effective">
                  Effective date and time (Lagos time, optional)
                </label>
                <input
                  id="capacity-effective"
                  name="effectiveAt"
                  type="datetime-local"
                  aria-describedby="capacity-effective-help"
                />
                <span id="capacity-effective-help" className="field-hint">
                  Leave empty to apply on confirmation, or schedule a future change.
                </span>
              </div>
              <div className="field">
                <label htmlFor="capacity-source">Approval source</label>
                <input
                  id="capacity-source"
                  name="source"
                  required
                  minLength={10}
                  maxLength={500}
                />
              </div>
              <div className="field">
                <label htmlFor="capacity-approval">Written approval or reference</label>
                <textarea
                  id="capacity-approval"
                  name="approvalEvidence"
                  required
                  minLength={20}
                  maxLength={1000}
                />
              </div>
              <button className="button">Review capacity approval</button>
            </fieldset>
          </form>
          <PolicyHistory history={record.data} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve capacity"
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Booking capacity approved. Review the effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
export function BookingCapacity() {
  const session = useAccountSession();
  const [branch, setBranch] = useState({ id: "", name: "" });
  if (session?.user.role !== "SUPER_ADMIN")
    return (
      <>
        <h1>Booking capacity</h1>
        <Feedback message="Super Admin access is required to approve branch booking capacity." />
      </>
    );
  return (
    <>
      <h1>Booking capacity</h1>
      <p>
        Record the approved calendar and daily booking limit for each workshop. Choose an
        active branch, review the settings and record the written approval.
      </p>
      <div className="field">
        <label htmlFor="capacity-branch">Workshop branch</label>
        <AdminBranchPicker
          id="capacity-branch"
          value={branch.id}
          onChange={(id, name) => setBranch({ id, name })}
        />
      </div>
      {branch.id && (
        <CapacityEditor key={branch.id} branchId={branch.id} branchName={branch.name} />
      )}
    </>
  );
}
