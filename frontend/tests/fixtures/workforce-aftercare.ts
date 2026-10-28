import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
import {
  aftercareFixtureData,
  aftercareSnapshot,
  aftercareId,
} from "./workforce-aftercare-data";
export async function workforceAftercareFixture(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const base = await workforceNotificationsFixture(page, "ACCOUNTANT", role),
    data = aftercareFixtureData(base.notifications.sessionUserId, role);
  Object.assign(base.access, data.access);
  const state = {
    base,
    record: data.record,
    readMode: "normal" as "normal" | "error",
    actionMode: "normal" as "normal" | "lost" | "malformed" | "rejected",
    writes: [] as {
      body: {
        stage: "APPROVED" | "REJECTED";
        note: string;
        approvedFeeKobo?: string;
        expectedStatus: string;
        expectedRevision: string;
      };
      csrf?: string;
    }[],
    empty: false,
  };
  const snapshot = () => aftercareSnapshot(base.access, role);
  const ok = (value: unknown) => ({
    json: {
      success: true,
      data: value,
      message: "Isolated financial aftercare fixture",
      meta: { requestId: "financial-aftercare-fixture" },
    },
  });
  await page.route("**/api/v1/staff/workforce/access", (route) =>
    route.fulfill(ok(snapshot())),
  );
  await page.route("**/api/v1/staff/workforce/overview", (route) =>
    route.fulfill(
      ok({
        access: snapshot(),
        counts: {},
        generatedAt: new Date().toISOString(),
        branches: [data.record.order.branch],
      }),
    ),
  );
  await page.route(/\/api\/v1\/staff\/workforce\/aftercare(?:\/|\?|$)/, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      detailPath = `/api/v1/staff/workforce/aftercare/${state.record.id}`;
    if (req.method() === "GET") {
      if (state.readMode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      if (
        !base.access.permissions.includes("FINANCE_READ") ||
        !base.access.independentCapabilities?.includes("FINANCE_POLICY_APPROVE")
      )
        return route.fulfill({
          status: 403,
          json: { success: false, error: { code: "FORBIDDEN" } },
        });
      if (path === detailPath)
        return route.fulfill(
          ok({
            ...state.record,
            access: snapshot(),
            generatedAt: new Date().toISOString(),
          }),
        );
      if (path !== "/api/v1/staff/workforce/aftercare")
        throw Error("Unexpected synthetic financial read");
      const match =
        !state.empty &&
        (!url.searchParams.get("q") ||
          state.record.order.orderNumber
            .toLowerCase()
            .includes(url.searchParams.get("q")!.toLowerCase())) &&
        (!url.searchParams.get("kind") ||
          url.searchParams.get("kind") === state.record.kind) &&
        (!url.searchParams.get("status") ||
          url.searchParams.get("status") === state.record.status);
      return route.fulfill(
        ok({
          items: match ? [state.record] : [],
          access: snapshot(),
          generatedAt: new Date().toISOString(),
        }),
      );
    }
    if (req.method() !== "POST" || path !== `${detailPath}/decision`)
      throw Error("Unexpected synthetic financial mutation");
    const body = req.postDataJSON();
    state.writes.push({ body, csrf: req.headers()["x-csrf-token"] });
    if (
      state.actionMode === "rejected" ||
      body.expectedRevision !== state.record.reviewRevision ||
      body.expectedStatus !== state.record.status
    )
      return route.fulfill({
        status: 409,
        json: { success: false, error: { code: "CONFLICT" } },
      });
    if (
      !["APPROVED", "REJECTED"].includes(body.stage) ||
      !["REQUESTED", "RECEIVED", "INSPECTED"].includes(state.record.status)
    )
      throw Error("Invalid synthetic financial decision");
    Object.assign(state.record, {
      status: body.stage,
      reviewNote: body.note,
      approvedFeeKobo: BigInt(body.approvedFeeKobo ?? "0").toString(),
      reviewedAt: new Date().toISOString(),
      reviewEvidenceReady: false,
      reviewRevision: "b".repeat(64),
    });
    if (state.actionMode === "lost") return route.abort("failed");
    return route.fulfill(
      ok({
        id: state.record.id,
        orderId: state.record.orderId,
        branchId: state.record.order.branchId,
        status: state.record.status,
        reviewNote: state.record.reviewNote,
        approvedFeeKobo: state.record.approvedFeeKobo,
        reviewedAt: state.record.reviewedAt,
        performedByUserId:
          state.actionMode === "malformed" ? aftercareId(99) : base.access.userId,
      }),
    );
  });
  return state;
}
