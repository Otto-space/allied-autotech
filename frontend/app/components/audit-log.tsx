"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  auditActions,
  auditEntities,
  currentAuditRecord,
  type AuditQuery,
} from "@/lib/api/audit-schemas";
import {
  auditFilterSchema,
  auditQuery,
  emptyAuditFilters,
  type AuditFilters,
} from "@/lib/forms/audit-filters";
import { auditLabel, parseWorkAudit } from "@/lib/admin/work-audit";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { AuditValues } from "./audit-values";
export function AuditLog() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Audit log</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <AuditAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function AuditAccess({ owner, role }: { owner: string; role: string }) {
  const own = useOwnStaffPermissions(),
    [denied, setDenied] = useState(false);
  const deny = useCallback(() => setDenied(true), []);
  const error =
    own.error ||
    own.refreshError ||
    (own.data &&
    (own.data.id !== owner || own.data.role !== role || own.data.status !== "ACTIVE")
      ? "Current audit-log access could not be confirmed."
      : undefined);
  if (!own.data || error || denied)
    return (
      <div className="work-audit">
        <h1>Audit log</h1>
        <Feedback
          message={
            error ||
            (denied
              ? "Audit access is unavailable. Protected records have been cleared."
              : undefined)
          }
        />
        {own.loading && <p role="status">Checking audit access…</p>}
        <button
          className="button secondary"
          disabled={own.loading || own.refreshing}
          onClick={() => {
            setDenied(false);
            own.refresh();
          }}
        >
          Refresh audit access
        </button>
      </div>
    );
  return <AuditContent onDenied={deny} accessBusy={own.loading || own.refreshing} />;
}
function AuditContent({
  onDenied,
  accessBusy,
}: {
  onDenied: () => void;
  accessBusy: boolean;
}) {
  const [applied, setApplied] = useState(emptyAuditFilters),
    [advanced, setAdvanced] = useState(false);
  const form = useForm<AuditFilters>({
    resolver: zodResolver(auditFilterSchema),
    defaultValues: emptyAuditFilters,
  });
  const pagination = useCursorPage();
  const query = new URLSearchParams(
    Object.entries(auditQuery(applied)).map(([key, value]) => [key, String(value)]),
  );
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const queryText = query.toString();
  const parse = useCallback(
    (value: unknown) =>
      parseWorkAudit(
        value,
        Object.fromEntries(new URLSearchParams(queryText)) as AuditQuery,
      ),
    [queryText],
  );
  const records = useResource(`/admin/audit?${queryText}`, parse);
  useEffect(() => {
    if (records.denied) onDenied();
  }, [records.denied, onDenied]);
  const busy = accessBusy || records.loading || records.refreshing;
  const filtered = Object.values(applied).some(Boolean);
  const advancedCount = ["userId", "entityId", "requestId", "from", "to"].filter(
    (key) => applied[key as keyof AuditFilters],
  ).length;
  const clear = () => {
    form.reset(emptyAuditFilters);
    setApplied(emptyAuditFilters);
    pagination.reset();
  };
  return (
    <div className="work-audit">
      <nav className="wa-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Audit log</span>
          </li>
        </ol>
      </nav>
      <header className="wa-heading">
        <div>
          <h1>Audit log</h1>
          <p>Review recorded actions and changes.</p>
        </div>
        <button className="button secondary" disabled={busy} onClick={records.refresh}>
          <RefreshCw size={16} aria-hidden="true" />
          Refresh audit log
        </button>
      </header>
      <p className="wa-read-note">
        Reading or refreshing this history is recorded in the audit log.
      </p>
      <form
        className="wa-filters"
        data-draft-key="audit-log:1"
        noValidate
        onSubmit={form.handleSubmit(
          (value) => {
            setApplied(value);
            pagination.reset();
          },
          (errors) => {
            const first = Object.keys(errors)[0] as keyof AuditFilters | undefined;
            if (first && !["action", "entityType"].includes(first)) {
              setAdvanced(true);
              requestAnimationFrame(() => form.setFocus(first));
            }
          },
        )}
      >
        <div className="wa-common">
          {(
            [
              { name: "action", label: "Action", options: auditActions },
              { name: "entityType", label: "Record type", options: auditEntities },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`audit-${field.name}`}>{field.label}</label>
              <select
                id={`audit-${field.name}`}
                {...form.register(field.name)}
                disabled={accessBusy}
              >
                <option value="">
                  {field.name === "action" ? "All actions" : "All record types"}
                </option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {auditLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <details
          className="wa-advanced"
          open={advanced}
          onToggle={(event) => setAdvanced(event.currentTarget.open)}
        >
          <summary>
            Reference and date filters
            {advancedCount > 0 ? ` (${advancedCount} applied)` : ""}
          </summary>
          <div className="wa-references">
            {(
              [
                {
                  name: "userId",
                  label: "User reference (optional)",
                  type: "text",
                  maxLength: 80,
                },
                {
                  name: "entityId",
                  label: "Record reference (optional)",
                  type: "text",
                  maxLength: 120,
                },
                {
                  name: "requestId",
                  label: "Request reference (optional)",
                  type: "text",
                  maxLength: 100,
                },
                {
                  name: "from",
                  label: "From date and time (Lagos)",
                  type: "datetime-local",
                },
                {
                  name: "to",
                  label: "Through date and time (Lagos)",
                  type: "datetime-local",
                },
              ] as const
            ).map((field) => (
              <div
                className={`field${field.type === "datetime-local" ? " wa-date" : ""}`}
                key={field.name}
              >
                <label htmlFor={`audit-${field.name}`}>{field.label}</label>
                <input
                  id={`audit-${field.name}`}
                  type={field.type}
                  maxLength={"maxLength" in field ? field.maxLength : undefined}
                  autoComplete="off"
                  {...form.register(field.name)}
                  disabled={accessBusy}
                  aria-invalid={!!form.formState.errors[field.name]}
                  aria-describedby={
                    form.formState.errors[field.name]
                      ? `audit-${field.name}-error`
                      : undefined
                  }
                />
                {form.formState.errors[field.name] && (
                  <p
                    className="field-error"
                    role="alert"
                    id={`audit-${field.name}-error`}
                  >
                    {form.formState.errors[field.name]?.message}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="wa-help">
            Date boundaries are optional. When both are supplied, the range must be within
            90 days. Reference filters stay out of the page URL.
          </p>
        </details>
        <div className="wa-filter-actions">
          <button className="button" type="submit" disabled={busy}>
            Apply audit filters
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={clear}
          >
            Clear audit filters
          </button>
        </div>
      </form>
      <Feedback message={records.error || records.refreshError} />
      {records.refreshError && records.data && (
        <p className="notice">
          Previously loaded events are shown. Refresh successfully to check current
          history.
        </p>
      )}
      {records.loading && (
        <div className="wa-loading" role="status">
          <span>Checking audit events…</span>
          <div aria-hidden="true" />
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}
      {!records.loading && !records.error && records.data && (
        <>
          <p className="wa-count" role="status">
            {records.data.items.length} on this page <span aria-hidden="true">·</span>{" "}
            Newest first{filtered ? " · Filtered view" : ""}
          </p>
          {!records.data.items.length && (
            <div className="wa-empty">
              <h2>
                {filtered
                  ? "No events match these filters"
                  : "No audit events on this page"}
              </h2>
              <p>Try another filter or refresh to check for updates.</p>
              {filtered && (
                <button className="button secondary" onClick={clear}>
                  Reset audit view
                </button>
              )}
            </div>
          )}
          <div className="wa-events">
            {records.data.items.map((event) => {
              const href = currentAuditRecord(event);
              return (
                <article
                  className="wa-event"
                  key={event.id}
                  aria-labelledby={`audit-event-${event.id}`}
                >
                  <header className="wa-event-heading">
                    <h2 id={`audit-event-${event.id}`}>
                      {auditLabel(event.action)} · {auditLabel(event.entityType)}
                    </h2>
                    <time dateTime={event.createdAt}>
                      {formatBusinessDate(event.createdAt)}
                    </time>
                    <p>
                      <span>Actor’s current role</span>
                      {event.user ? auditLabel(event.user.role) : "Not available"}
                    </p>
                  </header>
                  <details className="wa-event-details">
                    <summary>Event details</summary>
                    <div className="wa-inspection">
                      <dl className="wa-metadata">
                        {[
                          ["Event reference", event.id],
                          ["User reference", event.userId],
                          ["Record reference", event.entityId],
                          ["Request reference", event.requestId],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value ?? "Not recorded"}</dd>
                          </div>
                        ))}
                      </dl>
                      {href && (
                        <Link className="text-link" href={href}>
                          Open current record
                        </Link>
                      )}
                      <AuditValues event={event} />
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={busy || !!records.error || !!records.refreshError}
        label="Audit log"
      />
    </div>
  );
}
