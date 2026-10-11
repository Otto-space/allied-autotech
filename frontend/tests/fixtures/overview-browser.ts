import type { Page } from "@playwright/test";
import { overviewFixture } from "./overview";
export async function fixture(page: Page, role = "ADMIN") {
  const state = {
    reads: [] as URL[],
    mode: "normal",
    care: overviewFixture(role).care,
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint.endsWith("/overview")) {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      const data = overviewFixture(
        role,
        { from: url.searchParams.get("from")!, to: url.searchParams.get("to")! },
        ["empty", "period_empty"].includes(state.mode),
      );
      return route.fulfill({
        json: {
          success: true,
          message: "Isolated overview",
          meta: { requestId: "overview-test" },
          data: {
            ...data,
            ...(role === "CUSTOMER"
              ? {
                  care:
                    state.mode === "missingCare"
                      ? undefined
                      : state.mode === "malformedCare"
                        ? {}
                        : state.mode === "empty"
                          ? data.care
                          : state.care,
                }
              : {}),
            ...(state.mode === "wrongScope" ? { scope: "ORGANISATION" } : {}),
          },
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated session",
        meta: { requestId: "overview-test" },
        data:
          endpoint === "/auth/session"
            ? {
                id: "b9000000-0000-4000-8000-000000000100",
                user: {
                  id: "b9000000-0000-4000-8000-000000000101",
                  email: "overview@example.test",
                  role,
                },
                mfaRequired: role !== "CUSTOMER",
                mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-18T08:00:00Z",
                expiresAt: "2027-01-01T00:00:00Z",
                idleExpiresAt: "2027-01-01T00:00:00Z",
              }
            : endpoint === "/admin/operations/status"
              ? { queues: [], openPaymentAnomalies: 0, lastReconciliation: null }
              : { items: [] },
      },
    });
  });
  return state;
}
