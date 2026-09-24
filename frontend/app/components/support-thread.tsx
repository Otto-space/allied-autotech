"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { parseSupportRecord, type SupportKind } from "@/lib/api/support-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { SupportMessages } from "./support-messages";
import { SupportStaffActions } from "./support-staff-actions";
import { ComplaintAcknowledgement } from "./complaint-acknowledgement";
export function SupportThread({
  kind,
  id,
  staff = false,
}: {
  kind: SupportKind;
  id: string;
  staff?: boolean;
}) {
  const base = `/${staff ? "staff" : "customers"}/support/${kind}/${id}`;
  const parse = useCallback(
    (value: unknown) => {
      const record = parseSupportRecord(kind, staff, value);
      if (record.id !== id) throw new Error("Mismatched support record");
      return record;
    },
    [kind, staff, id],
  );
  const result = useResource(base, parse);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageRevision, setMessageRevision] = useState(0);
  const record = result.error ? undefined : result.data;
  return (
    <>
      <Link className="text-link" href={staff ? "/admin/support" : "/dashboard/support"}>
        Back to customer care
      </Link>
      <h1 className="support-heading">
        {record?.subject ?? (kind === "enquiries" ? "Enquiry" : "Complaint")}
      </h1>
      <Feedback message={result.error} />
      <Feedback message={message} tone="success" toast="Support update recorded." />
      {uncertain && (
        <p className="notice" role="status">
          A support change has an unknown outcome. Refresh to inspect the record. Further
          changes are paused in this view.
        </p>
      )}
      <button
        className="button secondary"
        disabled={result.loading}
        onClick={result.refresh}
      >
        Refresh record
      </button>
      {result.loading && <p role="status">Checking support record…</p>}
      {record && (
        <>
          <section
            className="detail-section support-details"
            aria-labelledby="support-detail-title"
          >
            <h2 id="support-detail-title">Record details</h2>
            <dl className="totals">
              <dt>Status</dt>
              <dd>{record.status.toLowerCase().replaceAll("_", " ")}</dd>
              <dt>Branch</dt>
              <dd>{record.branch?.name ?? "Unassigned"}</dd>
              <dt>Assigned to</dt>
              <dd>
                {record.assignedStaff
                  ? `${record.assignedStaff.firstName} ${record.assignedStaff.lastName}`
                  : "Unassigned"}
              </dd>
              {record.kind === "complaints" ? (
                <>
                  <dt>Priority</dt>
                  <dd>{record.priority.toLowerCase()}</dd>
                  <dt>Acknowledgement</dt>
                  <dd>
                    {record.acknowledgedAt === undefined
                      ? "Not available on this record"
                      : record.acknowledgedAt
                        ? `Recorded ${formatBusinessDate(record.acknowledgedAt)}`
                        : "Awaiting acknowledgement"}
                  </dd>
                  <dt>Acknowledgement target</dt>
                  <dd>
                    {record.acknowledgementDueAt
                      ? formatBusinessDate(record.acknowledgementDueAt)
                      : "Not available on this record"}
                  </dd>
                  {record.escalatedAt && (
                    <>
                      <dt>Escalated</dt>
                      <dd>{formatBusinessDate(record.escalatedAt)}</dd>
                    </>
                  )}
                </>
              ) : (
                <>
                  <dt>Enquiry type</dt>
                  <dd>{record.type.toLowerCase()}</dd>
                </>
              )}
              <dt>Created</dt>
              <dd>{formatBusinessDate(record.createdAt)}</dd>
              <dt>Last updated</dt>
              <dd>{formatBusinessDate(record.updatedAt)}</dd>
            </dl>
            <h3>Original {kind === "enquiries" ? "message" : "complaint"}</h3>
            <p className="support-text">{record.text}</p>
            {record.kind === "complaints" && record.resolution && (
              <>
                <h3>Resolution</h3>
                <p className="support-text">{record.resolution}</p>
              </>
            )}
            {record.contact && (
              <>
                <h3>Contact details</h3>
                <p>{record.contact.name}</p>
                <p>{record.contact.email}</p>
                <p>{record.contact.phone ?? "No phone number supplied"}</p>
                {!record.contact.customerId && (
                  <p>
                    This record was submitted without an account. The person cannot read
                    these messages in an account unless the backend links their record;
                    use the supplied contact details for follow-up.
                  </p>
                )}
              </>
            )}
          </section>
          {staff && record.kind === "complaints" && (
            <ComplaintAcknowledgement
              key={`${base}:${record.acknowledgedAt ?? "pending"}`}
              record={record}
              base={base}
              disabled={result.loading || !!result.error || uncertain}
              onUncertain={() => setUncertain(true)}
              onSaved={() => {
                setMessage(
                  "Complaint acknowledgement is recorded. Review the conversation for the saved response.",
                );
                setMessageRevision((value) => value + 1);
                result.refresh();
              }}
            />
          )}
          {staff && (
            <SupportStaffActions
              key={`${id}:${record.version}`}
              record={record}
              base={base}
              disabled={result.loading || !!result.error || uncertain}
              onUncertain={() => setUncertain(true)}
              onSaved={() => {
                setMessage("Support change saved.");
                setMessageRevision((value) => value + 1);
                result.refresh();
              }}
            />
          )}
          <SupportMessages
            key={base}
            refreshKey={messageRevision}
            record={record}
            base={base}
            staff={staff}
            disabled={result.loading || !!result.error || uncertain}
            onSaved={result.refresh}
            onUncertain={() => setUncertain(true)}
          />
        </>
      )}
    </>
  );
}
