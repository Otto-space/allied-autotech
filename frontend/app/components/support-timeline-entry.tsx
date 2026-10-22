"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  GitCommitHorizontal,
  LockKeyhole,
  MessageSquare,
} from "lucide-react";
import type { z } from "zod";
import type { supportMessageSchema } from "@/lib/api/support-schemas";
import { formatBusinessDate } from "@/lib/format/date";

type Entry = z.infer<typeof supportMessageSchema> & { isOwn?: boolean };
const statusLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());

export function SupportTimelineEntry({
  entry,
  staff = false,
  highlighted = false,
  anchored = true,
}: {
  entry: Entry;
  staff?: boolean;
  highlighted?: boolean;
  anchored?: boolean;
}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlighted) {
      element.current?.scrollIntoView({ block: "center" });
      element.current?.focus({ preventScroll: true });
    }
  }, [highlighted]);
  // Defence in depth: customer components never render private notes.
  if (!staff && (entry.visibility === "INTERNAL" || entry.kind === "INTERNAL_NOTE"))
    return null;
  const internal = entry.visibility === "INTERNAL";
  const status = !internal && entry.kind === "STATUS_CHANGE";
  const type = internal
    ? "Internal note"
    : status
      ? "Status update"
      : entry.kind === "REPLY"
        ? "Reply"
        : "Message";
  const author =
    entry.authorType === "CUSTOMER"
      ? staff
        ? "Customer"
        : "You"
      : entry.authorType === "SYSTEM"
        ? "System"
        : entry.isOwn
          ? "You · Allied AutoTech team"
          : "Allied AutoTech team";
  const Icon = internal ? LockKeyhole : status ? GitCommitHorizontal : MessageSquare;
  return (
    <article
      ref={element}
      id={anchored ? `support-entry-${entry.id}` : undefined}
      tabIndex={-1}
      className={`support-timeline-entry${status ? " support-timeline-status" : ""}${internal ? " support-timeline-internal" : ""}${highlighted ? " support-timeline-selected" : ""}`}
      aria-label={`${type} from ${author}`}
    >
      <header className="support-timeline-header">
        <span className="support-timeline-type">
          <Icon size={16} aria-hidden="true" />
          {type}
        </span>
        <time dateTime={entry.createdAt}>{formatBusinessDate(entry.createdAt)}</time>
      </header>
      {status && entry.fromStatus && entry.toStatus && (
        <p className="support-timeline-transition">
          <span>{statusLabel(entry.fromStatus)}</span>
          <ArrowRight size={16} aria-hidden="true" />
          <span className="sr-only">changed to</span>
          <strong>{statusLabel(entry.toStatus)}</strong>
        </p>
      )}
      <p className="support-timeline-author">
        {author}
        {internal ? " · Staff only" : staff ? " · Customer-visible" : ""}
      </p>
      {entry.body && <p className="support-timeline-body">{entry.body}</p>}
    </article>
  );
}
