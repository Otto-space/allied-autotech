import type { Page } from "@playwright/test";
import { fixture } from "./overview-browser";
import { overviewFixture } from "./overview";
const id = (n: number) => `ef000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function workOverviewFixture(page: Page, role = "ADMIN") {
  await fixture(page, role);
  const time = "2026-10-12T08:00:00Z";
  const state = {
    overviewMode: "normal",
    operationsMode: "normal",
    overviewReads: [] as URL[],
    operationsReads: 0,
    writes: [] as string[],
    operations: {
      queues: [
        { queue: "identity_outbox", status: "PENDING", count: 4 },
        { queue: "payment_webhook_retry", status: "FAILED", count: 2 },
      ],
      openPaymentAnomalies: 0,
      lastReconciliation: {
        status: "COMPLETED",
        periodStart: time,
        periodEnd: time,
        differenceCount: 0,
        startedAt: time,
        completedAt: time,
      },
      workers: [
        {
          name: "notification-delivery",
          missing: false,
          overdue: false,
          staleAfterMs: 600000,
          lastStartedAt: time,
          lastSucceededAt: time,
          lastFailedAt: null,
        },
        {
          name: "refunds",
          missing: false,
          overdue: true,
          staleAfterMs: 600000,
          lastStartedAt: time,
          lastSucceededAt: time,
          lastFailedAt: time,
        },
        { name: "media-cleanup", missing: true, overdue: true, staleAfterMs: 600000 },
      ],
      operationalAlerts: [
        {
          id: id(1),
          category: "PAYMENT_REVIEW",
          message: "A synthetic payment requires review.",
          createdAt: time,
          key: "private-key-not-rendered",
          resourceId: id(2),
        },
      ],
    },
  };
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      state.writes.push(request.url());
  });
  await page.route("**/api/v1/staff/overview?*", async (route) => {
    const url = new URL(route.request().url());
    state.overviewReads.push(url);
    if (state.overviewMode === "error" || state.overviewMode === "denied")
      return route.fulfill({
        status: state.overviewMode === "denied" ? 403 : 503,
        json: {
          success: false,
          error: {
            code: state.overviewMode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE",
          },
        },
      });
    const data = overviewFixture(
      role,
      { from: url.searchParams.get("from")!, to: url.searchParams.get("to")! },
      state.overviewMode === "empty",
    );
    if (state.overviewMode === "range") data.range.from = "2000-01-01";
    if (state.overviewMode === "scope") data.scope = "CUSTOMER";
    if (state.overviewMode === "branch") data.branch = null;
    if (state.overviewMode === "finance")
      data.finance = {
        payments: [{ amountKobo: "999999999", currency: "NGN", count: 1 }],
        refunds: [],
      };
    if (state.overviewMode === "long") {
      data.recentBookings[0].serviceName =
        "Comprehensive vehicle diagnostics and advanced electrical fault investigation";
      data.recentOrders[0].orderNumber = "AAT-2026-VERY-LONG-ORDER-REFERENCE-1234567890";
    }
    await route.fulfill({
      json: {
        success: true,
        message: "Isolated work overview",
        meta: { requestId: "work-overview-qa" },
        data,
      },
    });
  });
  await page.route("**/api/v1/admin/operations/status", async (route) => {
    state.operationsReads++;
    if (["error", "denied"].includes(state.operationsMode))
      return route.fulfill({
        status: state.operationsMode === "denied" ? 403 : 503,
        json: {
          success: false,
          error: {
            code:
              state.operationsMode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE",
          },
        },
      });
    let data: unknown = state.operations;
    if (state.operationsMode === "empty")
      data = {
        queues: [],
        openPaymentAnomalies: 0,
        lastReconciliation: null,
        workers: [],
        operationalAlerts: [],
      };
    if (state.operationsMode === "legacy")
      data = { queues: [], openPaymentAnomalies: 0, lastReconciliation: null };
    if (state.operationsMode === "invalid")
      data = { ...state.operations, workers: [{ name: "bad", missing: "false" }] };
    await route.fulfill({
      json: {
        success: true,
        message: "Isolated work overview",
        meta: { requestId: "work-overview-qa" },
        data,
      },
    });
  });
  return state;
}
