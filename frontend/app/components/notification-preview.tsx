"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import {
  parseNotifications,
  type InboxNotification,
} from "@/lib/api/notification-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { NotificationBadge } from "./notification-badge";
import "./notification-preview.css";

export function NotificationPreview({
  customer,
  count,
  unavailable,
  pending = false,
}: {
  customer: boolean;
  count: number;
  unavailable?: boolean;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ items?: InboxNotification[]; error?: boolean }>(
    {},
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inbox = customer ? "/dashboard/notifications" : "/admin/notifications";
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const opener = trigger.current;
    element.showModal();
    return () => {
      element.close();
      opener?.focus();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // Freeze this preview until explicitly refreshed/reopened: incoming updates
    // must not reorder a row under the pointer or keyboard focus.
    void apiRequest(`/${customer ? "customers" : "staff"}/notifications?limit=5`, {
      signal: controller.signal,
    })
      .then((r) => {
        const data = parseNotifications(r.data);
        if (!controller.signal.aborted) setState({ items: data.items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ error: true });
      });
    return () => controller.abort();
  }, [open, customer, retry]);
  const close = () => setOpen(false);
  return (
    <div className="notification-preview">
      <button
        ref={trigger}
        className="dashboard-icon-link"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          pending
            ? "Open notifications, checking unread count"
            : unavailable
              ? "Open notifications, unread status unavailable"
              : count
                ? `Open notifications, ${count} unread`
                : "Open notifications"
        }
        onClick={() => {
          setState({});
          setOpen(true);
        }}
      >
        <Bell size={19} aria-hidden="true" />
        <NotificationBadge count={count} />
      </button>
      <dialog
        ref={dialog}
        className="notification-preview-dialog"
        aria-labelledby="notification-preview-title"
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const b = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < b.left ||
              event.clientX > b.right ||
              event.clientY < b.top ||
              event.clientY > b.bottom
            )
              close();
          }
        }}
      >
        <header>
          <div>
            <h2 id="notification-preview-title">Notifications</h2>
            <p>
              {pending
                ? "Checking unread count…"
                : unavailable
                  ? "Unread count unavailable"
                  : `${count} unread in your inbox`}
            </p>
          </div>
          <button
            className="np-close"
            aria-label="Close notification preview"
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="np-content">
          {state.error ? (
            <div role="alert">
              <p>Recent updates could not be loaded.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setState({});
                  setRetry((n) => n + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : !state.items ? (
            <p role="status">Loading recent updates…</p>
          ) : !state.items.length ? (
            <p>You’re up to date. Account and work updates will appear here.</p>
          ) : (
            <ul>
              {state.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${inbox}?notification=${item.id}`}
                    prefetch={false}
                    onClick={close}
                  >
                    <span className="np-status">{item.readAt ? "Read" : "Unread"}</span>
                    <strong>{item.title}</strong>
                    <span className="np-message">{item.message}</span>
                    <time dateTime={item.createdAt}>
                      {formatBusinessDate(item.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer>
          <Link href={inbox} prefetch={false} onClick={close}>
            View all notifications
          </Link>
        </footer>
      </dialog>
    </div>
  );
}
