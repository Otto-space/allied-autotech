"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { BrowserPushSettings } from "./browser-push-settings";
import { NotificationAttentionQueue } from "./notification-attention-queue";
import { NotificationArrival } from "./notification-arrival";
import Link from "next/link";
import {
  customerNotificationDestination,
  staffNotificationDestination,
} from "@/lib/notifications/destinations";
import { useNotificationAccess } from "@/lib/notifications/access-context";
import {
  announceNotificationChange,
  subscribeNotificationChanges,
} from "@/lib/notifications/use-notification-summary";
import { notificationLabel as label } from "@/lib/notifications/presentation";
import { Bell, Check, RefreshCw } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  markAllReadSchema,
  notificationCategories,
  notificationSchema,
  notificationSummarySchema,
  notificationTypes,
  parseNotificationPreferences,
  parseNotifications,
  preferenceEnabled,
  type InboxNotification,
  type NotificationPreference,
} from "@/lib/api/notification-schemas";
import { usePreferenceWrite } from "@/lib/notifications/use-preference-write";
import { PreferenceRecovery } from "./preference-recovery";
import { useNotificationWrite } from "@/lib/notifications/use-notification-write";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type AccountNotificationProps = {
  userId: string;
  role?: "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN";
};
type WriteGuard = ReturnType<typeof useNotificationWrite>;

function WriteFeedback({
  guard,
  scope,
}: {
  guard: WriteGuard;
  scope: "inbox" | "preferences";
}) {
  return (
    <>
      <Feedback message={guard.storageError} />
      {guard.remaining > 0 && (
        <p role="status" className="cn-notice">
          Please wait {guard.remaining} seconds before making another change.
        </p>
      )}
      {guard.pending && (
        <div className="cn-recovery" role="status">
          <strong>
            {scope === "inbox"
              ? "A read update has an unknown outcome."
              : "The preference change could not be confirmed."}
          </strong>
          <p>
            Refresh {scope === "inbox" ? "the inbox" : "preferences"} to check the saved
            result. Further changes are paused until you review it. No request will be
            replayed automatically.
          </p>
          <button
            className="button secondary"
            disabled={!guard.canAcknowledge}
            onClick={guard.acknowledge}
          >
            {scope === "inbox" ? "I've checked the inbox" : "I've checked preferences"}
          </button>
        </div>
      )}
    </>
  );
}

function NotificationSkeleton() {
  return (
    <div role="status" aria-label="Loading notifications" className="cn-skeletons">
      <span className="sr-only">Loading notifications...</span>
      {[1, 2, 3].map((n) => (
        <div className="cn-skeleton" key={n} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function AccountNotificationPreferences({
  userId,
  role = "CUSTOMER",
}: AccountNotificationProps) {
  const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications`;
  const records = useResource(
    `${base}/preferences/current`,
    parseNotificationPreferences,
  );
  const guard = usePreferenceWrite(userId, role, records);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  function review(
    category: NotificationPreference["category"],
    channel: NotificationPreference["channel"],
    enabled: boolean,
  ) {
    if (guard.disabled || proposal) return;
    const expectedVersion =
      records.data?.preferences.find(
        (p) => p.category === category && p.channel === channel,
      )?.version ?? 0;
    setMessage(undefined);
    setProposal({
      title: `${enabled ? "Enable" : "Disable"} ${label(category)} ${channel === "EMAIL" ? "email" : "SMS"}?`,
      description:
        category === "MARKETING" && enabled
          ? "By confirming, you consent to receive marketing messages through this channel. You can turn this preference off later. Marketing delivery is not available yet."
          : "This changes optional messages before delivery. It does not recall messages already sent or change your in-app inbox.",
      facts: [
        { label: "Category", value: label(category) },
        { label: "Channel", value: channel },
        { label: "New preference", value: enabled ? "Enabled" : "Disabled" },
      ],
      retryAfterRejection: false,
      submit: async () => {
        await guard.run({ category, channel, enabled, expectedVersion });
        setMessage(
          "Delivery preference saved. Message delivery also depends on available contact details and enabled delivery services.",
        );
        records.revalidate();
      },
    });
  }
  return (
    <section className="cn-preferences" aria-labelledby="notification-preferences-title">
      <header className="cn-preferences-heading">
        <h2 id="notification-preferences-title">Delivery preferences</h2>
        <p>Choose optional delivery. Each change is reviewed before it is saved.</p>
      </header>
      <div className="cn-preferences-body">
        <BrowserPushSettings role={role} userId={userId} />
        <Feedback message={records.error} />
        <Feedback
          message={message}
          tone="success"
          toast="Notification preferences updated."
        />
        {records.refreshError && (
          <p role="alert" className="cn-notice">
            Saved preferences may be out of date. Refresh preferences before making
            changes.
          </p>
        )}
        <PreferenceRecovery
          guard={guard}
          onRecovered={(superseded) => {
            setMessage(
              superseded
                ? "Original change confirmed. A newer preference is already saved; it has been preserved."
                : "Preference change confirmed.",
            );
            records.revalidate();
          }}
        />
        {records.loading && (
          <div
            role="status"
            aria-label="Checking delivery preferences"
            className="cn-preferences-loading"
          >
            <span className="sr-only">Checking delivery preferences...</span>
            {[1, 2, 3, 4].map((n) => (
              <div className="cn-skeleton" key={n} aria-hidden="true">
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {records.refreshing && (
          <p role="status" className="cn-loading">
            Refreshing preferences...
          </p>
        )}
        {!records.loading && !records.error && records.data && (
          <div className="cn-preference-list">
            {(["OPERATIONAL", "MARKETING"] as const).flatMap((category) =>
              (["EMAIL", "SMS"] as const).map((channel) => {
                const preference = records.data?.preferences.find(
                  (p) => p.category === category && p.channel === channel,
                );
                const enabled = preferenceEnabled(category, preference);
                const title = `${category === "OPERATIONAL" ? "Service updates by" : "Marketing by"} ${channel === "EMAIL" ? "email" : "SMS"}`;
                return (
                  <article
                    className="cn-preference"
                    key={`${category}-${channel}`}
                    aria-label={title}
                  >
                    <div>
                      <h3>{title}</h3>
                      <p>
                        {enabled ? "On" : "Off"}
                        {!preference ? " (default)" : ""}
                      </p>
                      <p>
                        {category === "MARKETING"
                          ? "Not sending yet. This records a future preference only."
                          : records.data?.channels?.[
                                channel === "EMAIL" ? "email" : "sms"
                              ] === false
                            ? "Delivery is currently unavailable. Your preference is still saved."
                            : "Optional updates about your service and account activity."}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      role="switch"
                      aria-checked={enabled}
                      disabled={guard.disabled}
                      aria-label={title}
                      onClick={() => review(category, channel, !enabled)}
                    >
                      {enabled ? "On" : "Off"}
                    </button>
                  </article>
                );
              }),
            )}
          </div>
        )}
        <div className="cn-preference-notes">
          <p>
            Required security and transaction messages follow the existing delivery
            policy. These optional choices do not change them. Your in-app inbox stays
            available.
          </p>
          <p>Marketing delivery is not available yet. You can record your preference.</p>
          <p>Enabled preferences do not guarantee delivery.</p>
        </div>
        <button
          className="button secondary"
          disabled={records.loading || records.refreshing || guard.busy}
          onClick={guard.refresh}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh preferences
        </button>
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}

export function AccountNotificationInbox({
  userId,
  role = "CUSTOMER",
}: AccountNotificationProps) {
  const notificationAccess = useNotificationAccess();
  const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications`;
  const [filters, setFilters] = useState({ type: "", category: "", unreadOnly: false });
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  if (filters.type) query.set("type", filters.type);
  if (filters.category) query.set("category", filters.category);
  if (filters.unreadOnly) query.set("unreadOnly", "true");
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(`${base}?${query}`, parseNotifications);
  const summary = useResource(`${base}/summary`, notificationSummarySchema.parse);
  const revalidate = records.revalidate;
  const revalidateSummary = summary.revalidate;
  useEffect(() => subscribeNotificationChanges(userId, revalidate), [userId, revalidate]);
  useEffect(
    () => subscribeNotificationChanges(userId, revalidateSummary, true),
    [userId, revalidateSummary],
  );
  const pendingFocus = useRef<{ id: string; read: boolean } | null>(null);
  useEffect(() => {
    const desired = pendingFocus.current;
    if (
      !desired ||
      records.loading ||
      records.refreshing ||
      !records.data ||
      records.error ||
      records.refreshError
    )
      return;
    const item = records.data.items.find((row) => row.id === desired.id);
    if (item && !!item.readAt !== desired.read) return;
    pendingFocus.current = null;
    (
      document.getElementById(`notification-action-${desired.id}`) ??
      document.getElementById("inbox-title")
    )?.focus({ preventScroll: true });
  }, [
    records.data,
    records.loading,
    records.refreshing,
    records.error,
    records.refreshError,
  ]);
  const guard = useNotificationWrite(userId, "inbox", records, role);
  // The summary covers the whole inbox, including unread items outside this page/filter.
  const bulkDisabled =
    guard.disabled ||
    summary.loading ||
    summary.refreshing ||
    !!summary.error ||
    !!summary.refreshError ||
    !summary.data?.unreadCount;
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const filtered = !!(filters.type || filters.category || filters.unreadOnly);
  function clearFilters() {
    setFilters({ type: "", category: "", unreadOnly: false });
    pagination.reset();
    setMessage(undefined);
  }
  async function readOne(item: InboxNotification) {
    if (guard.disabled || proposal) return;
    const read = !item.readAt;
    setError(undefined);
    setMessage(undefined);
    try {
      await guard.run(async (signal) => {
        const updated = notificationSchema.parse(
          (
            await apiRequest(`${base}/${item.id}/${read ? "read" : "unread"}`, {
              method: "POST",
              body: {},
              csrf: true,
              signal,
            })
          ).data,
        );
        if (updated.id !== item.id || !!updated.readAt !== read)
          throw new Error("Unconfirmed read state");
        return updated;
      });
      setMessage(`Notification marked as ${read ? "read" : "unread"}.`);
      pendingFocus.current = { id: item.id, read };
      announceNotificationChange(userId);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The saved read status could not be confirmed. Refresh the inbox to check it.",
      );
    }
  }
  function reviewAll() {
    if (bulkDisabled || proposal) return;
    setError(undefined);
    setMessage(undefined);
    setProposal({
      title: "Mark all notifications as read?",
      description:
        "This includes notifications outside the current filters and page, up to the moment the server handles your request.",
      facts: [{ label: "Scope", value: "Every unread notification on your account" }],
      retryAfterRejection: false,
      submit: async () => {
        const result = await guard.run(async (signal) =>
          markAllReadSchema.parse(
            (
              await apiRequest(`${base}/read-all`, {
                method: "POST",
                body: {},
                csrf: true,
                signal,
              })
            ).data,
          ),
        );
        setMessage(
          `${result.updated} notification${result.updated === 1 ? "" : "s"} marked as read.`,
        );
        pagination.reset();
        records.refresh();
        announceNotificationChange(userId);
      },
    });
  }
  return (
    <section className="cn-inbox" aria-labelledby="inbox-title">
      <Suspense fallback={<p role="status">Opening notification…</p>}>
        <NotificationArrival role={role} />
        <NotificationAttentionQueue role={role} />
      </Suspense>
      <div className="cn-inbox-heading">
        <h2 id="inbox-title" tabIndex={-1}>
          Inbox
        </h2>
        <button
          className="button secondary"
          disabled={records.loading || records.refreshing || guard.busy}
          onClick={() => {
            if (guard.pending) clearFilters();
            guard.refresh();
            summary.refresh();
            announceNotificationChange(userId, false);
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh inbox
        </button>
      </div>
      <div className="cn-views" role="group" aria-label="Notification view">
        {[false, true].map((unreadOnly) => (
          <button
            key={String(unreadOnly)}
            className="button secondary"
            aria-pressed={filters.unreadOnly === unreadOnly}
            disabled={guard.busy || guard.pending}
            onClick={() => {
              setFilters({ ...filters, unreadOnly });
              pagination.reset();
              setMessage(undefined);
            }}
          >
            {unreadOnly ? "Unread" : "All"}
          </button>
        ))}
        <details className="cn-filter-details">
          <summary>
            More filters{filters.type || filters.category ? " (active)" : ""}
          </summary>
          <div className="cn-filters">
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
                  disabled={guard.busy || guard.pending}
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
          </div>
        </details>
      </div>
      <div className="cn-toolbar">
        <span>{filtered ? "Filtered updates" : "Latest updates"}</span>
        <div className="actions">
          {filtered && !guard.pending && (
            <button
              className="button secondary"
              disabled={guard.busy}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
          <button
            className="button secondary"
            disabled={bulkDisabled}
            onClick={reviewAll}
          >
            Mark all read
          </button>
        </div>
      </div>
      <div className="cn-feedback">
        {(summary.error || summary.refreshError) && (
          <p role="status" className="cn-notice">
            The unread total could not be checked. Bulk changes are paused.
            <button
              className="button secondary"
              onClick={summary.refresh}
              disabled={summary.loading}
            >
              Retry unread total
            </button>
          </p>
        )}
        <Feedback message={records.error || (guard.pending ? undefined : error)} />
        <Feedback message={message} tone="success" />
        {records.refreshError && (
          <p role="alert" className="cn-notice">
            These updates may be out of date. Refresh the inbox before making read
            changes.
          </p>
        )}
        {records.refreshing && (
          <p role="status" className="cn-loading">
            Refreshing notifications...
          </p>
        )}
        <WriteFeedback guard={guard} scope="inbox" />
      </div>
      {records.loading && <NotificationSkeleton />}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <div className="cn-empty">
          <Bell size={26} aria-hidden="true" />
          <h3>
            {filtered || pagination.page > 1
              ? "No notifications match this page and filters."
              : "You have no notifications."}
          </h3>
          <p>
            {filtered
              ? "Adjust your filters to see other account updates."
              : pagination.page > 1
                ? "Return to the previous page to review earlier results."
                : "Your account updates will appear here."}
          </p>
        </div>
      )}
      {!records.loading && !records.error && (
        <div className="cn-list">
          {records.data?.items.map((item) => {
            const destination =
              role === "CUSTOMER"
                ? customerNotificationDestination(item)
                : staffNotificationDestination(item, notificationAccess);
            return (
              <article
                className={`cn-item${item.readAt ? " cn-item-read" : ""}`}
                key={item.id}
                aria-labelledby={`notification-${item.id}`}
              >
                <div className="cn-row-meta">
                  <span className="cn-read-status">
                    {item.readAt ? <Check size={12} aria-hidden="true" /> : null}
                    {item.readAt ? "Read" : "Unread"}
                  </span>
                  <span>
                    {label(item.category)} · {label(item.type)}
                  </span>
                </div>
                <h3 id={`notification-${item.id}`}>{item.title}</h3>
                <p className="cn-message">{item.message}</p>
                <div className="cn-row-footer">
                  <time
                    dateTime={item.createdAt}
                    title={formatBusinessDate(item.createdAt)}
                  >
                    {formatBusinessDate(item.createdAt)}
                  </time>
                  {destination && (
                    <Link
                      className="button secondary"
                      href={destination.href}
                      prefetch={false}
                      aria-label={`${destination.label}: ${item.title}`}
                    >
                      {destination.label}
                    </Link>
                  )}
                  {
                    <button
                      className="button secondary"
                      disabled={guard.disabled}
                      id={`notification-action-${item.id}`}
                      aria-label={`Mark ${item.title} as ${item.readAt ? "unread" : "read"}`}
                      onClick={() => void readOne(item)}
                    >
                      Mark as {item.readAt ? "unread" : "read"}
                    </button>
                  }
                </div>
              </article>
            );
          })}
        </div>
      )}
      {(pagination.page > 1 || records.data?.nextCursor) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={!records.error ? records.data?.nextCursor : undefined}
          disabled={
            guard.busy ||
            guard.pending ||
            records.loading ||
            records.refreshing ||
            !!records.refreshError
          }
          label="Notification"
        />
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}
