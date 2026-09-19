"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  markAllReadSchema,
  notificationCategories,
  notificationSchema,
  notificationTypes,
  parseNotifications,
  type InboxNotification,
} from "@/lib/api/notification-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { NotificationPreferences } from "./notification-preferences";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
export function NotificationsPanel({
  audience = "customer",
}: {
  audience?: "customer" | "staff";
}) {
  const base = `/${audience === "staff" ? "staff" : "customers"}/notifications`;
  const [filters, setFilters] = useState({ type: "", category: "", unreadOnly: false });
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  if (filters.type) query.set("type", filters.type);
  if (filters.category) query.set("category", filters.category);
  if (filters.unreadOnly) query.set("unreadOnly", "true");
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(`${base}?${query}`, parseNotifications);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => () => pending.current?.abort(), []);
  const disabled = busy || records.loading || !!records.error || uncertain || !!proposal;
  async function readOne(item: InboxNotification) {
    if (disabled || pending.current || item.readAt) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await apiRequest(`${base}/${item.id}/read`, {
        method: "POST",
        body: {},
        csrf: true,
        signal: controller.signal,
      });
      const updated = notificationSchema.parse(response.data);
      if (updated.id !== item.id || !updated.readAt)
        throw new Error("Unconfirmed read state");
      setMessage("Notification marked as read.");
      records.refresh();
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500)
        setError(cause.message);
      else {
        setUncertain(true);
        setError(
          "The read status could not be confirmed. Refresh the inbox to inspect it. This request will not be resent here.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function reviewAll() {
    if (disabled) return;
    setMessage(undefined);
    setProposal({
      title: "Mark all notifications as read?",
      description:
        "This includes notifications outside the current filters and page, up to the moment the server handles your request.",
      facts: [{ label: "Scope", value: "Every unread notification on your account" }],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const response = await apiRequest(`${base}/read-all`, {
            method: "POST",
            body: {},
            csrf: true,
            signal: controller.signal,
          });
          const result = markAllReadSchema.parse(response.data);
          setMessage(
            `${result.updated} notification${result.updated === 1 ? "" : "s"} marked as read.`,
          );
          pagination.reset();
          records.refresh();
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Your account updates</span>
          <h1>Notifications</h1>
        </div>
      </div>
      <p className="lead">
        Read updates about your activity and choose your optional delivery preferences.
      </p>
      <section aria-labelledby="inbox-title" className="detail-section">
        <h2 id="inbox-title">Inbox</h2>
        <div className="catalogue-filters">
          {(
            [
              { name: "type", title: "Notification type", values: notificationTypes },
              {
                name: "category",
                title: "Notification category",
                values: notificationCategories,
              },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`notification-${field.name}`}>{field.title}</label>
              <select
                id={`notification-${field.name}`}
                value={filters[field.name]}
                disabled={busy || !!proposal}
                onChange={(event) => {
                  setFilters({ ...filters, [field.name]: event.target.value });
                  pagination.reset();
                  setMessage(undefined);
                }}
              >
                <option value="">All</option>
                {field.values.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              disabled={busy || !!proposal}
              onChange={(event) => {
                setFilters({ ...filters, unreadOnly: event.target.checked });
                pagination.reset();
                setMessage(undefined);
              }}
            />
            Unread only
          </label>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={records.loading || busy || !!proposal}
            onClick={records.refresh}
          >
            Refresh inbox
          </button>
          <button className="button secondary" disabled={disabled} onClick={reviewAll}>
            Mark all read
          </button>
        </div>
        <Feedback message={records.error || error} />
        <Feedback message={message} tone="success" />
        {uncertain && (
          <p className="notice" role="status">
            A read update has an unknown outcome. Further read changes are paused in this
            view. You can still refresh and inspect the inbox.
          </p>
        )}
        {records.loading && (
          <p role="status">
            {records.data ? "Refreshing notifications…" : "Loading notifications…"}
          </p>
        )}
        {!records.loading && !records.error && records.data?.items.length === 0 && (
          <p className="empty">
            {filters.type || filters.category || filters.unreadOnly || pagination.page > 1
              ? "No notifications match this page and filters."
              : "You have no notifications."}
          </p>
        )}
        <div className="notification-list">
          {records.data?.items.map((item) => (
            <article
              className="notification-item"
              key={item.id}
              aria-labelledby={`notification-${item.id}`}
            >
              <div className="actions">
                <span className="status">{item.readAt ? "Read" : "Unread"}</span>
                <span className="muted">
                  {label(item.category)} · {label(item.type)}
                </span>
              </div>
              <h3 id={`notification-${item.id}`}>{item.title}</h3>
              <p className="notification-message">{item.message}</p>
              <time dateTime={item.createdAt} className="muted">
                {formatBusinessDate(item.createdAt)}
              </time>
              {!item.readAt && (
                <div className="actions">
                  <button
                    className="button secondary"
                    disabled={disabled}
                    aria-label={`Mark ${item.title} as read`}
                    onClick={() => void readOne(item)}
                  >
                    Mark as read
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={busy || records.loading || !!records.error || !!proposal}
          label="Notification"
        />
      </section>
      <NotificationPreferences base={base} />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
