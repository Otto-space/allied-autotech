"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseDisputeWork } from "@/lib/api/dispute-workflow";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { DisputeAssignment } from "./dispute-assignment";
import { DisputeProgress } from "./dispute-progress";
import { DisputeEvidence } from "./dispute-evidence";
export function DisputeWorkQueue() {
  const session = useAccountSession(),
    permission = useOwnStaffPermissions();
  const allowed =
    !permission.loading &&
    !permission.error &&
    permission.data?.id === session?.user.id &&
    permission.data?.role === session?.user.role &&
    permission.data?.status === "ACTIVE" &&
    permission.data?.capabilities.includes("DISPUTE_MANAGE");
  const admin = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [openOnly, setOpenOnly] = useState(true),
    [selected, setSelected] = useState<string>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [uncertain, setUncertain] = useState<Record<string, boolean>>({}),
    [message, setMessage] = useState<string>();
  const attempted = useRef(false),
    pagination = useCursorPage();
  const actorId = session?.user.id,
    actorRole = session?.user.role;
  const parseRecords = useCallback(
    (value: unknown) => {
      const parsed = parseDisputeWork(value);
      if (
        actorId &&
        actorRole === "STAFF" &&
        parsed.items.some(
          (record) => ![record.primaryUserId, record.backupUserId].includes(actorId),
        )
      )
        throw new Error("Unexpected dispute assignment");
      return parsed;
    },
    [actorId, actorRole],
  );
  const records = useResource(
    allowed
      ? `/staff/disputes?limit=25&openOnly=${openOnly}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseRecords,
  );
  const disabled = records.loading || !!records.error || !!proposal;
  function review(id: string, next: MutationProposal) {
    if (disabled || !allowed || uncertain[id]) return;
    setMessage(undefined);
    setProposal({
      ...next,
      onUncertain: () => setUncertain((current) => ({ ...current, [id]: true })),
      submit: async () => {
        attempted.current = true;
        return next.submit();
      },
    });
  }
  return (
    <>
      <h1>Dispute work queue</h1>
      <p className="lead">
        Assign operators, preserve private evidence and record provider receipts. The
        payment provider determines the dispute outcome.
      </p>
      {admin && (
        <Link className="text-link" href="/admin/payment-disputes">
          View dispute overview
        </Link>
      )}
      <Feedback message={permission.error} />
      <button
        className="button secondary"
        disabled={permission.loading || !!proposal}
        onClick={permission.refresh}
      >
        Refresh dispute permissions
      </button>
      {!allowed ? (
        permission.loading ? (
          <p role="status">Checking dispute permissions...</p>
        ) : (
          <Feedback message="An active dispute-management grant is required to use this queue." />
        )
      ) : (
        <>
          <div className="field">
            <label htmlFor="dispute-open-filter">Dispute history</label>
            <select
              id="dispute-open-filter"
              value={openOnly ? "open" : "all"}
              disabled={!!proposal}
              onChange={(event) => {
                setOpenOnly(event.target.value === "open");
                pagination.reset();
              }}
            >
              <option value="open">Open disputes</option>
              <option value="all">All disputes, including resolved</option>
            </select>
          </div>
          <Feedback message={records.error} />
          <Feedback message={message} tone="info" />
          <button
            className="button secondary"
            disabled={records.loading || !!proposal}
            onClick={records.refresh}
          >
            Refresh dispute records
          </button>
          {records.loading && <p role="status">Checking dispute records...</p>}
          {!records.loading && !records.error && !records.data?.items.length && (
            <div className="empty">
              <h2>No disputes match this view</h2>
              <p>
                {admin
                  ? "Try including resolved disputes or refresh for updates."
                  : "Only disputes assigned to you as primary or backup are shown."}
              </p>
            </div>
          )}
          {!records.error &&
            records.data?.items.map((record) => {
              const assigned =
                admin ||
                [record.primaryUserId, record.backupUserId].includes(session!.user.id);
              return (
                <section
                  className="detail-section aftercare-record"
                  key={record.id}
                  aria-labelledby={`work-${record.id}`}
                >
                  <h2 id={`work-${record.id}`}>
                    {record.provider} · {record.providerDisputeId}
                  </h2>
                  <p className="price">{formatKobo(record.amountKobo)}</p>
                  <p className="status">{record.status.replaceAll("_", " ")}</p>
                  <p>Disputed amount, not a confirmed refund or recovered balance.</p>
                  <dl className="totals">
                    <dt>Category</dt>
                    <dd>{record.category.replaceAll("_", " ")}</dd>
                    <dt>Opened</dt>
                    <dd>{formatBusinessDate(record.openedAt)}</dd>
                    <dt>Provider response deadline</dt>
                    <dd>
                      {record.responseDueAt
                        ? formatBusinessDate(record.responseDueAt)
                        : "No provider deadline recorded"}
                    </dd>
                    <dt>Acknowledgement deadline</dt>
                    <dd>
                      {record.acknowledgementDueAt
                        ? formatBusinessDate(record.acknowledgementDueAt)
                        : "No acknowledgement deadline recorded"}
                    </dd>
                    <dt>Acknowledged</dt>
                    <dd>
                      {record.acknowledgedAt
                        ? formatBusinessDate(record.acknowledgedAt)
                        : "Not yet recorded"}
                    </dd>
                    <dt>Primary operator</dt>
                    <dd>{record.primaryOperator?.label ?? "Unassigned"}</dd>
                    <dt>Backup operator</dt>
                    <dd>{record.backupOperator?.label ?? "Unassigned"}</dd>
                    <dt>Evidence preserved</dt>
                    <dd>{record.hasEvidence ? "Yes" : "No"}</dd>
                    <dt>Provider submission</dt>
                    <dd>
                      {record.respondedAt
                        ? formatBusinessDate(record.respondedAt)
                        : "Not yet recorded"}
                    </dd>
                    {record.providerSubmissionReference && (
                      <>
                        <dt>Provider receipt</dt>
                        <dd>{record.providerSubmissionReference}</dd>
                      </>
                    )}
                    {record.resolvedAt && (
                      <>
                        <dt>Resolution recorded</dt>
                        <dd>{formatBusinessDate(record.resolvedAt)}</dd>
                      </>
                    )}
                  </dl>
                  {uncertain[record.id] && (
                    <Feedback
                      tone="warning"
                      message="The outcome of a dispute change is uncertain. Refresh and reconcile the record before reloading to make another change."
                    />
                  )}
                  {assigned ? (
                    <button
                      className="button secondary"
                      disabled={disabled}
                      aria-expanded={selected === record.id}
                      onClick={() =>
                        setSelected(selected === record.id ? undefined : record.id)
                      }
                    >
                      Review dispute actions
                    </button>
                  ) : (
                    <Feedback message="This dispute is no longer assigned to your account. Refresh before continuing." />
                  )}
                  {assigned && selected === record.id && (
                    <div key={`${record.id}:${record.updatedAt}`}>
                      {!record.resolvedAt && (
                        <>
                          {admin && (
                            <DisputeAssignment
                              record={record}
                              disabled={disabled || !!uncertain[record.id]}
                              onReview={(next) => review(record.id, next)}
                            />
                          )}
                          <DisputeProgress
                            record={record}
                            actorId={session!.user.id}
                            disabled={disabled || !!uncertain[record.id]}
                            onReview={(next) => review(record.id, next)}
                          />
                        </>
                      )}
                      {record.resolvedAt && (
                        <p>
                          Resolved history is preserved. No further changes are available
                          here.
                        </p>
                      )}
                      <DisputeEvidence
                        record={record}
                        disabled={disabled || !!uncertain[record.id]}
                        onReview={(next) => review(record.id, next)}
                      />
                    </div>
                  )}
                </section>
              );
            })}
          <CursorPagination
            pagination={pagination}
            nextCursor={records.data?.nextCursor ?? undefined}
            disabled={disabled}
            label="Dispute work queue"
          />
          {proposal && (
            <MutationReview
              proposal={proposal}
              onClose={() => {
                setProposal(null);
                if (attempted.current) records.refresh();
                attempted.current = false;
              }}
              onSuccess={() =>
                setMessage(
                  "Dispute action recorded. Review the refreshed record; acknowledgement, evidence and submission are separate from provider resolution.",
                )
              }
            />
          )}
        </>
      )}
    </>
  );
}
