import type { Page } from "@playwright/test";
import { workCapacityFixture } from "./work-booking-capacity";
import { resourceId as id, resourceRow } from "./workshop-resources";
export async function resourceEditorFixture(page: Page) {
  const identity = await workCapacityFixture(page);
  const state = {
    identity,
    history: [resourceRow(3), resourceRow(2)],
    mode: "normal" as "normal" | "reject" | "drop" | "wrong-receipt",
    fail: false,
    denied: false,
    readCount: 0,
    writes: [] as Record<string, unknown>[],
    options: [
      {
        id: id(32),
        label: "Synthetic alignment service",
        kind: "SERVICE",
        eligible: true,
      },
      {
        id: id(42),
        label: "Synthetic independent inspection",
        kind: "SERVICE",
        eligible: true,
      },
      {
        id: id(31),
        label: "Synthetic alignment technician",
        kind: "TECHNICIAN",
        eligible: true,
      },
      {
        id: id(41),
        label: "Synthetic mechanic with a longer display name",
        kind: "TECHNICIAN",
        eligible: true,
      },
    ],
    pageSize: 25,
  };
  const reply = (route: import("@playwright/test").Route, data: unknown) =>
    route.fulfill({
      json: {
        success: true,
        data,
        message: "Synthetic resource editor response",
        meta: { requestId: "resource-editor-fixture" },
      },
    });
  await page.route("**/api/v1/public/capabilities", (route) =>
    reply(route, {
      scope: "POLICY_SUMMARY",
      serverTime: new Date().toISOString(),
      release: {
        mode: "full",
        customerAccountsEnabled: true,
        enquiriesEnabled: true,
        bookingRequestsEnabled: true,
        inspectionRequestsEnabled: true,
      },
      checkoutEnabled: true,
      vehicleDeposits: { enabled: false },
    }),
  );
  await page.route("**/api/v1/staff/notifications/summary", (route) =>
    reply(route, { unreadCount: 0, groups: [], destinations: [] }),
  );
  await page.route("**/api/v1/admin/policies/booking-resources/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (state.fail || state.denied)
      return route.fulfill({
        status: state.denied ? 403 : 503,
        json: {
          success: false,
          error: { code: state.denied ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
        },
      });
    const branchId = path.split("/").at(-2)!;
    if (path.endsWith("/options")) {
      const kind = url.searchParams.get("kind")!,
        ids = url.searchParams.get("ids")?.split(","),
        q = url.searchParams.get("q")?.toLowerCase(),
        cursor = url.searchParams.get("cursor");
      const filtered = state.options
        .filter(
          (r) =>
            r.kind === kind &&
            (ids
              ? ids.includes(r.id)
              : r.eligible &&
                (!q || r.label.toLowerCase().includes(q)) &&
                (!cursor || r.id > cursor)),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      const items = ids ? filtered : filtered.slice(0, state.pageSize);
      return reply(route, {
        branchId,
        kind,
        items: items.map((r) => ({ id: r.id, label: r.label, eligible: r.eligible })),
        nextCursor: !ids && filtered.length > state.pageSize ? items.at(-1)!.id : null,
      });
    }
    state.readCount++;
    const history = state.history.map((r) => ({
      ...r,
      key: `booking-resources:${branchId}`,
    }));
    return reply(route, {
      evaluatedAt: new Date().toISOString(),
      branch: { ...identity.branch, id: branchId },
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
  });
  await page.route("**/api/v1/admin/policies", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    state.writes.push(body);
    if (state.mode === "reject")
      return route.fulfill({
        status: 409,
        json: { success: false, error: { code: "CONFLICT" } },
      });
    const saved = {
      ...resourceRow(body.expectedVersion + 1, body.branchId),
      settings: body.settings,
      source: body.source,
      approvalEvidence: body.approvalEvidence,
      effectiveAt: body.effectiveAt,
      recordedAt: new Date().toISOString(),
      approvedByUserId: identity.owner,
    };
    state.history.unshift(saved);
    if (state.mode === "drop") return route.abort("failed");
    return reply(
      route,
      state.mode === "wrong-receipt" ? { ...saved, approvedByUserId: id(999) } : saved,
    );
  });
  return state;
}
