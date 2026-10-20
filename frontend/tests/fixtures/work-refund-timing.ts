import type { Page } from "@playwright/test";
import { workCapacityFixture, capacityId as id } from "./work-booking-capacity";
export { id };
export const refundTimingSettings = {
  startEvent: "APPROVED" as const,
  businessDays: 10 as const,
  countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME" as const,
  bankingDays: [1, 2, 3, 4, 5],
  holidays: ["2027-01-01"],
  timezone: "Africa/Lagos" as const,
};
export const refundTimingPolicyRow = (version = 4) => ({
  id: id(900 + version),
  key: "bank_refund_clock",
  version,
  approvalStatus: "APPROVED",
  source: "Synthetic owner agreement approval",
  sourceQuestion: "Q6",
  sourceSignatory: null,
  approvedByUserId: id(3),
  effectiveAt:
    version <= 2 ? "2026-01-01T00:00:00Z" : `203${version - 1}-01-05T07:30:00Z`,
  recordedAt: "2026-10-19T08:00:00Z",
  approvalEvidence:
    "Synthetic signed agreement record for isolated interface verification.",
  settings: refundTimingSettings,
});
export async function workRefundTimingPolicyFixture(page: Page) {
  const base = await workCapacityFixture(page),
    state = {
      base,
      history: [4, 3, 2, 1].map(refundTimingPolicyRow),
      fail: false,
      denied: false,
      drop: false,
      wrongActor: false,
      reject: false,
      reads: 0,
      writes: [] as Record<string, unknown>[],
    };
  const reply = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic agreement response",
      meta: { requestId: "refundTiming-work-test" },
    },
  });
  await page.route("**/api/v1/admin/policies**", async (route) => {
    if (route.request().method() === "GET") {
      state.reads++;
      if (state.fail || state.denied)
        return route.fulfill({
          status: state.denied ? 403 : 503,
          json: {
            success: false,
            error: { code: state.denied ? "FORBIDDEN" : "UNAVAILABLE" },
          },
        });
      if (!new URL(route.request().url()).pathname.endsWith("/current"))
        return route.fulfill(reply(state.history));
      const now = Date.now(),
        history = state.history;
      const approved = history.filter((v) => v.approvalStatus === "APPROVED");
      const current =
        [...approved]
          .filter((v) => Date.parse(v.effectiveAt) <= now)
          .sort((a, b) => b.version - a.version)[0] ?? null;
      const nextScheduled =
        [...approved]
          .filter(
            (v) => Date.parse(v.effectiveAt) > now && v.version > (current?.version ?? 0),
          )
          .sort(
            (a, b) =>
              Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) ||
              b.version - a.version,
          )[0] ?? null;
      return route.fulfill(
        reply({
          evaluatedAt: new Date(now).toISOString(),
          current,
          nextScheduled,
          latest: history[0] ?? null,
          history,
        }),
      );
    }
    if (route.request().headers()["x-csrf-token"] !== "synthetic-csrf") {
      // The shared fixture supplies its own CSRF value; only require a nonempty header.
      if (!route.request().headers()["x-csrf-token"]) throw Error("Missing CSRF header");
    }
    const body = route.request().postDataJSON();
    state.writes.push(body);
    if (state.reject)
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          error: { code: "CONFLICT", message: "Synthetic stale revision" },
        },
      });
    const row = {
      ...refundTimingPolicyRow(body.expectedVersion + 1),
      ...body,
      approvedByUserId: state.wrongActor ? id(99) : id(3),
      recordedAt: new Date().toISOString(),
    };
    delete row.kind;
    delete row.expectedVersion;
    state.history.unshift(row);
    if (state.drop) return route.abort("failed");
    return route.fulfill(reply(row));
  });
  return state;
}
