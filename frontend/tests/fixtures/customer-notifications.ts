import type { Page, Route } from "@playwright/test";
import type {
  InboxNotification,
  NotificationPreference,
} from "@/lib/api/notification-schemas";
const id = (n: number) => `b3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
export const notificationItem = (n = 1): InboxNotification => ({
  id: id(n),
  title: n === 1 ? "Booking update" : "Older update",
  message: "Your account has an update.\nReview your booking for current details.",
  type: "BOOKING",
  category: "TRANSACTIONAL",
  resourceType: "Booking",
  resourceId: id(40),
  createdAt: time,
  readAt: null,
  expiresAt: null,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "notification-test" },
    },
  });
const fail = (route: Route, status = 503) =>
  route.fulfill({
    status,
    json: {
      success: false,
      message: "private server details",
      error: { code: status === 403 ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
    },
  });
export async function notificationsFixture(page: Page, role = "CUSTOMER") {
  const state = {
    role,
    items: [notificationItem()],
    preferences: [] as NotificationPreference[],
    failInbox: false,
    failStatus: 503,
    sessionUserId: id(20),
    readDelay: 0,
    slowPreferences: false,
    retryAfter: undefined as string | undefined,
    failPreferences: false,
    malformed: false,
    unknown: false,
    wrongResponse: false,
    deny: false,
    paginate: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    reads: [] as string[],
    writes: [] as { endpoint: string; body: Record<string, unknown>; csrf?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: {
          id: state.sessionUserId,
          role: state.role,
          email: "notifications@example.test",
        },
        mfaRequired: state.role !== "CUSTOMER",
        mfaVerifiedAt: state.role === "CUSTOMER" ? null : time,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-notification-csrf-".repeat(3) });
    const base = `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications`;
    if (!endpoint.startsWith(base)) return fail(route, 403);
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (
        state.readDelay &&
        (!endpoint.endsWith("/preferences/current") || state.slowPreferences)
      )
        await new Promise((resolve) => setTimeout(resolve, state.readDelay));
      if (endpoint.endsWith("/preferences/current"))
        return state.failPreferences
          ? fail(route)
          : reply(route, {
              immutableCategories: ["SECURITY", "TRANSACTIONAL"],
              preferences: state.preferences,
            });
      if (state.failInbox) return fail(route, state.failStatus);
      if (state.malformed) return reply(route, { items: [{}] });
      const selected = (
        state.paginate && url.searchParams.has("cursor")
          ? [notificationItem(2)]
          : state.items
      ).filter(
        (row) =>
          (!url.searchParams.has("type") || row.type === url.searchParams.get("type")) &&
          (!url.searchParams.has("category") ||
            row.category === url.searchParams.get("category")) &&
          (url.searchParams.get("unreadOnly") !== "true" || !row.readAt),
      );
      return reply(route, {
        items: selected,
        ...(state.paginate && !url.searchParams.has("cursor")
          ? { nextCursor: id(1) }
          : {}),
      });
    }
    state.writes.push({
      endpoint,
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
    });
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.retryAfter)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": state.retryAfter },
        json: { success: false, error: { code: "RATE_LIMITED" } },
      });
    if (state.unknown) return route.abort("connectionreset");
    if (state.deny) return fail(route, 403);
    if (endpoint.endsWith("/preferences/current")) {
      const input = request.postDataJSON();
      const saved: NotificationPreference = {
        ...input,
        consentedAt: input.category === "MARKETING" && input.enabled ? time : null,
        updatedAt: time,
      };
      state.preferences = [
        ...state.preferences.filter(
          (pref) => pref.category !== saved.category || pref.channel !== saved.channel,
        ),
        saved,
      ];
      return reply(
        route,
        state.wrongResponse
          ? { ...saved, channel: input.channel === "EMAIL" ? "SMS" : "EMAIL" }
          : saved,
      );
    }
    if (endpoint.endsWith("/read-all")) {
      const updated = state.items.filter((row) => !row.readAt).length;
      state.items = state.items.map((row) => ({ ...row, readAt: time }));
      return reply(route, state.wrongResponse ? {} : { updated });
    }
    const row = state.items.find((row) => endpoint.includes(row.id));
    if (row) {
      row.readAt = time;
      return reply(route, state.wrongResponse ? { ...row, id: id(999) } : row);
    }
    return fail(route, 403);
  });
  return state;
}
