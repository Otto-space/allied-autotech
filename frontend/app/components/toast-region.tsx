"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { SESSION_CHANGED } from "@/lib/api/client";
import {
  clearNotices,
  dismissNotice,
  noticeSnapshot,
  serverNoticeSnapshot,
  subscribeNotices,
  type ToastNotice,
} from "@/lib/notifications";

const icons = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};
const labels = {
  success: "Success",
  error: "Attention needed",
  warning: "Please review",
  info: "Information",
};

function Toast({ notice }: { notice: ToastNotice }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(notice.duration);
  useEffect(() => {
    if (!notice.duration || hovered || focused) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started: number | undefined;
    function pause() {
      clearTimeout(timer);
      if (started !== undefined) remaining.current -= Date.now() - started;
      started = undefined;
    }
    function resume() {
      pause();
      if (document.visibilityState !== "visible") return;
      started = Date.now();
      timer = setTimeout(() => dismissNotice(notice.id), Math.max(0, remaining.current));
    }
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      pause();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [notice.id, notice.duration, hovered, focused]);
  const Icon = icons[notice.tone];
  return (
    <div
      className={`toast toast--${notice.tone}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Icon size={20} aria-hidden="true" />
      <div>
        <div
          role={
            notice.inlineAnnounced
              ? undefined
              : notice.tone === "error"
                ? "alert"
                : "status"
          }
          aria-atomic="true"
        >
          <strong>{labels[notice.tone]}</strong>
          <p>{notice.message}</p>
        </div>
        {notice.action && (
          <Link href={notice.action.href} onClick={() => dismissNotice(notice.id)}>
            {notice.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissNotice(notice.id)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastRegion() {
  const notices = useSyncExternalStore(
    subscribeNotices,
    noticeSnapshot,
    serverNoticeSnapshot,
  );
  useEffect(() => {
    window.addEventListener(SESSION_CHANGED, clearNotices);
    return () => window.removeEventListener(SESSION_CHANGED, clearNotices);
  }, []);
  return (
    <section className="toast-region" aria-label="Notifications">
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </section>
  );
}
