"use client";
import { useState } from "react";
import {
  operationalPolicySchemas,
  retentionRecordTypes,
  retentionDispositions,
  type OperationalPolicyKind,
} from "@/lib/api/operational-policy-schemas";
import { weekDays } from "@/lib/api/policy-schemas";
import { PolicyContacts } from "./policy-contacts";
import { Feedback } from "./feedback";
const timeText = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const dates = (form: FormData) =>
  [
    ...new Set(
      String(form.get("holidays") ?? "")
        .split(/[\s,]+/)
        .filter(Boolean),
    ),
  ].sort();
export function operationalFormSettings(
  kind: OperationalPolicyKind,
  form: FormData,
): unknown {
  if (kind === "RETENTION")
    return {
      destructiveExecutionEnabled: false,
      records: form.getAll("recordKey").map((key) => ({
        recordType: form.get(`${key}-recordType`),
        retentionMonths: Number(form.get(`${key}-retentionMonths`)),
        startEvent: form.get(`${key}-startEvent`),
        disposition: form.get(`${key}-disposition`),
        legalBasis: form.get(`${key}-legalBasis`),
      })),
    };
  if (kind === "COMPLAINTS")
    return {
      escalationUserId: form.get("escalationUserId"),
      ordinaryBusinessDayDefinition: "ACCUMULATED_WORKING_HOURS",
      holidays: dates(form),
      holidayCalendarApproved: form.get("calendarApproved") === "on",
      urgentClassifications: [
        ...new Set(
          String(form.get("urgentClassifications") ?? "")
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ],
    };
  const minute = (name: string) => {
    const value = String(form.get(name) ?? "");
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h! * 60 + m!;
  };
  return {
    primaryUserId: form.get("primaryUserId"),
    backupUserId: form.get("backupUserId"),
    days: form.getAll("days").map(Number),
    openMinute: minute("openMinute"),
    closeMinute: minute("closeMinute"),
    holidays: dates(form),
  };
}
export function operationalFacts(
  kind: OperationalPolicyKind,
  value: unknown,
  form?: FormData,
) {
  const contact = (name: string, id: string) =>
    `${form?.get(`${name}Label`) ? `${form.get(`${name}Label`)} · ` : ""}${id}`;
  if (kind === "COMPLAINTS") {
    const s = operationalPolicySchemas.COMPLAINTS.parse(value);
    return [
      {
        label: "Escalation contact",
        value: contact("escalationUserId", s.escalationUserId),
      },
      {
        label: "Ordinary acknowledgement target",
        value: "10 accumulated working hours, Monday–Saturday, 08:00–18:00 Lagos time.",
      },
      {
        label: "Urgent acknowledgement target",
        value: "60 working minutes on the same schedule.",
      },
      { label: "Excluded dates", value: s.holidays.join(", ") || "None recorded" },
      { label: "Urgent classifications", value: s.urgentClassifications.join("; ") },
    ];
  }
  if (kind === "DISPUTES") {
    const s = operationalPolicySchemas.DISPUTES.parse(value);
    return [
      { label: "Primary contact", value: contact("primaryUserId", s.primaryUserId) },
      { label: "Backup contact", value: contact("backupUserId", s.backupUserId) },
      { label: "Working days", value: s.days.map((d) => weekDays[d]).join(", ") },
      {
        label: "Working hours",
        value: `${timeText(s.openMinute)}–${timeText(s.closeMinute)} Lagos time`,
      },
      { label: "Excluded dates", value: s.holidays.join(", ") || "None recorded" },
    ];
  }
  const s = operationalPolicySchemas.RETENTION.parse(value);
  return [
    { label: "Execution", value: "Deletion and anonymization remain disabled." },
    ...s.records.flatMap((r, i) => [
      { label: `Rule ${i + 1} · Records`, value: retentionRecordTypes[r.recordType] },
      {
        label: `Rule ${i + 1} · Retention period`,
        value: `${r.retentionMonths} months from: ${r.startEvent}`,
      },
      {
        label: `Rule ${i + 1} · Disposition`,
        value: retentionDispositions[r.disposition],
      },
      { label: `Rule ${i + 1} · Legal basis`, value: r.legalBasis },
    ]),
  ];
}
function RetentionFields({ initial }: { initial: unknown }) {
  const parsed = operationalPolicySchemas.RETENTION.safeParse(initial);
  const [rows, setRows] = useState(() =>
    (parsed.success ? parsed.data.records : [undefined]).map((record, index) => ({
      key: `retention-${index}`,
      record,
    })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [notice, setNotice] = useState("");
  return (
    <fieldset>
      <legend>Approved retention rules</legend>
      <p>
        Record approved periods and legal bases. These rules do not schedule deletion or
        anonymization. Existing retention holds remain in force.
      </p>
      {rows.map(({ key, record }, index) => (
        <fieldset key={key}>
          <legend>Retention rule {index + 1}</legend>
          <input type="hidden" name="recordKey" value={key} />
          <div className="field">
            <label htmlFor={`${key}-recordType`}>Record category</label>
            <select
              id={`${key}-recordType`}
              name={`${key}-recordType`}
              required
              defaultValue={record?.recordType ?? ""}
            >
              <option value="">Choose records</option>
              {Object.entries(retentionRecordTypes).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${key}-retentionMonths`}>Retention period (months)</label>
            <input
              className="input"
              id={`${key}-retentionMonths`}
              name={`${key}-retentionMonths`}
              type="number"
              min={1}
              max={1200}
              step={1}
              required
              defaultValue={record?.retentionMonths ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor={`${key}-startEvent`}>Period starts from</label>
            <input
              className="input"
              id={`${key}-startEvent`}
              name={`${key}-startEvent`}
              required
              minLength={5}
              maxLength={200}
              defaultValue={record?.startEvent ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor={`${key}-disposition`}>Disposition after the period</label>
            <select
              id={`${key}-disposition`}
              name={`${key}-disposition`}
              required
              defaultValue={record?.disposition ?? ""}
            >
              <option value="">Choose approved disposition</option>
              {Object.entries(retentionDispositions).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${key}-legalBasis`}>Approved legal basis</label>
            <textarea
              id={`${key}-legalBasis`}
              name={`${key}-legalBasis`}
              required
              minLength={20}
              maxLength={1000}
              defaultValue={record?.legalBasis ?? ""}
            />
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={rows.length === 1}
            onClick={() => {
              setRows((old) => old.filter((r) => r.key !== key));
              setNotice(`Retention rule ${index + 1} removed from this draft.`);
              document.getElementById("policy-add-rule")?.focus();
            }}
          >
            Remove rule {index + 1}
          </button>
        </fieldset>
      ))}
      <Feedback message={notice} tone="info" />
      <button
        id="policy-add-rule"
        type="button"
        className="button secondary"
        disabled={rows.length >= 20}
        onClick={() => {
          setRows((old) => [...old, { key: `retention-${nextKey}`, record: undefined }]);
          setNextKey((n) => n + 1);
          setNotice(
            `Retention rule ${rows.length + 1} added. Its fields follow the previous rule.`,
          );
        }}
      >
        Add retention rule
      </button>
      <p className="field-hint">
        Up to 20 rules. No retention period is supplied automatically.
      </p>
    </fieldset>
  );
}
export function OperationalPolicyFields({
  kind,
  initial,
}: {
  kind: OperationalPolicyKind;
  initial: unknown;
}) {
  if (kind === "RETENTION") return <RetentionFields initial={initial} />;
  const parsed = operationalPolicySchemas[kind].safeParse(initial);
  const prior = parsed.success ? parsed.data : undefined;
  const dispute = kind === "DISPUTES";
  const clock = dispute
    ? operationalPolicySchemas.DISPUTES.safeParse(initial)
    : undefined;
  const complaints = !dispute
    ? operationalPolicySchemas.COMPLAINTS.safeParse(initial)
    : undefined;
  return (
    <>
      <PolicyContacts dispute={dispute} initial={prior} />
      <fieldset>
        <legend>
          {dispute ? "Approved dispute calendar" : "Approved complaint handling"}
        </legend>
        {dispute ? (
          <>
            <fieldset>
              <legend>Working days</legend>
              <div className="record-form-grid">
                {weekDays.map((day, index) => (
                  <label
                    className="check-label"
                    key={day}
                    htmlFor={`policy-day-${index}`}
                  >
                    <input
                      id={`policy-day-${index}`}
                      type="checkbox"
                      name="days"
                      value={index}
                      defaultChecked={clock?.success && clock.data.days.includes(index)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="record-form-grid">
              {[
                ["openMinute", "Opening time"],
                ["closeMinute", "Closing time"],
              ].map(([name, label]) => (
                <div className="field" key={name}>
                  <label htmlFor={`policy-${name}`}>{label} (Lagos time)</label>
                  <input
                    className="input"
                    type="time"
                    id={`policy-${name}`}
                    name={name}
                    required
                    defaultValue={
                      clock?.success
                        ? timeText(
                            name === "openMinute"
                              ? clock.data.openMinute
                              : clock.data.closeMinute,
                          )
                        : ""
                    }
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p>
              The current service counts ordinary acknowledgement targets as 10
              accumulated working hours and urgent targets as 60 working minutes,
              Monday–Saturday, 08:00–18:00 Lagos time. Excluded holidays do not count.
            </p>
            <div className="field">
              <label htmlFor="policy-urgentClassifications">
                Approved urgent classifications
              </label>
              <textarea
                id="policy-urgentClassifications"
                name="urgentClassifications"
                required
                defaultValue={
                  complaints?.success
                    ? complaints.data.urgentClassifications.join("\n")
                    : ""
                }
                aria-describedby="policy-classification-help"
              />
              <span id="policy-classification-help" className="field-hint">
                One classification per line; 1–30 classifications, each 2–100 characters.
                Staff still assign a complaint&apos;s priority; this list does not
                automatically classify complaints.
              </span>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="policy-holidays">Excluded holiday dates (optional)</label>
          <textarea
            id="policy-holidays"
            name="holidays"
            defaultValue={prior?.holidays.join("\n") ?? ""}
            aria-describedby="policy-holidays-help"
          />
          <span id="policy-holidays-help" className="field-hint">
            YYYY-MM-DD, one per line or separated by commas. Up to 100 dates. Leave empty
            only if the approved calendar excludes no holidays.
          </span>
        </div>
        <label className="check-label" htmlFor="policy-calendarApproved">
          <input
            id="policy-calendarApproved"
            type="checkbox"
            name="calendarApproved"
            required
          />
          I confirm that this schedule and holiday list are approved.
        </label>
      </fieldset>
    </>
  );
}
