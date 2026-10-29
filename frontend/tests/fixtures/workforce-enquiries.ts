import type { Page } from "@playwright/test";
import type { SupportEmailPage } from "@/lib/api/support-email-schemas";
import { workforceNotificationsFixture } from "./workforce-notifications";

export const enquiryFixtureId = (n: number) =>
  `bb000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function workforceEnquiriesFixture(
  page: Page,
  template:
    "CUSTOMER_SERVICE" | "SALES_SUPERVISOR" | "SALES_CASHIER" = "SALES_SUPERVISOR",
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const base = await workforceNotificationsFixture(page, template, role);
  const branchId = base.access.assignments[0].branchId;
  const items = [
    {
      id: enquiryFixtureId(1),
      branchId,
      branch: { id: branchId, name: "Stadium Road" },
      subject: "Toyota Corolla inspection",
      message:
        "I would like to inspect the Toyota Corolla. Is a Saturday appointment available?",
      type: "VEHICLE",
      status: "OPEN",
      version: 0,
      assignedStaffId: base.access.staffId,
      assignedStaff: { id: base.access.staffId, firstName: "Ada", lastName: "Okoro" },
      createdAt: "2026-10-19T08:00:00.000Z",
      updatedAt: "2026-10-19T08:00:00.000Z",
    },
    {
      id: enquiryFixtureId(2),
      branchId,
      branch: { id: branchId, name: "Stadium Road" },
      subject: "Brake pad compatibility",
      message: "Please confirm whether these brake pads fit a 2020 Honda Accord.",
      type: "PRODUCT",
      status: "IN_PROGRESS",
      version: 1,
      assignedStaffId: base.access.staffId,
      assignedStaff: { id: base.access.staffId, firstName: "Ada", lastName: "Okoro" },
      createdAt: "2026-10-18T14:00:00.000Z",
      updatedAt: "2026-10-19T08:30:00.000Z",
    },
  ];

  const messages = [
    {
      id: enquiryFixtureId(101),
      authorType: "STAFF",
      visibility: "CUSTOMER",
      body: "Please let us know your preferred time.",
      createdAt: "2026-10-19T08:05:00.000Z",
      isOwn: false,
    },
    {
      id: enquiryFixtureId(102),
      authorType: "CUSTOMER",
      visibility: "CUSTOMER",
      body: "Would 10:00 work?",
      createdAt: "2026-10-19T08:10:00.000Z",
      isOwn: false,
    },
  ];
  const candidates = [
    { id: base.access.staffId!, firstName: "Ada", lastName: "Okoro" },
    { id: enquiryFixtureId(4), firstName: "Chidi", lastName: "Eze" },
  ];
  const state = {
    base,
    items,
    messages,
    candidates,
    reads: [] as string[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    listFailure: false,
    detailFailure: false,
    detailDenied: false,
    customerId: null as string | null,
    listMismatch: false,
    candidateFailure: false,
    candidateMismatch: false,
    lostResponse: false,
    malformedReceipt: false,
    emailDeliveries: { items: [] } as SupportEmailPage,
  };
  const generatedAt = "2026-10-19T10:00:00.000Z";
  await page.route("**/api/v1/staff/workforce/enquiries**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic enquiry fixture",
          meta: { requestId: "workforce-enquiries" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code: status === 409 ? "CONFLICT" : "UNAVAILABLE",
            message: "Synthetic enquiry response unavailable",
          },
        },
      });
    const id = /enquiries\/([^/]+)/.exec(url.pathname)?.[1];
    const row = items.find((item) => item.id === id);
    const messageRows = [...messages].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    const latestMessageId = messageRows[0]?.id ?? null;
    if (request.method() !== "GET") {
      const body = request.postDataJSON();
      state.writes.push({ path: url.pathname, body });
      if (!row) return fail(404);
      if (url.pathname.endsWith("/email-deliveries/dismiss")) {
        state.emailDeliveries.items = state.emailDeliveries.items.map((item) => ({
          ...item,
          noticeDismissed:
            body.notices.some(
              (n: { id: string; revision: string }) =>
                n.id === item.id && n.revision === item.noticeRevision,
            ) || item.noticeDismissed,
        }));
        return ok(state.emailDeliveries);
      }
      if (
        body.expectedVersion !== row.version ||
        !["OPEN", "IN_PROGRESS"].includes(row.status)
      )
        return fail(409);
      const beforeStaff = row.assignedStaffId;
      let receipt: Record<string, unknown>;
      if (url.pathname.endsWith("/replies")) {
        if (body.expectedLatestMessageId !== latestMessageId) return fail(409);
        const message = {
          id: enquiryFixtureId(500 + state.writes.length),
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: body.body,
          createdAt: generatedAt,
          isOwn: true,
        };
        messages.push(message);
        receipt = { action: "reply", messageReceipt: { ...message, enquiryId: row.id } };
      } else if (url.pathname.endsWith("/assignment")) {
        const target = candidates.find((candidate) => candidate.id === body.staffId);
        if (!target) return fail(409);
        row.assignedStaffId = target.id;
        row.assignedStaff = target;
        receipt = {
          action: "assignment",
          assignmentReceipt: {
            staffId: target.id,
            previousStaffId: beforeStaff,
            reason: body.reason,
          },
        };
      } else return fail(404);
      row.version++;
      row.updatedAt = generatedAt;
      if (state.lostResponse) return route.abort("failed");
      return ok({
        ...receipt,
        id: state.malformedReceipt ? enquiryFixtureId(999) : row.id,
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
          (!term || `${item.subject} ${item.message}`.toLowerCase().includes(term)) &&
          (!url.searchParams.has("type") || url.searchParams.get("type") === item.type) &&
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
    if (url.pathname.endsWith("/assignees")) {
      if (state.candidateFailure) return fail(503);
      return ok({
        ...paginate(
          candidates.filter((c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(term),
          ),
        ),
        enquiryId: row.id,
        enquiryVersion: state.candidateMismatch ? row.version + 1 : row.version,
        branchId,
        access: base.access,
        generatedAt,
      });
    }
    if (state.detailDenied) return fail(403);
    if (state.detailFailure) return fail(503);
    return ok({
      ...row,
      ...(template === "CUSTOMER_SERVICE"
        ? {
            contact: {
              name: "Synthetic customer",
              email: "care-fixture@example.test",
              phone: null,
              customerId: state.customerId,
            },
          }
        : {}),
      emailDeliveries: state.emailDeliveries,
      access: base.access,
      generatedAt,
      latestMessageId,
      messages: paginate(messageRows),
    });
  });
  return state;
}
