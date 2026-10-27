import type { Page } from "@playwright/test";
import { workCapacityFixture, capacityId as id } from "./work-booking-capacity";
export { id };
export const reservationSettings = {
  enabled: true as const,
  title: "Synthetic reservation agreement",
  body: "Synthetic agreement for isolated interface verification only.\n\nThe customer reviews the exact approved reservation terms before accepting. Existing accepted documents retain their original text.",
};
export const reservationPolicyRow = (version = 4) => ({
  id: id(900 + version),
  key: "vehicle_reservation_terms",
  version,
  approvalStatus: "APPROVED",
  source: "Synthetic owner agreement approval",
  sourceQuestion: "Q3",
  sourceSignatory: null,
  approvedByUserId: id(3),
  effectiveAt:
    version <= 2 ? "2026-01-01T00:00:00Z" : `203${version - 1}-01-05T07:30:00Z`,
  recordedAt: "2026-10-19T08:00:00Z",
  approvalEvidence:
    "Synthetic signed agreement record for isolated interface verification.",
  settings:
    version === 3
      ? {
          enabled: false as const,
          reason: "Synthetic scheduled withdrawal for verification.",
        }
      : reservationSettings,
});
export async function workReservationPolicyFixture(page: Page) {
  const base = await workCapacityFixture(page),
    state = {
      base,
      history: [4, 3, 2, 1].map(reservationPolicyRow),
      fail: false,
      denied: false,
      drop: false,
      wrongActor: false,
      reject: false,
      writes: [] as Record<string, unknown>[],
    };
  const reply = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic agreement response",
      meta: { requestId: "reservation-work-test" },
    },
  });
  await page.route("**/api/v1/admin/policies**", async (route) => {
    if (route.request().method() === "GET") {
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
      return route.fulfill(
        reply({
          evaluatedAt: new Date(now).toISOString(),
          current:
            [...history]
              .filter((v) => Date.parse(v.effectiveAt) <= now)
              .sort(
                (a, b) =>
                  Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
                  b.version - a.version,
              )[0] ?? null,
          nextScheduled:
            [...history]
              .filter((v) => Date.parse(v.effectiveAt) > now)
              .sort(
                (a, b) =>
                  Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) ||
                  b.version - a.version,
              )[0] ?? null,
          latest: history[0] ?? null,
          history,
        }),
      );
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
      ...reservationPolicyRow(body.expectedVersion + 1),
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
