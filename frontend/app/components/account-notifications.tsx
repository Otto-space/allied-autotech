"use client";

import { Suspense, useState } from "react";
import { BrowserPushSettings } from "./browser-push-settings";
import { NotificationAttentionQueue } from "./notification-attention-queue";
import { NotificationArrival } from "./notification-arrival";
import Link from "next/link";
import {
  customerNotificationDestination,
  staffNotificationDestination,
} from "@/lib/notifications/destinations";
import { useNotificationAccess } from "@/lib/notifications/access-context";
import { announceNotificationChange } from "@/lib/notifications/use-notification-summary";
import { Bell, Check, RefreshCw } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  markAllReadSchema,
  notificationCategories,
  notificationSchema,
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
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
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
          : "This changes your preference for future optional messages. It does not recall messages already queued for delivery or change in-app notifications.",
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
        records.refresh();
      },
    });
  }
  return (
    <section className="cn-preferences" aria-labelledby="notification-preferences-title">
      <header className="cn-preferences-heading">
        <h2 id="notification-preferences-title">Delivery preferences</h2>
        <p>Choose optional email and SMS updates.</p>
      </header>
      <div className="cn-preferences-body">
        <BrowserPushSettings role={role} />
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
            records.refresh();
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
                const title = `${category === "OPERATIONAL" ? "Operational" : "Marketing"} ${channel === "EMAIL" ? "email" : "SMS"}`;
                return (
                  <article
                    className="cn-preference"
                    key={`${category}-${channel}`}
                    aria-label={title}
                  >
                    <div>
                      <h3>{title}</h3>
                      <p>
                        {enabled ? "Enabled" : "Disabled"}
                        {!preference ? " (default)" : ""}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      disabled={guard.disabled}
                      aria-label={`${enabled ? "Disable" : "Enable"} ${title.toLowerCase()}`}
                      onClick={() => review(category, channel, !enabled)}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                  </article>
                );
              }),
            )}
          </div>
        )}
        <div className="cn-preference-notes">
          <p>
            Security and transactional messages stay on. In-app updates are unchanged.
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
  const guard = useNotificationWrite(userId, "inbox", records, role);
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
    if (guard.disabled || proposal || item.readAt) return;
    setError(undefined);
    setMessage(undefined);
    try {
      await guard.run(async (signal) => {
        const updated = notificationSchema.parse(
          (
            await apiRequest(`${base}/${item.id}/read`, {
              method: "POST",
              body: {},
              csrf: true,
              signal,
            })
          ).data,
        );
        if (updated.id !== item.id || !updated.readAt)
          throw new Error("Unconfirmed read state");
        return updated;
      });
      setMessage("Notification marked as read.");
      announceNotificationChange(userId);
      records.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The saved read status could not be confirmed. Refresh the inbox to check it.",
      );
    }
  }
  function reviewAll() {
    if (guard.disabled || proposal) return;
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
        <h2 id="inbox-title">Inbox</h2>
        <button
          className="button secondary"
          disabled={records.loading || records.refreshing || guard.busy}
          onClick={() => {
            if (guard.pending) clearFilters();
            guard.refresh();
            announceNotificationChange(userId);
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh inbox
        </button>
      </div>
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
        <label className="check-label">
          <input
            type="checkbox"
            checked={filters.unreadOnly}
            disabled={guard.busy || guard.pending}
            onChange={(event) => {
              setFilters({ ...filters, unreadOnly: event.target.checked });
              pagination.reset();
              setMessage(undefined);
            }}
          />
          Unread only
        </label>
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
            disabled={guard.disabled}
            onClick={reviewAll}
          >
            Mark all read
          </button>
        </div>
      </div>
      <div className="cn-feedback">
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
                  <time dateTime={item.createdAt}>
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
                  {!item.readAt && (
                    <button
                      className="button secondary"
                      disabled={guard.disabled}
                      aria-label={`Mark ${item.title} as read`}
                      onClick={() => void readOne(item)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
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
