import { type Page, type Route } from "@playwright/test";

const id = (n: number) => `d5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const branch = { id: id(2), code: "TEST", name: "Test handling branch", isActive: true };
const staff = { id: id(3), firstName: "Test", lastName: "Handler", branchId: id(2) };
const profile = {
  id: id(4),
  email: "staff@example.test",
  role: "STAFF",
  status: "ACTIVE",
  staffProfile: staff,
};
const message = (n = 10, visibility = "CUSTOMER") => ({
  id: id(n),
  authorType: "STAFF",
  visibility,
  body: `Isolated reply ${n}`,
  createdAt: time,
});
export const supportRow = (kind = "enquiries") => ({
  id: id(kind === "enquiries" ? 1 : 5),
  branchId: id(2),
  assignedStaffId: null as string | null,
  subject: kind === "enquiries" ? "Test enquiry" : "Test complaint",
  version: 0,
  createdAt: time,
  updatedAt: time,
  resolvedAt: null as string | null,
  closedAt: null as string | null,
  branch,
  assignedStaff: null as typeof staff | null,
  type: "GENERAL",
  status: "OPEN",
  message: "Original test enquiry",
  description: "Original test complaint",
  resolution: null as string | null,
  priority: "MEDIUM",
  productId: null as string | null,
  serviceId: null as string | null,
  bookingId: null as string | null,
  quoteId: null as string | null,
  vehicleListingId: null as string | null,
  orderId: null as string | null,
  vehicleTransactionId: null as string | null,
  name: "Test Customer",
  email: "private@example.test",
  phone: null,
  customerId: id(8) as string | null,
  messages: [message(99, "INTERNAL")],
});
const ok = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "support-test" },
    },
  });
const fail = (route: Route, status = 503, code = "DATABASE_UNAVAILABLE") =>
  route.fulfill({
    status,
    json: { success: false, message: "Private server exception", error: { code } },
  });
export async function customerSupportFixture(page: Page, role = "CUSTOMER") {
  const state = {
    userId: id(21),
    sessionRole: role,
    failSession: false,
    failBranch: false,
    rateLimit: false,
    delayList: false,
    releaseList: [] as (() => void)[],
    rows: undefined as ReturnType<typeof supportRow>[] | undefined,
    records: { enquiries: supportRow(), complaints: supportRow("complaints") },
    messages: [message()],
    hasMore: false,
    listMore: false,
    empty: false,
    failList: false,
    failDetail: false,
    failMessages: false,
    failMessagesStatus: 403,
    failMessageCursor: false,
    delayMessages: false,
    releaseMessages: [] as (() => void)[],
    failSource: false,
    unknown: false,
    loseCommittedCreateOnce: false,
    loseCommittedReplyOnce: false,
    replyReceipts: new Map<
      string,
      { body: unknown; endpoint: string; saved: ReturnType<typeof message> }
    >(),
    receipts: new Map<
      string,
      { body: Record<string, unknown>; kind: "enquiries" | "complaints" }
    >(),
    hold: false,
    releases: [] as (() => void)[],
    contradictory: false,
    stale: false,
    reads: [] as string[],
    writes: [] as {
      endpoint: string;
      body: Record<string, unknown>;
      csrf?: string;
      key?: string;
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return state.failSession
        ? fail(route)
        : ok(route, {
            id: id(20),
            user: {
              id: state.userId,
              role: state.sessionRole,
              email: "support@example.test",
            },
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : time,
          });
    if (endpoint === "/auth/csrf")
      return ok(route, { csrfToken: "isolated-support-csrf-".repeat(3) });
    const match = endpoint.match(
      /^\/(customers|staff|public)\/support\/(enquiries|complaints)(?:\/([^/]+))?(?:\/(messages|assignment|status|priority))?$/,
    );
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (endpoint === "/public/branches" || endpoint === "/admin/branches")
        return state.failBranch ? fail(route) : ok(route, { items: [branch] });
      if (endpoint === "/admin/staff") return ok(route, { items: [profile] });
      if (endpoint === "/staff/profile") return ok(route, profile);
      if (match) {
        const record = state.records[match[2] as keyof typeof state.records];
        if (match[4] === "messages") {
          if (state.delayMessages)
            await new Promise<void>((resolve) => state.releaseMessages.push(resolve));
          if (
            state.failMessages ||
            (state.failMessageCursor && url.searchParams.has("cursor"))
          )
            return fail(
              route,
              state.failMessagesStatus,
              state.failMessagesStatus === 403 ? "FORBIDDEN" : "DATABASE_UNAVAILABLE",
            );
          const items = url.searchParams.has("cursor") ? [message(11)] : state.messages;
          return ok(route, {
            items,
            cursor: items.at(-1)?.id ?? null,
            hasMore: state.hasMore && !url.searchParams.has("cursor"),
            pollAfterMs: 5000,
          });
        }
        if (match[3])
          return state.failDetail ? fail(route, 403, "FORBIDDEN") : ok(route, record);
        if (state.delayList)
          await new Promise<void>((resolve) => state.releaseList.push(resolve));
        if (state.failList) return fail(route);
        return ok(route, {
          items:
            state.empty || url.searchParams.has("cursor")
              ? []
              : (state.rows ?? [record]).filter(
                  (item) =>
                    !url.searchParams.get("status") ||
                    item.status === url.searchParams.get("status"),
                ),
          ...(state.listMore && !url.searchParams.has("cursor")
            ? { nextCursor: record.id }
            : {}),
        });
      }
      if (state.failSource) return fail(route);
      const sources: Record<string, unknown[]> = {
        "/public/catalog/products": [{ id: id(30), name: "Test part" }],
        "/public/services": [{ id: id(31), name: "Test service" }],
        "/public/vehicles": [{ id: id(32), title: "Test vehicle" }],
        "/customers/bookings": [
          {
            id: id(33),
            service: { id: id(31), name: "Test booked service" },
            scheduledAt: time,
            branch,
            quotes: [{ id: id(34), quoteNumber: "TEST-QUOTE", status: "DRAFT" }],
          },
        ],
        "/customers/orders": [{ id: id(35), orderNumber: "TEST-ORDER" }],
        "/customers/vehicle-transactions": [
          {
            id: id(36),
            transactionNumber: "TEST-SALE",
            vehicleListing: { title: "Test purchased vehicle" },
          },
        ],
      };
      if (sources[endpoint]) return ok(route, { items: sources[endpoint] });
      return ok(route, { items: [] });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    const key = request.headers()["idempotency-key"];
    state.writes.push({ endpoint, body, csrf: request.headers()["x-csrf-token"], key });
    if (state.hold) await new Promise<void>((resolve) => state.releases.push(resolve));
    if (state.rateLimit)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "2" },
        json: { success: false, error: { code: "RATE_LIMITED" } },
      });
    if (state.unknown) return fail(route);
    if (state.stale) return fail(route, 409, "CONFLICT");
    if (match) {
      const record = state.records[match[2] as keyof typeof state.records];
      if (!match[3]) {
        if (match[1] === "public")
          return ok(route, {
            id: record.id,
            status: "OPEN",
            createdAt: time,
            priority: "MEDIUM",
          });
        if (key && state.receipts.has(key)) {
          const prior = state.receipts.get(key)!;
          if (JSON.stringify(prior.body) !== JSON.stringify(body))
            return fail(route, 409, "IDEMPOTENCY_CONFLICT");
          return ok(route, { ...state.records[prior.kind], replayed: true });
        }
        Object.assign(record, body);
        if (state.contradictory) record.type = "PRODUCT";
        if (key)
          state.receipts.set(key, { body, kind: match[2] as "enquiries" | "complaints" });
        if (state.loseCommittedCreateOnce) {
          state.loseCommittedCreateOnce = false;
          return fail(route);
        }
        return ok(route, { ...record, replayed: false });
      }
      if (match[4] === "messages") {
        if (match[1] === "customers" && key && state.replyReceipts.has(key)) {
          const receipt = state.replyReceipts.get(key)!;
          if (
            receipt.endpoint !== endpoint ||
            JSON.stringify(receipt.body) !== JSON.stringify(body)
          )
            return fail(route, 409, "IDEMPOTENCY_CONFLICT");
          return ok(route, { ...receipt.saved, replayed: true });
        }
        if (record.status === "CLOSED") return fail(route, 409, "CONFLICT");
        const saved = {
          ...message(12),
          body: String(body.message),
          visibility: String(body.visibility ?? "CUSTOMER"),
          authorType: match[1] === "staff" ? "STAFF" : "CUSTOMER",
        };
        if (state.contradictory) saved.visibility = "INTERNAL";
        state.messages.push(saved);
        if (match[1] === "customers" && key)
          state.replyReceipts.set(key, { body, endpoint, saved });
        if (state.loseCommittedReplyOnce) {
          state.loseCommittedReplyOnce = false;
          return fail(route);
        }
        return ok(route, { ...saved, replayed: false });
      }
      Object.assign(record, body, { version: record.version + 1 });
      if (match[4] === "assignment")
        record.assignedStaff = body.assignedStaffId ? staff : null;
      if (state.contradictory) record.version--;
      return ok(route, record);
    }
    return fail(route, 404, "NOT_FOUND");
  });
  return state;
}
