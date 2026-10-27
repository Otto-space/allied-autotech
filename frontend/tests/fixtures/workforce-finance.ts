import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
export const paymentFixtureId = (n: number) =>
  `be000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function workforceFinanceFixture(page: Page) {
  const base = await workforceNotificationsFixture(page, "ACCOUNTANT");
  const generatedAt = "2026-10-20T09:00:00.000Z";
  const items = [1, 2].map((n) => ({
    id: paymentFixtureId(n),
    paymentNumber: `PAY-2026-0${147 + n}`,
    amountKobo: n === 1 ? "2750050" : "15000000",
    currency: "NGN",
    status: n === 1 ? "SUCCEEDED" : "PROCESSING",
    purpose: n === 1 ? "ORDER_PAYMENT" : "SERVICE_INVOICE",
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-20T08:15:00.000Z",
    succeededAt: n === 1 ? "2026-10-20T08:15:00.000Z" : null,
    expiresAt: null as string | null,
    cancelledAt: null as string | null,
    expiredAt: null as string | null,
    sources: [
      {
        kind: n === 1 ? "ORDER" : "INVOICE",
        reference: n === 1 ? "AA-2026-0148" : "INV-2026-0082",
        branch: { id: base.access.assignments[0].branchId!, name: "Stadium Road" },
      },
    ],
  }));
  const state = {
    base,
    items,
    reads: [] as string[],
    writes: [] as string[],
    listFailure: false,
    detailFailure: false,
    detailDenied: false,
    listMismatch: false,
    detailMismatch: false,
    hold: false,
    release: undefined as (() => void) | undefined,
  };
  const project = (row: (typeof items)[number]) => ({
    ...row,
    access: base.access,
    generatedAt,
  });
  await page.route("**/api/v1/staff/workforce/finance**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic finance fixture",
          meta: { requestId: "workforce-finance" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code: "UNAVAILABLE",
            message: "Synthetic payment response unavailable",
          },
        },
      });
    if (req.method() !== "GET") {
      state.writes.push(url.pathname);
      return fail(403);
    }
    state.reads.push(url.pathname + url.search);
    const id = /finance\/([^/]+)/.exec(url.pathname)?.[1];
    if (id) {
      if (state.detailDenied) return fail(403);
      if (state.detailFailure) return fail(503);
      const row = items.find((r) => r.id === id);
      if (!row) return fail(404);
      return ok({
        ...project(row),
        id: state.detailMismatch ? paymentFixtureId(999) : row.id,
      });
    }
    if (state.hold)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.listFailure) return fail(503);
    const terms = (url.searchParams.get("q") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const filtered = items.filter(
      (r) =>
        terms.every((t) =>
          (
            r.paymentNumber +
            " " +
            r.sources
              .filter((s) => s.kind !== "BOOKING")
              .map((s) => s.reference)
              .join(" ")
          )
            .toLowerCase()
            .includes(t),
        ) &&
        (!url.searchParams.has("status") ||
          r.status === url.searchParams.get("status")) &&
        (!url.searchParams.has("purpose") ||
          r.purpose === url.searchParams.get("purpose")),
    );
    const cursor = url.searchParams.get("cursor"),
      offset = cursor ? filtered.findIndex((r) => r.id === cursor) + 1 : 0,
      rows = filtered.slice(offset, offset + 25).map(project);
    return ok({
      items: rows,
      ...(filtered.length > offset + 25 ? { nextCursor: rows.at(-1)!.id } : {}),
      access: state.listMismatch ? { ...base.access, version: 999 } : base.access,
      generatedAt,
    });
  });
  return state;
}
