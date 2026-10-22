import type { Page } from "@playwright/test";
import { workCapacityFixture, capacityId as id } from "./work-booking-capacity";
import { business } from "../../lib/business";
export { id };
export const deliverySettings = {
  collectionEnabled: true as const,
  collectionAddress: business.address,
  zones: [
    {
      id: "synthetic-central",
      label: "Synthetic central area",
      city: "Port Harcourt",
      state: "Rivers",
      feeKobo: "250000",
    },
    {
      id: "synthetic-extended",
      label: "Synthetic extended area",
      city: "Port Harcourt",
      state: "Rivers",
      feeKobo: "500000",
    },
  ],
};
export const deliveryPolicyRow = (version = 4) => ({
  id: id(800 + version),
  key: "delivery",
  version,
  approvalStatus: "APPROVED",
  source: "Synthetic written owner delivery approval",
  sourceQuestion: "Q1",
  sourceSignatory: null,
  approvedByUserId: id(3),
  effectiveAt:
    version <= 2 ? "2026-01-01T00:00:00Z" : `203${version - 1}-01-05T07:30:00Z`,
  recordedAt: "2026-10-19T08:00:00Z",
  approvalEvidence: "Synthetic signed approval for isolated delivery verification.",
  settings: deliverySettings,
});
export async function workDeliveryPolicyFixture(page: Page) {
  const base = await workCapacityFixture(page),
    state = {
      base,
      history: [4, 3, 2, 1].map(deliveryPolicyRow),
      fail: false,
      denied: false,
      drop: false,
      wrongActor: false,
      checkoutEnabled: true,
      deliveryEnabled: true,
      writes: [] as Record<string, unknown>[],
    };
  const reply = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic delivery response",
      meta: { requestId: "delivery-work-test" },
    },
  });
  await page.route("**/api/v1/admin/policies**", async (r) => {
    if (r.request().method() === "GET") {
      if (state.fail || state.denied)
        return r.fulfill({
          status: state.denied ? 403 : 503,
          json: {
            success: false,
            error: { code: state.denied ? "FORBIDDEN" : "UNAVAILABLE" },
          },
        });
      if (!new URL(r.request().url()).pathname.endsWith("/current"))
        return r.fulfill(reply(state.history));
      const history = state.history,
        now = Date.now();
      return r.fulfill(
        reply({
          evaluatedAt: new Date(now).toISOString(),
          current:
            history
              .filter((v) => Date.parse(v.effectiveAt) <= now)
              .sort(
                (a, b) =>
                  Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
                  b.version - a.version,
              )[0] ?? null,
          nextScheduled:
            history
              .filter((v) => Date.parse(v.effectiveAt) > now)
              .sort(
                (a, b) =>
                  Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) ||
                  b.version - a.version,
              )[0] ?? null,
          latest: history[0] ?? null,
          history,
          availability: {
            checkoutEnabled: state.checkoutEnabled,
            deliveryEnabled: state.deliveryEnabled,
          },
        }),
      );
    }
    const body = r.request().postDataJSON();
    state.writes.push(body);
    const saved = {
      ...deliveryPolicyRow(body.expectedVersion + 1),
      ...body,
      version: body.expectedVersion + 1,
      approvedByUserId: state.wrongActor ? id(999) : base.owner,
    };
    delete saved.kind;
    delete saved.expectedVersion;
    state.history.unshift(saved);
    if (state.drop) return r.abort("failed");
    return r.fulfill(reply(saved));
  });
  return state;
}
