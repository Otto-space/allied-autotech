import { expect, type Page } from "@playwright/test";

export async function customerSearchFixture(page: Page) {
  const { customerRecord } = await import("../fixtures/work-customers");
  const rows = Array.from({ length: 28 }, (_, n) => customerRecord(n));
  const state = { reads: [] as URL[], mode: "normal", detailDenied: false };
  await page.route("**/api/v1/admin/customers**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const u = new URL(route.request().url());
    state.reads.push(u);
    const target = u.pathname.split("/").at(-1);
    if (
      state.mode === "error" ||
      state.mode === "denied" ||
      (target !== "customers" && state.detailDenied)
    )
      return route.fulfill({
        status: state.mode === "error" ? 503 : 403,
        json: {
          success: false,
          error: { code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN" },
        },
      });
    const row = rows.find((r) => r.id === target);
    const matching = rows.filter((r) =>
      u.searchParams.get("field") === "email"
        ? r.email.startsWith(u.searchParams.get("search") ?? "")
        : `${r.firstName} ${r.lastName}`
            .toLowerCase()
            .startsWith(u.searchParams.get("search") ?? ""),
    );
    const offset = u.searchParams.has("cursor") ? 25 : 0;
    return route.fulfill({
      json: {
        success: true,
        data:
          target !== "customers"
            ? { ...row, address: null, city: null, state: null, country: "NG" }
            : {
                items: matching.slice(offset, offset + 25),
                ...(matching.length > offset + 25
                  ? { nextCursor: "customer_page_two" }
                  : {}),
              },
        message: "Synthetic customer search",
        meta: { requestId: "synthetic-customer-picker" },
      },
    });
  });
  return { rows, state };
}
