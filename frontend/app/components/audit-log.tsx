"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  auditActions,
  auditEntities,
  currentAuditRecord,
  parseAuditEvents,
} from "@/lib/api/audit-schemas";
import {
  auditFilterSchema,
  auditQuery,
  emptyAuditFilters,
  type AuditFilters,
} from "@/lib/forms/audit-filters";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { AuditValues } from "./audit-values";
export function AuditLog() {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [applied, setApplied] = useState(emptyAuditFilters);
  const form = useForm<AuditFilters>({
    resolver: zodResolver(auditFilterSchema),
    defaultValues: emptyAuditFilters,
  });
  const pagination = useCursorPage();
  const query = new URLSearchParams(
    Object.entries(auditQuery(applied)).map(([key, value]) => [key, String(value)]),
  );
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(allowed ? `/admin/audit?${query}` : null, parseAuditEvents);
  if (!allowed)
    return (
      <>
        <h1>Audit log</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <>
      <h1>Audit log</h1>
      <p className="lead">
        Review recorded actions and changes. Reading or refreshing this history is itself
        recorded in the audit log.
      </p>
      <Link className="text-link" href="/admin">
        Back to operations
      </Link>
      <form
        noValidate
        onSubmit={form.handleSubmit((value) => {
          setApplied(value);
          pagination.reset();
        })}
      >
        <div className="catalogue-filters">
          {(
            [
              { name: "action", label: "Action", options: auditActions },
              { name: "entityType", label: "Record type", options: auditEntities },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`audit-${field.name}`}>{field.label}</label>
              <select id={`audit-${field.name}`} {...form.register(field.name)}>
                <option value="">All</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
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
            <div className="field" key={field.name}>
              <label htmlFor={`audit-${field.name}`}>{field.label}</label>
              <input
                id={`audit-${field.name}`}
                type={field.type}
                maxLength={"maxLength" in field ? field.maxLength : undefined}
                autoComplete="off"
                {...form.register(field.name)}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `audit-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p className="field-error" role="alert" id={`audit-${field.name}-error`}>
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <p>
          Date boundaries are optional. When both are supplied, the range must be within
          90 days.
        </p>
        <div className="actions">
          <button className="button" type="submit">
            Apply audit filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              form.reset(emptyAuditFilters);
              setApplied(emptyAuditFilters);
              pagination.reset();
            }}
          >
            Clear audit filters
          </button>
        </div>
      </form>
      <Feedback message={records.error} />
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={records.refresh}
        >
          Refresh audit log
        </button>
      </div>
      {records.loading && <p role="status">Checking audit events…</p>}
      {!records.loading && !records.error && !records.data?.items.length && (
        <div className="empty">
          <h2>
            {Object.values(applied).some(Boolean)
              ? "No events match these filters"
              : "No audit events on this page"}
          </h2>
          <p>Try another filter or refresh to check for updates.</p>
        </div>
      )}
      {records.data?.items.map((event) => {
        const href = currentAuditRecord(event);
        return (
          <section
            className="detail-section"
            key={event.id}
            aria-labelledby={`audit-event-${event.id}`}
          >
            <h2 id={`audit-event-${event.id}`}>
              {event.action.replaceAll("_", " ")} ·{" "}
              {event.entityType.replaceAll("_", " ")}
            </h2>
            <dl className="totals">
              <dt>Event reference</dt>
              <dd>{event.id}</dd>
              <dt>Recorded</dt>
              <dd>{formatBusinessDate(event.createdAt)}</dd>
              <dt>User reference</dt>
              <dd>{event.userId ?? "Not recorded"}</dd>
              <dt>Actor’s current role</dt>
              <dd>{event.user?.role.replaceAll("_", " ") ?? "Not available"}</dd>
              <dt>Record reference</dt>
              <dd>{event.entityId ?? "Not recorded"}</dd>
              <dt>Request reference</dt>
              <dd>{event.requestId ?? "Not recorded"}</dd>
            </dl>
            {href && (
              <Link className="text-link" href={href}>
                Open current record
              </Link>
            )}
            <AuditValues event={event} />
          </section>
        );
      })}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Audit log"
      />
    </>
  );
}
