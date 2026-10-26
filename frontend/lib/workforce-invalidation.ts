// Same-origin invalidation carries no role, permission, record or customer data.
// Messages only request a fresh server check and can never grant authority.
export const WORKFORCE_ACCESS_CHANGED = "aat:workforce-access-changed";
export const WORKFORCE_RECHECK = "aat:workforce-recheck";
export const WORKFORCE_CHANNEL = "aat-workforce";
let generation = 0;
let eventSource: string | undefined;
let reads = new AbortController();
export function isWorkforceRead(path: string) {
  const pathname = path.split("?")[0]!;
  return (
    pathname !== "/staff/workforce/access" &&
    (pathname.startsWith("/staff/workforce/") ||
      pathname.startsWith("/admin/workforce/") ||
      pathname.startsWith("/staff/fitment/") ||
      pathname === "/staff/notifications" ||
      pathname.startsWith("/staff/notifications/") ||
      pathname.startsWith("/learning/"))
  );
}
export function workforceReadGuard(path: string) {
  return typeof window !== "undefined" && isWorkforceRead(path)
    ? { generation, signal: reads.signal }
    : undefined;
}
export function discardWorkforceReads() {
  reads.abort(new DOMException("Work access changed", "AbortError"));
  reads = new AbortController();
  generation++;
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(WORKFORCE_ACCESS_CHANGED));
}
export function announceWorkforceRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WORKFORCE_RECHECK));
  if (typeof BroadcastChannel !== "undefined") {
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(WORKFORCE_CHANNEL);
      eventSource ??= crypto.randomUUID();
      channel.postMessage({ type: "recheck", source: eventSource });
    } catch {
      /* Polling remains the bounded fallback; the confirmed save stays confirmed. */
    } finally {
      channel?.close();
    }
  }
}
export function isExternalWorkforceRefresh(value: unknown) {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "recheck" &&
    "source" in value &&
    typeof value.source === "string" &&
    value.source !== eventSource
  );
}
