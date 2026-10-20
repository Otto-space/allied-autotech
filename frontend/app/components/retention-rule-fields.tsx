"use client";
import { useState } from "react";
import {
  retentionSettingsSchema,
  retentionRecordTypes,
  retentionDispositions,
} from "@/lib/api/operational-policy-schemas";
import { Feedback } from "./feedback";

type Settings = ReturnType<typeof retentionSettingsSchema.parse>;
export function RetentionRuleFields({
  initial,
  invalidField,
}: {
  initial?: Settings;
  invalidField?: string;
}) {
  const [rows, setRows] = useState(() =>
    (initial?.records ?? [undefined]).map((record, index) => ({ key: index, record })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [notice, setNotice] = useState("");
  function captureBase(form: HTMLFormElement | null) {
    // Structure-only edits must retain the draft's base even before typing a field.
    form
      ?.querySelector('input[name="policyBaseVersion"]')
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return (
    <fieldset className="retention-rules-editor">
      <legend>Retention rules</legend>
      <p>Approved periods and legal bases. Existing holds remain in force.</p>
      {rows.map(({ key, record }, index) => {
        const name = `retention.${index}`;
        const errors = (field: string) => ({
          "aria-invalid": invalidField === `${name}-${field}`,
          "aria-describedby": "retention-validation",
        });
        return (
          <fieldset key={key} className="retention-rule" data-draft-row="retention">
            <legend>Retention rule {index + 1}</legend>
            <input type="hidden" name="recordKey" value={name} />
            <div className="retention-fields">
              <div className="field">
                <label htmlFor={`${name}-recordType`}>Record category</label>
                <select
                  id={`${name}-recordType`}
                  name={`${name}-recordType`}
                  required
                  defaultValue={record?.recordType ?? ""}
                  {...errors("recordType")}
                >
                  <option value="">Choose records</option>
                  {Object.entries(retentionRecordTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${name}-retentionMonths`}>
                  Retention period (months)
                </label>
                <input
                  id={`${name}-retentionMonths`}
                  name={`${name}-retentionMonths`}
                  type="number"
                  required
                  min={1}
                  max={1200}
                  step={1}
                  defaultValue={record?.retentionMonths ?? ""}
                  {...errors("retentionMonths")}
                />
                <span className="field-hint">1–1,200 whole months.</span>
              </div>
              <div className="field">
                <label htmlFor={`${name}-startEvent`}>Period starts from</label>
                <input
                  id={`${name}-startEvent`}
                  name={`${name}-startEvent`}
                  required
                  minLength={5}
                  maxLength={200}
                  defaultValue={record?.startEvent ?? ""}
                  {...errors("startEvent")}
                />
              </div>
              <div className="field">
                <label htmlFor={`${name}-disposition`}>
                  Disposition after the period
                </label>
                <select
                  id={`${name}-disposition`}
                  name={`${name}-disposition`}
                  required
                  defaultValue={record?.disposition ?? ""}
                  {...errors("disposition")}
                >
                  <option value="">Choose approved disposition</option>
                  {Object.entries(retentionDispositions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field retention-evidence">
                <label htmlFor={`${name}-legalBasis`}>Approved legal basis</label>
                <textarea
                  id={`${name}-legalBasis`}
                  name={`${name}-legalBasis`}
                  required
                  minLength={20}
                  maxLength={1000}
                  defaultValue={record?.legalBasis ?? ""}
                  {...errors("legalBasis")}
                />
                <span className="field-hint">20–1,000 characters.</span>
              </div>
            </div>
            <button
              type="button"
              className="button secondary"
              data-draft-remove="retention"
              disabled={rows.length === 1}
              onClick={(event) => {
                captureBase(event.currentTarget.form);
                setRows((old) => old.filter((row) => row.key !== key));
                setNotice(`Retention rule ${index + 1} removed from this draft.`);
                document.getElementById("policy-add-rule")?.focus();
              }}
            >
              Remove rule {index + 1}
            </button>
          </fieldset>
        );
      })}
      <Feedback message={notice} tone="info" />
      <button
        type="button"
        id="policy-add-rule"
        className="button secondary"
        data-draft-add="retention"
        disabled={rows.length >= 20}
        onClick={(event) => {
          captureBase(event.currentTarget.form);
          setRows((old) => [...old, { key: nextKey, record: undefined }]);
          setNextKey((value) => value + 1);
          setNotice(
            `Retention rule ${rows.length + 1} added. Its fields follow the previous rule.`,
          );
        }}
      >
        Add retention rule
      </button>
      <p className="field-hint retention-rule-limit">
        Up to 20 rules. No retention period is supplied automatically.
      </p>
    </fieldset>
  );
}
