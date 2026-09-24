"use client";

export type NoticeTone = "success" | "error" | "warning" | "info";
export type ToastNotice = {
  id: number;
  message: string;
  tone: NoticeTone;
  duration: number;
  action?: { label: string; href: string };
  inlineAnnounced?: boolean;
};
const empty: readonly ToastNotice[] = [];
let notices: readonly ToastNotice[] = empty;
let nextId = 0;
const listeners = new Set<() => void>();
const recent = new Map<string, number>();
function changed() {
  for (const listener of listeners) listener();
}
export function subscribeNotices(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const noticeSnapshot = () => notices;
export const serverNoticeSnapshot = () => empty;

// Call only for a meaningful action, after its response has been validated.
// No server messages, credentials or account records are persisted.
export function notify(
  message: string,
  options: Partial<Omit<ToastNotice, "id" | "message">> = {},
) {
  if (typeof window === "undefined" || !message.trim()) return;
  const tone = options.tone ?? "info";
  const key = `${tone}:${message}`;
  const now = Date.now();
  for (const [entry, time] of recent) if (now - time > 4000) recent.delete(entry);
  if (
    recent.has(key) ||
    notices.some((notice) => notice.message === message && notice.tone === tone)
  )
    return;
  recent.set(key, now);
  const action = options.action;
  const safeAction =
    action && /^\/(?!\/)/.test(action.href) && !/[\\\r\n]/.test(action.href)
      ? action
      : undefined;
  const notice: ToastNotice = {
    id: ++nextId,
    message,
    tone,
    duration: options.duration ?? (tone === "error" || tone === "warning" ? 0 : 8000),
    action: safeAction,
    inlineAnnounced: options.inlineAnnounced,
  };
  notices = [...notices.slice(-2), notice];
  changed();
}
export function dismissNotice(id: number) {
  notices = notices.filter((notice) => notice.id !== id);
  changed();
}
export function clearNotices() {
  notices = empty;
  recent.clear();
  changed();
}
