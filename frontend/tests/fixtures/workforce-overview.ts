import type { Page } from "@playwright/test";
import { workforceCounterPermissions } from "../../lib/api/workforce-schemas";
import {
  workforceNotificationsFixture,
  type notificationResponsibilities,
} from "./workforce-notifications";
export async function workforceOverviewFixture(
  page: Page,
  template: keyof typeof notificationResponsibilities = "OPERATIONS",
) {
  const state = await workforceNotificationsFixture(page, template);
  state.access.position = template;
  state.access.department = template === "OPERATIONS" ? "Strategy" : "Services";
  if (template === "OPERATIONS") {
    const first = state.access.assignments[0];
    state.access.assignments.push(
      {
        ...first,
        id: "b4000000-0000-4000-8000-000000000011",
        template: "SALES_SUPERVISOR",
        temporary: true,
        expiresAt: "2027-01-15T17:00:00.000Z",
        reason: "Position vacant",
      },
      {
        ...first,
        id: "b4000000-0000-4000-8000-000000000012",
        template: "CUSTOMER_SERVICE",
        temporary: true,
        expiresAt: "2027-01-15T17:00:00.000Z",
        reason: "Position vacant",
      },
    );
    state.access.permissions.push(
      "SALES_ENQUIRIES",
      "ENQUIRIES_ASSIGN",
      "CUSTOMER_ENQUIRIES",
      "COMPLAINTS",
    );
  }
  const overview = {
    counts: Object.fromEntries(
      Object.entries(workforceCounterPermissions)
        .filter(([, permissions]) =>
          permissions.some((permission) => state.access.permissions.includes(permission)),
        )
        .map(([key]) => [
          key,
          (
            { jobs: 4, bookings: 12, enquiries: 5, complaints: 2, orders: 18 } as Record<
              string,
              number
            >
          )[key],
        ]),
    ) as Record<string, number>,
    generatedAt: "2026-10-19T09:40:00.000Z",
    access: state.access,
    branches: [
      { id: state.access.assignments[0].branchId, name: "Stadium Road workshop" },
    ],
  };
  const control = {
    ...state,
    overview,
    failOverview: false,
    deniedOverview: false,
    holdOverview: false,
    releaseOverview: undefined as (() => void) | undefined,
    overviewReads: 0,
  };
  await page.route("**/api/v1/staff/workforce/overview", async (route) => {
    control.overviewReads++;
    if (control.holdOverview)
      await new Promise<void>((resolve) => {
        control.releaseOverview = resolve;
      });
    if (control.failOverview || control.deniedOverview)
      return route.fulfill({
        status: control.deniedOverview ? 403 : 503,
        json: {
          success: false,
          message: "Synthetic overview unavailable",
          error: { code: control.deniedOverview ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
        },
      });
    return route.fulfill({
      json: {
        success: true,
        data: overview,
        message: "Synthetic scoped overview",
        meta: { requestId: "workforce-overview" },
      },
    });
  });
  return control;
}
