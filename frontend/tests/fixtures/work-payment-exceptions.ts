import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { PaymentAnomaly } from "@/lib/api/operations-schemas";
export { id };
export function exceptionRow(n = 0): PaymentAnomaly {
  const status = (["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"] as const)[n % 4],
    type = (
      [
        "AMOUNT_MISMATCH",
        "DUPLICATE_SUCCESS",
        "REFUND_MISMATCH",
        "UNKNOWN_REFERENCE",
      ] as const
    )[n % 4],
    closed = ["RESOLVED", "IGNORED"].includes(status);
  return {
    id: id(210000 + n),
    paymentId: id(211000 + n),
    paymentAttemptId: id(212000 + n),
    refundId: n % 4 === 2 ? id(213000 + n) : null,
    disputeId: null,
    type,
    status,
    summary: [
      "The captured amount differs from the requested payment.",
      "A second successful receipt needs reconciliation.",
      "The provider refund observation was reconciled.",
      "An unmatched provider reference was independently reviewed.",
    ][n % 4],
    detectedAt: new Date(
      Date.parse("2026-10-18T08:00:37.123Z") - n * 3600000,
    ).toISOString(),
    updatedAt: "2026-10-18T09:00:37.123Z",
    resolvedAt: closed ? "2026-10-18T09:00:37.123Z" : null,
    resolvedByUserId: closed ? id(402) : null,
    resolutionNote:
      status === "OPEN"
        ? null
        : "Matched the recorded source and provider evidence during investigation.",
  };
}
export async function workExceptionFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role),
    state = {
      base,
      mode: "normal",
      detailMode: "normal",
      writeMode: "normal",
      records: Array.from({ length: 4 }, (_, n) => exceptionRow(n)),
      reads: [] as URL[],
      detailReads: [] as URL[],
      writes: [] as { path: string; body: unknown }[],
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic payment exception fixture",
      meta: { requestId: "exception-page-test" },
    },
  });
  await page.route("**/api/v1/admin/operations/payment-anomalies**", async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() !== "GET") {
      state.writes.push({ path: u.pathname, body: r.request().postDataJSON() });
      if (["conflict", "denied", "unavailable"].includes(state.writeMode))
        return r.fulfill({
          status:
            state.writeMode === "conflict"
              ? 409
              : state.writeMode === "denied"
                ? 403
                : 503,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      const target = state.records.find((v) => u.pathname.endsWith(`/${v.id}/status`));
      if (!target)
        return r.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      const body = r.request().postDataJSON();
      if (
        target.status !== body.expectedStatus ||
        (target.status === "OPEN"
          ? body.status !== "INVESTIGATING"
          : target.status !== "INVESTIGATING" ||
            !["RESOLVED", "IGNORED"].includes(body.status))
      )
        return r.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      const closed = ["RESOLVED", "IGNORED"].includes(body.status);
      Object.assign(target, {
        status: body.status,
        resolutionNote: body.resolutionNote,
        updatedAt: "2026-10-18T10:00:37.123Z",
        resolvedAt: closed ? "2026-10-18T10:00:37.123Z" : null,
        resolvedByUserId: closed ? id(302) : null,
      });
      if (state.writeMode === "lost") return r.abort("failed");
      return r.fulfill(
        ok(
          state.writeMode === "wrong"
            ? { ...target, id: id(999) }
            : state.writeMode === "wrongNote"
              ? { ...target, resolutionNote: "Different note" }
              : target,
        ),
      );
    }
    if (/\/payment-anomalies\/[^/]+$/.test(u.pathname)) {
      state.detailReads.push(u);
      if (["error", "denied", "missing"].includes(state.detailMode))
        return r.fulfill({
          status:
            state.detailMode === "denied"
              ? 403
              : state.detailMode === "missing"
                ? 404
                : 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      const target = state.records.find((v) => u.pathname.endsWith(`/${v.id}`));
      if (!target)
        return r.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      return r.fulfill(
        ok(state.detailMode === "wrong" ? { ...target, id: id(999) } : target),
      );
    }
    state.reads.push(u);
    if (["error", "denied"].includes(state.mode))
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    const rows = state.records.filter(
        (v) =>
          (!u.searchParams.has("status") || v.status === u.searchParams.get("status")) &&
          (!u.searchParams.has("type") || v.type === u.searchParams.get("type")),
      ),
      start = u.searchParams.has("cursor")
        ? rows.findIndex((v) => v.id === u.searchParams.get("cursor")) + 1
        : 0,
      limit = Number(u.searchParams.get("limit") ?? 25),
      items = rows.slice(start, start + limit);
    if (state.mode === "empty") return r.fulfill(ok({ items: [] }));
    return r.fulfill(
      ok({
        items,
        ...(start + limit < rows.length ? { nextCursor: items.at(-1)!.id } : {}),
      }),
    );
  });
  return state;
}
