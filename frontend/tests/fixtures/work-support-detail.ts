import type { Page } from "@playwright/test";
import { workSupportFixture, supportRecord, bookingId } from "./work-support";
import type { SupportKind } from "@/lib/api/support-schemas";
import type { SupportEmailPage } from "@/lib/api/support-email-schemas";
export { bookingId };
export const threadMessage = (n = 0) => ({
  id: bookingId(90000 + n),
  kind: (n % 3 === 1 ? "INTERNAL_NOTE" : "REPLY") as
    "INTERNAL_NOTE" | "REPLY" | "STATUS_CHANGE",
  fromStatus: null as string | null,
  toStatus: null as string | null,
  authorType: n % 3 === 2 ? "CUSTOMER" : "STAFF",
  visibility: n % 3 === 1 ? "INTERNAL" : "CUSTOMER",
  body: n % 3 === 1 ? `Private internal note ${n}` : `Conversation message ${n}`,
  createdAt: `2026-10-18T08:00:${String(n).padStart(2, "0")}.123Z`,
});
type MutableRecord = Omit<
  ReturnType<typeof supportRecord>,
  "closedAt" | "resolvedAt" | "resolution"
> & { closedAt: string | null; resolvedAt: string | null; resolution: string | null };
export async function workThreadFixture(
  page: Page,
  role = "ADMIN",
  kind: SupportKind = "complaints",
) {
  const base = await workSupportFixture(page, role),
    detail = {
      record: {
        ...supportRecord(kind),
        version: 3,
        acknowledgedAt: null,
      } as MutableRecord,
      messages: [0, 1, 2].map(threadMessage),
      emailDeliveries: {
        items: [] as SupportEmailPage["items"],
      },
      mode: "normal",
      messagesMode: "normal",
      writeMode: "normal",
      ackRace: false,
      reads: 0,
      messageReads: [] as URL[],
      writes: [] as { path: string; body: Record<string, unknown> }[],
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic conversation",
      meta: { requestId: "work-thread" },
    },
  });
  await page.route(
    "**/api/v1/staff/workforce/support-chat/channels/by-case/**",
    (route) =>
      route.fulfill(
        ok({
          channel: null,
          caseVersion: detail.record.version,
          latestPublicMessageId:
            detail.messages.findLast((message) => message.visibility === "CUSTOMER")
              ?.id ?? null,
        }),
      ),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "synthetic-conversation-token-".repeat(3) })),
  );
  await page.route("**/api/v1/staff/support/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      parts = u.pathname.split("/");
    if (parts.length < 7) return route.fallback();
    if (u.pathname.endsWith("/email-deliveries"))
      return route.fulfill(ok(detail.emailDeliveries));
    const isMessages = u.pathname.endsWith("/messages");
    if (req.method() === "GET") {
      const mode = isMessages ? detail.messagesMode : detail.mode;
      if (isMessages) detail.messageReads.push(u);
      else detail.reads++;
      if (["error", "denied", "missing"].includes(mode))
        return route.fulfill({
          status: mode === "error" ? 503 : mode === "missing" ? 404 : 403,
          json: {
            success: false,
            error: { code: mode === "error" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND" },
          },
        });
      if (!isMessages)
        return route.fulfill(
          ok(
            mode === "malformed"
              ? { id: detail.record.id }
              : mode === "mismatch"
                ? { ...detail.record, id: bookingId(999) }
                : {
                    ...detail.record,
                    messages: [
                      { body: "Embedded private fields must not become history" },
                    ],
                  },
          ),
        );
      const items =
          mode === "empty"
            ? []
            : detail.messages.slice(
                u.searchParams.has("cursor") ? 50 : 0,
                u.searchParams.has("cursor") ? 100 : 50,
              ),
        data =
          mode === "malformed"
            ? { items: [{ id: "bad" }] }
            : mode === "duplicate"
              ? {
                  items: [detail.messages[0], detail.messages[0]],
                  cursor: detail.messages[0].id,
                  hasMore: false,
                  pollAfterMs: 30000,
                }
              : {
                  items,
                  cursor: items.at(-1)?.id ?? u.searchParams.get("cursor"),
                  hasMore: !u.searchParams.has("cursor") && detail.messages.length > 50,
                  pollAfterMs: 30000,
                };
      return route.fulfill(ok(data));
    }
    const body = req.postDataJSON();
    detail.writes.push({ path: u.pathname, body });
    if (detail.writeMode === "hold")
      await new Promise<void>((resolve) => {
        detail.held = resolve;
      });
    if (["reject", "throttle"].includes(detail.writeMode))
      return route.fulfill({
        status: detail.writeMode === "reject" ? 409 : 429,
        json: { success: false, error: { code: "STALE_VERSION" } },
      });
    const stamp = "2026-10-18T10:00:37.123Z",
      createMessage = (text: unknown, visibility = "CUSTOMER") => {
        const m = {
          id: bookingId(94000 + detail.writes.length),
          kind: (visibility === "INTERNAL" ? "INTERNAL_NOTE" : "REPLY") as
            "INTERNAL_NOTE" | "REPLY" | "STATUS_CHANGE",
          fromStatus: null as string | null,
          toStatus: null as string | null,
          authorType: "STAFF",
          visibility,
          body: String(text),
          createdAt: stamp,
        };
        detail.messages.push(m);
        return { ...m, conversationId: detail.record.id, conversationKind: kind };
      };
    let data: unknown;
    if (isMessages) data = createMessage(body.message, String(body.visibility));
    else if (u.pathname.endsWith("/acknowledge")) {
      if (detail.ackRace) detail.record.acknowledgedAt = stamp;
      const added = !detail.record.acknowledgedAt;
      if (added) detail.record.acknowledgedAt = stamp;
      data = {
        ...detail.record,
        acknowledgedNow: added,
        messageReceipt: added ? createMessage(body.message) : null,
      };
    } else {
      const previousStatus = detail.record.status;
      detail.record.version++;
      if (u.pathname.endsWith("/assignment")) {
        detail.record.assignedStaffId = body.assignedStaffId as string | null;
        detail.record.assignedStaff = body.assignedStaffId
          ? { id: String(body.assignedStaffId), firstName: "Ada", lastName: "Okoro" }
          : null;
      } else if (u.pathname.endsWith("/priority"))
        detail.record.priority = String(body.priority);
      else {
        detail.record.status = String(body.status);
        if (body.status === "RESOLVED") {
          detail.record.resolvedAt = stamp;
          if (kind === "complaints") detail.record.resolution = String(body.resolution);
        }
        if (body.status === "CLOSED") detail.record.closedAt = stamp;
      }
      const event = u.pathname.endsWith("/status")
        ? createMessage(
            body.response ?? body.resolution ?? "No additional explanation was provided.",
          )
        : null;
      if (event) {
        Object.assign(detail.messages.at(-1)!, {
          kind: "STATUS_CHANGE",
          fromStatus: previousStatus,
          toStatus: detail.record.status,
        });
        Object.assign(event, {
          kind: "STATUS_CHANGE",
          fromStatus: previousStatus,
          toStatus: detail.record.status,
        });
      }
      data = { ...detail.record, messageReceipt: event };
    }
    if (detail.writeMode === "lost") return route.abort("failed");
    if (detail.writeMode === "malformed")
      return route.fulfill(ok({ id: detail.record.id }));
    if (detail.writeMode === "wrong-thread")
      data = isMessages
        ? { ...(data as object), conversationId: bookingId(999) }
        : { ...(data as object), id: bookingId(999) };
    if (detail.writeMode === "wrong-body")
      data = isMessages
        ? { ...(data as object), body: "Different body" }
        : { ...(data as object), messageReceipt: null };
    return route.fulfill({ ...ok(data), status: isMessages ? 201 : 200 });
  });
  return { ...base, detail, kind };
}
