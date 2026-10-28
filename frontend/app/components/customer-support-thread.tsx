"use client";
import "./care-workspace.css";
import { StatusBadge } from "./status-progress";
import { CopyableValue } from "./copyable-value";
import { enquiryLabel } from "@/lib/support/enquiry-label";
import { NotificationRecordContext } from "./notification-record-context";
import { SupportTimelineEntry } from "./support-timeline-entry";

import { WorkflowProgress } from "./status-progress";
import { SupportReplyRecovery } from "./support-reply-recovery";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseSupportMessages,
  parseSupportRecord,
  type SupportKind,
  type SupportRecord,
} from "@/lib/api/support-schemas";
import { useSupportWrite } from "@/lib/support/use-support-write";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { SupportReplyForm } from "./support-reply-form";
import { SupportChannelPanel } from "./support-channel-panel";

const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function RecordDetails({ record }: { record: SupportRecord }) {
  return (
    <section className="ct-details ct-panel" aria-labelledby="ct-details-title">
      <h2 id="ct-details-title">Record details</h2>
      <WorkflowProgress
        workflow={record.kind === "enquiries" ? "enquiry" : "complaint"}
        status={record.status}
      />
      <dl>
        <div>
          <dt>Status</dt>
          <dd>
            <span className="ct-status" data-status={record.status}>
              {label(record.status)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{record.branch?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <dd>
            {record.assignedStaff
              ? `${record.assignedStaff.firstName} ${record.assignedStaff.lastName}`
              : "Unassigned"}
          </dd>
        </div>
        {record.kind === "enquiries" ? (
          <div>
            <dt>Enquiry type</dt>
            <dd>{enquiryLabel(record.type, record.vehicleEnquiryIntent)}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt>Priority</dt>
              <dd>{label(record.priority)}</dd>
            </div>
            <div>
              <dt>Acknowledgement</dt>
              <dd>
                {record.acknowledgedAt === undefined
                  ? "Not available on this record"
                  : record.acknowledgedAt
                    ? `Recorded ${formatBusinessDate(record.acknowledgedAt)}`
                    : "Awaiting acknowledgement"}
              </dd>
            </div>
            <div>
              <dt>Acknowledgement target</dt>
              <dd>
                {record.acknowledgementDueAt
                  ? formatBusinessDate(record.acknowledgementDueAt)
                  : "Not available on this record"}
              </dd>
            </div>
            {record.escalatedAt && (
              <div>
                <dt>Escalated</dt>
                <dd>{formatBusinessDate(record.escalatedAt)}</dd>
              </div>
            )}
          </>
        )}
        <div>
          <dt>Created</dt>
          <dd>{formatBusinessDate(record.createdAt)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatBusinessDate(record.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CustomerSupportThread({
  userId,
  messageId,
  kind,
  id,
}: {
  userId: string;
  messageId?: string;
  kind: SupportKind;
  id: string;
}) {
  const base = `/customers/support/${kind}/${id}`;
  const parseRecord = useCallback(
    (value: unknown) => {
      const record = parseSupportRecord(kind, false, value);
      if (record.id !== id) throw new Error("Mismatched support record");
      return record;
    },
    [kind, id],
  );
  const detail = useResource(base, parseRecord);
  const record = detail.error ? undefined : detail.data;
  const pagination = useCursorPage();
  const [selectedMessage, setSelectedMessage] = useState(messageId);
  const [latestUpdate, setLatestUpdate] = useState<string>();
  const parseMessages = useCallback(
    (value: unknown) => {
      const page = parseSupportMessages(false, value);
      if (page.hasMore && page.cursor === pagination.cursor)
        throw new Error("Message cursor did not advance");
      return page;
    },
    [pagination.cursor],
  );
  const messages = useResource(
    record
      ? `${base}/messages?limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : selectedMessage ? `&messageId=${selectedMessage}` : ""}`
      : null,
    parseMessages,
  );
  const detailUnavailable =
    detail.loading ||
    detail.refreshing ||
    !!detail.error ||
    !!detail.refreshError ||
    !record;
  const guard = useSupportWrite(
    userId,
    kind,
    {
      ...messages,
      loading: messages.loading || detailUnavailable,
      error: messages.error ?? detail.error,
      refreshError: messages.refreshError ?? detail.refreshError,
    },
    id,
  );
  const [reviewing, setReviewing] = useState(false);
  const [replyGeneration, setReplyGeneration] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const reading = messages.loading || messages.refreshing;
  const frozen = guard.busy || reviewing;
  function refreshMessages() {
    if (guard.pending) pagination.reset();
    guard.refresh();
  }
  const title = record?.subject ?? (kind === "enquiries" ? "Enquiry" : "Complaint");
  return (
    <div className="customer-conversation">
      <nav className="ct-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <Link href="/dashboard/support">Customer care</Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <span aria-current="page" title={title}>
              {title}
            </span>
          </li>
        </ol>
      </nav>
      <Link className="ct-back" href="/dashboard/support">
        <ArrowLeft aria-hidden="true" />
        Back to customer care
      </Link>
      <header className="ct-heading">
        <h1>{title}</h1>
        <button
          className="button secondary"
          disabled={detail.loading || detail.refreshing || frozen}
          onClick={detail.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh record
        </button>
      </header>
      <Feedback message={detail.error} />
      {detail.refreshError && (
        <p className="notice" role="status">
          Record details may be out of date. Refresh the record before replying.
        </p>
      )}
      <Feedback message={guard.storageError} />
      {guard.remaining > 0 && (
        <p role="status" className="notice">
          Please wait {guard.remaining} seconds before sending another reply.
        </p>
      )}
      <SupportReplyRecovery
        guard={guard}
        subject={title}
        unavailable={
          detailUnavailable ||
          messages.loading ||
          messages.refreshing ||
          !messages.data ||
          !!messages.error ||
          !!messages.refreshError
        }
        frozen={frozen}
        onReviewChange={setReviewing}
        onRecovered={() => {
          setReplyGeneration((v) => v + 1);
          setRecovered(true);
          detail.refresh();
          messages.refresh();
        }}
      />
      {recovered && (
        <Feedback
          tone="success"
          message="Original reply confirmed. Messages are shown oldest first; use Next to reach later replies."
        />
      )}
      {detail.loading && <p role="status">Checking support record…</p>}
      {record && !detailUnavailable && (
        <NotificationRecordContext
          resourceType={kind === "enquiries" ? "ENQUIRY" : "COMPLAINT"}
          resourceId={record.id}
          supportMessageIds={
            !messages.loading && !messages.error && !messages.refreshError
              ? messages.data?.items.map((message) => message.id)
              : []
          }
        />
      )}
      {record && (
        <>
          <div className="care-context">
            <StatusBadge status={record.status} />
            <CopyableValue
              value={record.id}
              display={`Reference ${record.id.slice(0, 8)}…`}
              label="Copy full case reference"
            />
            {record.status !== "CLOSED" && !detailUnavailable && !guard.disabled && (
              <a
                className="care-next"
                href="#customer-care-reply"
                onClick={(event) => {
                  const composer = document.querySelector<HTMLTextAreaElement>(
                    "#customer-care-reply textarea:not(:disabled)",
                  );
                  if (!composer) return;
                  event.preventDefault();
                  window.history.pushState(
                    window.history.state,
                    "",
                    "#customer-care-reply",
                  );
                  composer.scrollIntoView({ block: "center" });
                  composer.focus({ preventScroll: true });
                }}
              >
                Reply to this request
              </a>
            )}
          </div>
          <div className="ct-grid">
            <div className="ct-conversation-column">
              <SupportChannelPanel
                userId={userId}
                kind={kind}
                id={id}
                disabled={frozen || detailUnavailable || !!guard.pending}
                closed={record.status === "CLOSED"}
                hasBranch={!!record.branchId}
                onCaseChanged={() => {
                  detail.revalidate();
                  messages.revalidate();
                }}
                onPublicUpdate={setLatestUpdate}
              />
              <section
                className="ct-original ct-panel"
                aria-labelledby="ct-original-title"
              >
                <h2 id="ct-original-title">
                  Original {kind === "enquiries" ? "message" : "complaint"}
                </h2>
                <p className="support-text">{record.text}</p>
                {record.kind === "complaints" && record.resolution && (
                  <div className="ct-resolution">
                    <h3>Resolution</h3>
                    <p className="support-text">{record.resolution}</p>
                  </div>
                )}
              </section>
              <section
                className="ct-messages ct-panel"
                aria-labelledby="support-messages-title"
              >
                <header>
                  <h2 id="support-messages-title" tabIndex={-1}>
                    Messages
                  </h2>
                  <button
                    className="button secondary"
                    disabled={reading || frozen}
                    onClick={refreshMessages}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Refresh messages
                  </button>
                </header>
                <p className="ct-message-intro">
                  Replies and status updates appear in chronological order. Use Next for
                  later pages. Conversation availability is shown above. Updates do not
                  mark notifications as read or move your place in the history.
                </p>
                {latestUpdate && (
                  <div className="notice" role="status">
                    A new conversation update is available.{" "}
                    <button
                      className="button secondary"
                      disabled={reading || frozen}
                      onClick={() => {
                        pagination.reset();
                        setSelectedMessage(latestUpdate);
                        setLatestUpdate(undefined);
                      }}
                    >
                      View latest update
                    </button>
                  </div>
                )}
                {selectedMessage && (
                  <p className="notice">
                    Viewing the selected update and later entries.{" "}
                    <button
                      className="text-link"
                      disabled={reading || frozen}
                      onClick={() => {
                        pagination.reset();
                        setSelectedMessage(undefined);
                        document
                          .getElementById("support-messages-title")
                          ?.focus({ preventScroll: true });
                      }}
                    >
                      View full conversation
                    </button>
                  </p>
                )}
                <div className="ct-message-content">
                  <Feedback message={messages.error} />
                  {messages.refreshError && (
                    <p className="notice" role="status">
                      Messages may be out of date. Refresh messages before replying.
                    </p>
                  )}
                  {messages.loading && <p role="status">Checking messages…</p>}
                  {!messages.loading &&
                    !messages.error &&
                    messages.data?.items.length === 0 && (
                      <p className="ct-empty">No conversation updates on this page.</p>
                    )}
                  {!messages.error &&
                    messages.data?.items.map((item) => (
                      <SupportTimelineEntry
                        compact
                        key={item.id}
                        entry={item}
                        highlighted={item.id === selectedMessage}
                      />
                    ))}
                </div>
                <CursorPagination
                  pagination={pagination}
                  nextCursor={
                    !messages.error && !messages.refreshError && messages.data?.hasMore
                      ? (messages.data.cursor ?? undefined)
                      : undefined
                  }
                  disabled={reading || frozen}
                  label="Conversation messages"
                />
              </section>
            </div>
            <div className="ct-side-column" id="customer-care-reply">
              <SupportReplyForm
                key={replyGeneration}
                record={record}
                staff={false}
                base={base}
                userId={userId}
                guard={guard}
                disabled={detailUnavailable}
                keepDraftEditable={
                  (detail.refreshing || messages.refreshing) &&
                  !detail.loading &&
                  !messages.loading &&
                  !detail.error &&
                  !detail.refreshError &&
                  !messages.error &&
                  !messages.refreshError &&
                  !frozen &&
                  !guard.pending
                }
                onReviewChange={setReviewing}
                onUncertain={() => {}}
                onSaved={() => {
                  detail.refresh();
                  messages.refresh();
                }}
              />
              <details className="care-secondary">
                <summary>Request details and workflow</summary>
                <RecordDetails record={record} />
              </details>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
