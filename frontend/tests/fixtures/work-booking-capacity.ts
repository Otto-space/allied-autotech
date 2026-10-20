import type { Page } from "@playwright/test";
export const capacityId = (n: number) =>
  `e3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const capacitySettings = {
  dailyLimit: 8,
  openingDays: [1, 2, 3, 4, 5],
  opensAt: "08:00",
  closesAt: "18:00",
  holidays: ["2027-01-01"],
  timezone: "Africa/Lagos",
};
export const capacityRow = (version = 2, branchId = capacityId(1)) => ({
  id: capacityId(100 + version),
  key: `booking-capacity:${branchId}`,
  version,
  approvalStatus: "APPROVED",
  source: "Synthetic approved workshop capacity record",
  sourceQuestion: "Q5",
  sourceSignatory: null,
  approvedByUserId: capacityId(3),
  effectiveAt:
    version <= 2 ? "2026-01-01T00:00:00Z" : `203${version - 1}-01-05T07:30:00Z`,
  recordedAt: "2026-10-18T08:00:00Z",
  approvalEvidence:
    "Synthetic written capacity approval for isolated interface verification.",
  settings: capacitySettings,
});
export async function workCapacityFixture(page: Page) {
  const state = {
    role: "SUPER_ADMIN",
    owner: capacityId(3),
    branch: {
      id: capacityId(1),
      name: "Synthetic workshop",
      isActive: true,
      updatedAt: "2026-10-18T08:00:00Z",
    },
    history: [capacityRow(4), capacityRow(3), capacityRow(2), capacityRow(1)],
    fail: false,
    denied: false,
    drop: false,
    wrongActor: false,
    profileOwner: capacityId(3),
    writes: [] as Record<string, unknown>[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic response",
          meta: { requestId: "capacity-work-test" },
        },
      });
    if (path === "/auth/session")
      return reply({
        id: capacityId(2),
        user: { id: state.owner, email: "capacity@example.test", role: state.role },
        mfaRequired: true,
        mfaVerifiedAt: "2026-10-18T08:00:00Z",
      });
    if (path === "/auth/csrf")
      return reply({ csrfToken: "isolated-capacity-csrf-".repeat(4) });
    if (path === "/staff/profile")
      return reply({
        id: state.profileOwner,
        email: "capacity@example.test",
        role: state.role,
        status: "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: capacityId(5),
          firstName: "Synthetic",
          lastName: "Owner",
          branchId: null,
        },
      });
    if (path === "/admin/branches")
      return reply({
        items: [
          state.branch,
          { ...state.branch, id: capacityId(9), name: "Second synthetic workshop" },
        ],
      });
    if (path.startsWith("/admin/branches/"))
      return reply({ ...state.branch, id: path.split("/").at(-1) });
    if (path === "/admin/policies" && route.request().method() === "GET")
      return reply(state.history);
    if (path.startsWith("/admin/policies/booking-capacity/")) {
      if (state.fail || state.denied)
        return route.fulfill({
          status: state.denied ? 403 : 503,
          json: {
            success: false,
            error: { code: state.denied ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
          },
        });
      const branchId = path.split("/").at(-2)!,
        history = state.history.map((row) => ({
          ...row,
          key: `booking-capacity:${branchId}`,
        }));
      return reply({
        evaluatedAt: new Date().toISOString(),
        branch: { ...state.branch, id: branchId },
        current:
          history
            .filter((r) => Date.parse(r.effectiveAt) <= Date.now())
            .sort(
              (a, b) =>
                Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
                b.version - a.version,
            )[0] ?? null,
        nextScheduled:
          history
            .filter((r) => Date.parse(r.effectiveAt) > Date.now())
            .sort(
              (a, b) =>
                Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) ||
                b.version - a.version,
            )[0] ?? null,
        latest: history[0] ?? null,
        history,
      });
    }
    if (path === "/admin/policies" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push(body);
      const saved = {
        ...capacityRow(body.expectedVersion + 1, body.branchId),
        ...body,
        key: `booking-capacity:${body.branchId}`,
        version: body.expectedVersion + 1,
        approvedByUserId: state.wrongActor ? capacityId(999) : state.owner,
      };
      delete saved.kind;
      delete saved.branchId;
      delete saved.expectedVersion;
      state.history.unshift(saved);
      if (state.drop) return route.abort("failed");
      return reply(saved);
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
