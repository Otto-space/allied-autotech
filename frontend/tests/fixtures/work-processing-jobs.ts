import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { CurrentJob } from "@/lib/admin/work-processing-jobs";
export { id };
export function jobRow(
  n = 0,
  source: "OUTBOX" | "PAYMENT_WEBHOOK" = "OUTBOX",
): CurrentJob {
  const at = new Date(Date.parse("2026-10-19T08:30:00.000Z") - n * 60000).toISOString();
  const common = {
    id: id(400000 + n),
    eventType: "notification.delivery.requested",
    status: "FAILED" as const,
    lockedAt: null,
    updatedAt: at,
  };
  return source === "OUTBOX"
    ? {
        ...common,
        source,
        eventId: id(401000 + n),
        aggregateType: "NOTIFICATION",
        aggregateId: id(402000 + n),
        attempts: n === 1 ? 0 : 3,
        availableAt: at,
        createdAt: at,
        publishedAt: null,
      }
    : {
        ...common,
        source,
        processingAttempts: 3,
        receivedAt: at,
        nextAttemptAt: null,
        processedAt: null,
        failedAt: at,
      };
}
export async function workJobsFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = {
    base,
    rows: [
      jobRow(0),
      { ...jobRow(1), status: "DEAD_LETTER" } as CurrentJob,
      {
        ...jobRow(2),
        status: "PROCESSING",
        lockedAt: "2026-10-19T08:28:00.000Z",
      } as CurrentJob,
    ],
    mode: "normal",
    reads: [] as URL[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
  };
  await page.route("**/api/v1/admin/operations/jobs**", async (route) => {
    const url = new URL(route.request().url()),
      parts = url.pathname.split("/"),
      selected = parts.length > 6,
      source = parts[6] === "outbox" ? "OUTBOX" : "PAYMENT_WEBHOOK",
      row = state.rows.find((r) => r.id === parts[7] && r.source === source);
    const reply = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic job QA",
          data,
          meta: { requestId: "work-jobs-fixture" },
        },
      });
    if (route.request().method() === "GET") {
      state.reads.push(url);
      if (["error", "denied"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "denied" ? 403 : 503,
          json: {
            success: false,
            error: {
              code: state.mode === "denied" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
            },
          },
        });
      if (selected)
        return row
          ? reply(row)
          : route.fulfill({
              status: 404,
              json: { success: false, error: { code: "NOT_FOUND" } },
            });
      let rows = state.rows.filter(
        (r) =>
          ["FAILED", "DEAD_LETTER", "PROCESSING"].includes(r.status) &&
          (!url.searchParams.has("source") ||
            r.source === url.searchParams.get("source")) &&
          (!url.searchParams.has("status") ||
            r.status === url.searchParams.get("status")),
      );
      const offset = url.searchParams.has("cursor")
        ? Number(url.searchParams.get("cursor")!.slice(-6))
        : 0;
      rows = rows.slice(offset);
      const items = rows.slice(0, 25).map((row) => {
        const rest = Object.fromEntries(
          Object.entries(row).filter(
            ([key]) => !["publishedAt", "processedAt", "failedAt"].includes(key),
          ),
        );
        if (row.source === "OUTBOX") {
          return { ...rest, lastError: null };
        }
        return { ...rest, lastErrorCode: null, lastErrorMessage: null };
      });
      return reply({
        items,
        ...(rows.length > 25
          ? { nextCursor: "AbC".repeat(30) + String(offset + 25).padStart(6, "0") }
          : {}),
      });
    }
    const body = route.request().postDataJSON();
    state.writes.push({ path: url.pathname, body });
    if (
      !row ||
      body.expectedUpdatedAt !== row.updatedAt ||
      !["FAILED", "DEAD_LETTER"].includes(row.status)
    )
      return route.fulfill({
        status: 409,
        json: { success: false, error: { code: "CONFLICT" } },
      });
    row.status = row.source === "OUTBOX" ? "PENDING" : "RECEIVED";
    row.updatedAt = "2026-10-19T09:30:00.000Z";
    if (state.mode === "lost") return route.abort("failed");
    return reply({
      id: state.mode === "wrong-receipt" ? id(999) : row.id,
      source: row.source === "OUTBOX" ? "outbox" : "webhook",
      status: "RETRY_REQUESTED",
      attempts: body.expectedAttempts,
    });
  });
  return state;
}
