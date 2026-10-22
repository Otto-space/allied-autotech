"use client";
import { SupportTimelineEntry } from "./support-timeline-entry";
import { useCallback } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseSupportMessages, type SupportRecord } from "@/lib/api/support-schemas";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { SupportReplyForm } from "./support-reply-form";
export function SupportMessages({
  record,
  base,
  staff,
  disabled,
  onSaved,
  refreshKey,
  onUncertain,
}: {
  record: SupportRecord;
  base: string;
  staff: boolean;
  disabled: boolean;
  onSaved: () => void;
  refreshKey?: number;
  onUncertain: () => void;
}) {
  const pagination = useCursorPage();
  const parse = useCallback(
    (value: unknown) => {
      const result = parseSupportMessages(staff, value);
      if (result.hasMore && result.cursor === pagination.cursor)
        throw new Error("Message cursor did not advance");
      return result;
    },
    [staff, pagination.cursor],
  );
  const messages = useResource(
    `${base}/messages?limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
    undefined,
    { refreshKey },
  );
  return (
    <>
      <section className="detail-section" aria-labelledby="support-messages-title">
        <h2 id="support-messages-title">Messages</h2>
        <p>
          Replies and status updates appear in chronological order. Use Next for later
          pages, and refresh this page to check for updates. This is not a live-agent
          chat.
        </p>
        <button
          className="button secondary"
          disabled={messages.loading}
          onClick={messages.refresh}
        >
          Refresh messages
        </button>
        <Feedback message={messages.error} />
        {messages.loading && <p role="status">Checking messages…</p>}
        {!messages.loading && !messages.error && messages.data?.items.length === 0 && (
          <p>No conversation updates on this page.</p>
        )}
        <div className="support-message-list">
          {!messages.error &&
            messages.data?.items.map((item) => (
              <SupportTimelineEntry key={item.id} entry={item} staff={staff} />
            ))}
        </div>
        <CursorPagination
          pagination={pagination}
          nextCursor={
            messages.data?.hasMore ? (messages.data.cursor ?? undefined) : undefined
          }
          disabled={messages.loading || !!messages.error}
          label="Conversation messages"
        />
      </section>
      <SupportReplyForm
        record={record}
        staff={staff}
        base={base}
        onUncertain={onUncertain}
        disabled={disabled || messages.loading || !!messages.error}
        onSaved={() => {
          messages.refresh();
          onSaved();
        }}
      />
    </>
  );
}
