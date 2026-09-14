"use client";
import { CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { Notification, Page } from "@/lib/api/types";
import { Feedback } from "./feedback";
export function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    const r = await apiRequest<Page<Notification>>("/customers/notifications?limit=100");
    setItems(r.data?.items ?? []);
  }
  useEffect(() => {
    let active = true;
    void apiRequest<Page<Notification>>("/customers/notifications?limit=100")
      .then((r) => {
        if (active) setItems(r.data?.items ?? []);
      })
      .catch((error_) => {
        if (active)
          setError(
            error_ instanceof Error
              ? error_.message
              : "Notifications could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function readAll() {
    try {
      await apiRequest<never>("/customers/notifications/read-all", {
        method: "POST",
        csrf: true,
        body: {},
      });
      await load();
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Notifications could not be updated.",
      );
    }
  }
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">In-app updates</span>
          <h1>Notifications.</h1>
        </div>
        <button className="button secondary" onClick={() => void readAll()}>
          <CheckCheck size={16} />
          Mark all read
        </button>
      </div>
      <Feedback message={error} />
      <div className="list">
        {items.map((n) => (
          <article className="list-item" key={n.id}>
            <div>
              <h3>{n.title}</h3>
              <p>{n.message}</p>
              <span className="muted">
                {new Date(n.createdAt).toLocaleString("en-NG")}
              </span>
            </div>
            {!n.readAt && <span className="status">Unread</span>}
          </article>
        ))}
      </div>
      {items.length === 0 && <div className="empty">You have no notifications.</div>}
    </>
  );
}
