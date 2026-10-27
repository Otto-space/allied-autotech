import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";

export const complaintFixtureId = (n: number) =>
  `bc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function workforceComplaintsFixture(page: Page) {
  const base = await workforceNotificationsFixture(page, "CUSTOMER_SERVICE");
  const branchId = base.access.assignments[0].branchId;
  const items = [
    {
      id: complaintFixtureId(1),
      branchId,
      branch: { id: branchId, name: "Stadium Road" },
      subject: "Follow-up after brake service",
      description:
        "The brake warning light returned after my visit. Please review the work carried out.",
      priority: "HIGH",
      status: "INVESTIGATING",
      version: 1,
      createdAt: "2026-10-19T08:00:00.000Z",
      updatedAt: "2026-10-19T09:00:00.000Z",
      acknowledgedAt: "2026-10-19T08:20:00.000Z",
      acknowledgementDueAt: "2026-10-19T16:00:00.000Z",
      escalatedAt: null,
      resolution: null as string | null,
      resolvedAt: null as string | null,
      closedAt: null as string | null,
    },
    {
      id: complaintFixtureId(2),
      branchId,
      branch: { id: branchId, name: "Stadium Road" },
      subject: "Collection update requested",
      description: "Please help me confirm the collection arrangements.",
      priority: "MEDIUM",
      status: "OPEN",
      version: 0,
      createdAt: "2026-10-19T09:00:00.000Z",
      updatedAt: "2026-10-19T09:00:00.000Z",
      acknowledgedAt: null,
      acknowledgementDueAt: null,
      escalatedAt: null,
      resolution: null as string | null,
      resolvedAt: null as string | null,
      closedAt: null as string | null,
    },
  ];
  const messages = [
    {
      id: complaintFixtureId(101),
      authorType: "STAFF",
      visibility: "CUSTOMER",
      body: "Please tell us when the warning appears.",
      createdAt: "2026-10-19T08:05:00.000Z",
      isOwn: false,
    },
    {
      id: complaintFixtureId(102),
      authorType: "CUSTOMER",
      visibility: "CUSTOMER",
      body: "The warning appears when I start the car.",
      createdAt: "2026-10-19T08:10:00.000Z",
      isOwn: false,
    },
  ];
  const state = {
    base,
    items,
    messages,
    reads: [] as string[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    listFailure: false,
    detailFailure: false,
    detailDenied: false,
    listMismatch: false,
    lostResponse: false,
    malformedReceipt: false,
    timeoutResponse: false,
    throttledResponse: false,
  };
  const generatedAt = "2026-10-19T10:00:00.000Z";
  await page.route("**/api/v1/staff/workforce/complaints**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic complaint fixture",
          meta: { requestId: "workforce-complaints" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code: status === 409 ? "CONFLICT" : "UNAVAILABLE",
            message: "Synthetic complaint response unavailable",
          },
        },
      });
    const id = /complaints\/([^/]+)/.exec(url.pathname)?.[1];
    const row = items.find((item) => item.id === id);
    const messageRows = [...messages].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    const latestMessageId = messageRows[0]?.id ?? null;
    if (request.method() !== "GET") {
      const body = request.postDataJSON();
      state.writes.push({ path: url.pathname, body });
      if (!row) return fail(404);
      if (
        body.expectedVersion !== row.version ||
        !["OPEN", "INVESTIGATING"].includes(row.status)
      )
        return fail(409);
      let receipt: Record<string, unknown>;
      if (url.pathname.endsWith("/replies")) {
        if (body.expectedLatestMessageId !== latestMessageId) return fail(409);
        const message = {
          id: complaintFixtureId(500 + state.writes.length),
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: body.body,
          createdAt: generatedAt,
          isOwn: true,
        };
        messages.push(message);
        receipt = {
          action: "reply",
          messageReceipt: { ...message, complaintId: row.id },
        };
      } else return fail(404);
      row.version++;
      row.updatedAt = generatedAt;
      if (state.timeoutResponse) return fail(408);
      if (state.throttledResponse) return fail(429);
      if (state.lostResponse) return route.abort("failed");
      return ok({
        ...receipt,
        id: state.malformedReceipt ? complaintFixtureId(999) : row.id,
        version: row.version,
        branchId,
        actorUserId: base.access.userId,
        access: base.access,
        generatedAt,
      });
    }
    state.reads.push(url.pathname + url.search);
    const paginate = <T extends { id: string }>(all: T[]) => {
      const cursor = url.searchParams.get("cursor"),
        offset = cursor ? all.findIndex((item) => item.id === cursor) + 1 : 0;
      const pageItems = all.slice(offset, offset + 25);
      return {
        items: pageItems,
        ...(all.length > offset + 25 ? { nextCursor: pageItems.at(-1)!.id } : {}),
      };
    };
    const term = (url.searchParams.get("q") ?? "").toLowerCase();
    if (!id) {
      if (state.listFailure) return fail(503);
      const filtered = items.filter(
        (item) =>
          (!term || `${item.subject} ${item.description}`.toLowerCase().includes(term)) &&
          (!url.searchParams.has("priority") ||
            url.searchParams.get("priority") === item.priority) &&
          (!url.searchParams.has("status") ||
            url.searchParams.get("status") === item.status),
      );
      return ok({
        ...paginate(filtered),
        access: state.listMismatch ? { ...base.access, version: 999 } : base.access,
        generatedAt,
      });
    }
    if (!row) return fail(404);
    if (state.detailDenied) return fail(403);
    if (state.detailFailure) return fail(503);
    return ok({
      ...row,
      access: base.access,
      generatedAt,
      latestMessageId,
      messages: paginate(messageRows),
    });
  });
  return state;
}
