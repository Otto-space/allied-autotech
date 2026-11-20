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
import { accessChangeSummary } from "@/lib/admin/access-history";
export function AuditLog({ accessChanges = false }: { accessChanges?: boolean }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>{accessChanges ? "Access change history" : "Audit log"}</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <AuditAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
      accessChanges={accessChanges}
    />
  );
}
function AuditAccess({
  owner,
  role,
  accessChanges,
}: {
  owner: string;
  role: string;
  accessChanges: boolean;
}) {
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
        <h1>{accessChanges ? "Access change history" : "Audit log"}</h1>
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
  return (
    <AuditContent
      onDenied={deny}
      accessBusy={own.loading || own.refreshing}
      accessChanges={accessChanges}
    />
  );
}
function AuditContent({
  onDenied,
  accessBusy,
  accessChanges,
}: {
  onDenied: () => void;
  accessBusy: boolean;
  accessChanges: boolean;
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
  if (accessChanges) query.set("view", "ACCESS_CHANGES");
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
            <span aria-current="page">
              {accessChanges ? "Access change history" : "Audit log"}
            </span>
          </li>
        </ol>
      </nav>
      <header className="wa-heading">
        <div>
          <h1>{accessChanges ? "Access change history" : "Audit log"}</h1>
          <p>
            {accessChanges
              ? "Review recorded duty, account-level, invitation and branch changes."
              : "Review recorded actions and changes."}
          </p>
        </div>
        <button className="button secondary" disabled={busy} onClick={records.refresh}>
          <RefreshCw size={16} aria-hidden="true" />
          {accessChanges ? "Refresh history" : "Refresh audit log"}
        </button>
      </header>
      <p className="wa-read-note">
        Reading or refreshing this history is recorded in the audit log.
      </p>
      {accessChanges && (
        <div className="wa-history-note">
          <p>
            Names and branch names are current records, not names at the event time.
            Earlier events may omit dates or before/after details. History does not prove
            a person’s current access.
          </p>
          <Link className="text-link" href="/admin/audit">
            Open full audit log
          </Link>
          <p className="muted">
            Account status, sign-in, read/preview and other activity remain in the full
            log. Invitation recipient names follow your existing invitation visibility.
          </p>
        </div>
      )}
      <form
        className="wa-filters"
        data-draft-key={accessChanges ? "access-history:1" : "audit-log:1"}
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
                {field.options
                  .filter(
                    (option) =>
                      !accessChanges ||
                      (field.name === "action"
                        ? [
                            "UPDATE",
                            "ROLE_CHANGE",
                            "BRANCH_ASSIGNED",
                            "INVITATION_CREATED",
                            "INVITATION_ACCEPTED",
                          ]
                        : ["USER", "STAFF_PROFILE", "PRIVILEGED_INVITATION"]
                      ).includes(option),
                  )
                  .map((option) => (
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
            {accessChanges ? "Apply history filters" : "Apply audit filters"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={clear}
          >
            {accessChanges ? "Clear history filters" : "Clear audit filters"}
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
          <span>
            {accessChanges ? "Checking access changes…" : "Checking audit events…"}
          </span>
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
                  : accessChanges
                    ? "No access changes on this page"
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
              const change = accessChanges ? accessChangeSummary(event) : undefined;
              return (
                <article
                  className="wa-event"
                  key={event.id}
                  aria-labelledby={`audit-event-${event.id}`}
                >
                  <header className="wa-event-heading">
                    <h2 id={`audit-event-${event.id}`}>
                      {change?.title ??
                        `${auditLabel(event.action)} · ${auditLabel(event.entityType)}`}
                    </h2>
                    <time dateTime={event.createdAt}>
                      {formatBusinessDate(event.createdAt)}
                    </time>
                    <p>
                      <span>Actor’s current role</span>
                      {event.user ? auditLabel(event.user.role) : "Not available"}
                    </p>
                  </header>
                  {change && (
                    <div className="wa-change-overview">
                      <p>{change.explanation}</p>
                      <dl className="wa-current-people">
                        <div>
                          <dt>Person (current record)</dt>
                          <dd>
                            {event.currentContext?.subject?.name ??
                              "Name unavailable in this view"}
                          </dd>
                        </div>
                        <div>
                          <dt>Changed by (current staff name)</dt>
                          <dd>
                            {event.currentContext?.actor?.name ??
                              "Name unavailable in this view"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                  <details className="wa-event-details">
                    <summary>Event details</summary>
                    <div className="wa-inspection">
                      {change && (
                        <section
                          className="wa-recorded-change"
                          aria-label="Recorded access change"
                        >
                          {change.facts.length > 0 && (
                            <dl className="wa-metadata">
                              {change.facts.map((fact) => (
                                <div key={fact.label}>
                                  <dt>{fact.label}</dt>
                                  <dd>{fact.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          <p>
                            <strong>Recorded reason: </strong>
                            {change.reason ?? "Not recorded in this event"}
                          </p>
                        </section>
                      )}
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
        label={accessChanges ? "Access change history" : "Audit log"}
      />
    </div>
  );
}
