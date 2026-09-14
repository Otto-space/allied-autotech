"use client";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import type { AdminField, AdminResource } from "@/lib/admin/resources";
import { isRecord } from "@/lib/api/errors";
import { nairaToKobo, koboToInput } from "@/lib/format/currency-input";
import { Feedback } from "./feedback";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
const recordSchema = z.object({ id: z.uuid() }).catchall(z.unknown());
const parseRecords = (value: unknown) =>
  z
    .object({ items: z.array(recordSchema), nextCursor: z.string().optional() })
    .parse(value);
type RecordValue = z.infer<typeof recordSchema>;
function textValue(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
}
function initialValue(record: RecordValue | null, field: AdminField) {
  let value: unknown = record;
  for (const part of (field.readPath ?? field.name).split("."))
    value = isRecord(value) ? value[part] : undefined;
  if (value == null) return record ? "" : (field.default ?? "");
  return field.type === "money" ? koboToInput(textValue(value)) : textValue(value);
}
function LookupField({
  field,
  initial,
}: Readonly<{ field: AdminField; initial: string }>) {
  const pagination = useCursorPage();
  const [selected, setSelected] = useState({ id: initial, label: "Current selection" });
  const params = new URLSearchParams({ limit: "100" });
  if (pagination.cursor) params.set("cursor", pagination.cursor);

  const choicesUrl = field.source ? `${field.source}?${params.toString()}` : null;
  const choices = useResource(choicesUrl, parseRecords);

  return (
    <>
      <select
        id={`admin-${field.name}`}
        name={field.name}
        value={selected.id}
        onChange={(event) =>
          setSelected({
            id: event.target.value,
            label: event.target.selectedOptions[0]?.textContent ?? "Selected record",
          })
        }
        required={field.required}
      >
        <option value="">Choose {field.label.toLowerCase()}</option>
        {selected.id && !choices.data?.items.some((item) => item.id === selected.id) && (
          <option value={selected.id}>{selected.label}</option>
        )}
        {choices.data?.items.map((item) => (
          <option value={item.id} key={item.id}>
            {textValue(item.name) ||
              textValue(item.title) ||
              textValue(item.code) ||
              "Unnamed record"}
          </option>
        ))}
      </select>
      {choices.loading && <span className="field-hint">Loading choices…</span>}
      {choices.error && (
        <>
          <Feedback message="Choices could not be loaded." />
          <button type="button" className="text-link" onClick={choices.refresh}>
            Retry choices
          </button>
        </>
      )}
      {(choices.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={choices.data?.nextCursor}
          disabled={choices.loading || !!choices.error}
          label={`${field.label} choices`}
        />
      )}
    </>
  );
}
function BooleanField({
  field,
  initial,
}: Readonly<{ field: AdminField; initial: string }>) {
  return (
    <label className="check-label">
      <input name={field.name} type="checkbox" defaultChecked={initial === "true"} />{" "}
      {field.label}
    </label>
  );
}

function CommonInputProps(field: AdminField, initial: string) {
  return {
    id: `admin-${field.name}`,
    name: field.name,
    required: field.required,
    defaultValue: initial,
  };
}

function TextInputField({
  field,
  common,
}: Readonly<{ field: AdminField; common: ReturnType<typeof CommonInputProps> }>) {
  let inputMode: "decimal" | "numeric" | undefined;
  if (field.type === "money") inputMode = "decimal";
  else if (field.type === "number") inputMode = "numeric";

  let pattern: string | undefined;
  if (field.type === "money") pattern = "[0-9]+([.][0-9]{1,2})?";
  else if (field.name === "slug") pattern = "[a-z0-9]+(-[a-z0-9]+)*";

  return (
    <input
      {...common}
      type={field.type === "money" ? "text" : (field.type ?? "text")}
      inputMode={inputMode}
      min={field.type === "number" ? field.min : undefined}
      max={field.type === "number" ? field.max : undefined}
      maxLength={field.type !== "number" ? field.max : undefined}
      pattern={pattern}
    />
  );
}

function InputField({
  field,
  record,
}: {
  readonly field: AdminField;
  readonly record: RecordValue | null;
}) {
  const initial = initialValue(record, field);
  if (field.type === "boolean") return <BooleanField field={field} initial={initial} />;

  const common = CommonInputProps(field, initial);

  let fieldInput: ReactNode;
  if (field.source) {
    fieldInput = <LookupField field={field} initial={initial} />;
  } else if (field.type === "textarea") {
    fieldInput = <textarea {...common} maxLength={field.max} />;
  } else if (field.type === "select") {
    fieldInput = (
      <select {...common}>
        <option value="">Choose an option</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    );
  } else {
    fieldInput = <TextInputField field={field} common={common} />;
  }

  return (
    <div className="field">
      <label htmlFor={common.id}>
        {field.label}
        {!field.required && !field.label.includes("optional") ? " (optional)" : ""}
      </label>
      {fieldInput}
      {field.name === "slug" && (
        <span className="field-hint">Use lowercase words separated by hyphens.</span>
      )}
    </div>
  );
}

function setFieldValue(body: Record<string, unknown>, field: AdminField, form: FormData) {
  if (field.type === "boolean") {
    body[field.name] = form.has(field.name);
    return;
  }
  const rawValue = form.get(field.name);
  const value = (typeof rawValue === "string" ? rawValue : "").trim();
  if (!value && field.nullable) {
    body[field.name] = null;
    return;
  }
  if (!value && !field.required) return;
  if (field.type === "money") {
    body[field.name] = nairaToKobo(value);
    return;
  }
  if (field.type !== "number") {
    body[field.name] = value;
    return;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Enter a valid whole number.");
  body[field.name] = number;
}

function buildProposal(
  config: AdminResource,
  editing: RecordValue | null,
  form: FormData,
) {
  const body: Record<string, unknown> = {};
  for (const field of config.fields) setFieldValue(body, field, form);
  if (config.versioned && editing) {
    if (typeof editing.version !== "number")
      throw new Error("Refresh this record before editing it.");
    body.expectedVersion = editing.version;
  }
  if (body.pricingType === "FIXED" && body.priceKobo === null)
    throw new Error("Enter a price for a fixed-price service.");
  return body;
}

export function AdminResourcePanel({ config }: Readonly<{ config: AdminResource }>) {
  const session = useAccountSession();
  const allowed = session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  let resourceUrl = allowed ? `${config.path}?limit=25` : null;
  if (resourceUrl && cursor) {
    resourceUrl += `&cursor=${cursor}`;
  }
  const records = useResource(resourceUrl, parseRecords);
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function review(form: FormData) {
    setError(undefined);
    try {
      const body = buildProposal(config, editing, form);
      setProposal(body);
      dialog.current?.showModal();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Check the form fields.");
    }
  }
  async function save() {
    if (busy || !proposal) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(editing ? `${config.path}/${editing.id}` : config.path, {
        method: editing ? "PATCH" : "POST",
        csrf: true,
        body: proposal,
      });
      dialog.current?.close();
      records.refresh();
      setEditing(null);
      setFormKey((value) => value + 1);
      setMessage(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} saved.`);
    } catch (error_) {
      setError(
        error_ instanceof ApiError
          ? error_.message
          : "The save could not be confirmed. Refresh the records before creating another.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return (
      <>
        <h1>{config.title}</h1>
        <Feedback message="Administrator access is required to manage these records." />
      </>
    );
  return (
    <>
      <h1>{config.title}</h1>
      <p className="lead">{config.description}</p>
      <Feedback message={records.error ?? error} />
      <Feedback message={message} tone="success" />
      <button className="button secondary" onClick={records.refresh}>
        Refresh records
      </button>
      {records.loading && <output>Loading records…</output>}
      <section className="table-region" aria-label={config.title}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Reference</th>
              <th>Visibility</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {records.data?.items.map((record) => (
              <tr key={record.id}>
                <td>{textValue(record.name)}</td>
                <td>
                  {textValue(record.sku) ||
                    textValue(record.code) ||
                    textValue(record.slug)}
                </td>
                <td>
                  {(() => {
                    if (record.isActive === true) return "Active";
                    if (record.isActive === false) return "Inactive";
                    return "Not specified";
                  })()}
                </td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(record);
                      setFormKey((value) => value + 1);
                    }}
                  >
                    View & edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <div className="empty">No records on this page.</div>
      )}
      <nav className="pagination" aria-label={`${config.title} pages`}>
        <button
          className="button secondary"
          disabled={!history.length || records.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!records.data?.nextCursor || records.loading || !!records.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(records.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
      <section className="detail-section">
        <h2>{editing ? `Edit ${config.singular}` : `Create ${config.singular}`}</h2>
        <form
          key={formKey}
          onSubmit={(event) => {
            event.preventDefault();
            review(new FormData(event.currentTarget));
          }}
        >
          <div className="form-row">
            {config.fields.map((field) => (
              <InputField key={field.name} field={field} record={editing} />
            ))}
          </div>
          <div className="actions">
            <button type="submit" className="button" disabled={busy}>
              Review changes
            </button>
            {editing && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEditing(null);
                  setFormKey((value) => value + 1);
                }}
              >
                Create a new {config.singular}
              </button>
            )}
          </div>
        </form>
      </section>
      <dialog ref={dialog} className="support-dialog" aria-labelledby="admin-save-title">
        <h2 id="admin-save-title">Save this {config.singular}?</h2>
        <p>These changes affect the live catalogue or workshop information.</p>
        <Feedback message={error} />
        <dl className="totals">
          {config.fields
            .filter((field) => proposal?.[field.name] !== undefined)
            .map((field) => (
              <div className="spec-row" key={field.name}>
                <dt>{field.label}</dt>
                <dd>
                  {field.type === "money" && typeof proposal?.[field.name] === "string"
                    ? koboToInput(String(proposal[field.name]))
                    : textValue(proposal?.[field.name]) || "Not provided"}
                </dd>
              </div>
            ))}
        </dl>
        <div className="actions">
          <button className="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Confirm save"}
          </button>
          <button className="button secondary" onClick={() => dialog.current?.close()}>
            Go back
          </button>
        </div>
      </dialog>
    </>
  );
}
