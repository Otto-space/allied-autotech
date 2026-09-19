import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { overviewFixture } from "../fixtures/overview";

async function fixture(page: Page, role = "ADMIN") {
  const state = {
    reads: [] as URL[],
    mode: "normal",
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
      return route.fulfill({
        json: {
          success: true,
          message: "Isolated overview",
          meta: { requestId: "overview-test" },
          data: overviewFixture(
            role,
            { from: url.searchParams.get("from")!, to: url.searchParams.get("to")! },
            state.mode === "empty",
          ),
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
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} overview renders only its permitted metrics and working links`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    await expect(page).toHaveTitle(/Allied AutoTech/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".overview-metric")).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "Activity overview", exact: true }),
    ).toBeVisible();
    expect(state.reads[0].pathname).toBe(
      `/api/v1/${role === "CUSTOMER" ? "customers" : "staff"}/overview`,
    );
    if (["ADMIN", "SUPER_ADMIN"].includes(role)) {
      await expect(page.locator(".overview-metrics")).toContainText("NGN 2,489,500.00");
      await expect(
        page.getByText("Processing queues & payment monitoring", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(page.getByText("Payments collected", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("Processing queues & payment monitoring", { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText("Quotations issued", { exact: true })).toBeVisible();
    }
    await page.getByText("View daily data", { exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Daily activity data" }).locator("tbody tr"),
    ).toHaveCount(30);
    await page.getByLabel("Inspect day").focus();
    await page.keyboard.press("Home");
    await expect(page.getByLabel("Inspect day")).toHaveValue("0");
    const bookingsLegend = page.getByRole("button", { name: "Bookings", exact: true });
    await bookingsLegend.click();
    await expect(bookingsLegend).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".overview-series.bookings")).toHaveCount(0);
    await bookingsLegend.click();
    await page.getByText("View daily data", { exact: true }).click();
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-overview-${role}-1440.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: /View booking .* Vehicle diagnostics/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`${role === "CUSTOMER" ? "/dashboard" : "/admin"}/bookings/`),
    );
    expect(errors).toEqual([]);
  });

for (const width of [320, 360, 390, 768, 1024, 1655])
  test(`overview matches the responsive composition at ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: width === 1655 ? 1133 : 960 });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Recent bookings", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-overview-responsive-${width}.png`),
      fullPage: true,
    });
  });

test("date filters validate before fetching and distinguish errors from zero activity", async ({
  page,
}) => {
  const state = await fixture(page, "STAFF");
  await page.goto("/admin");
  await expect(page.getByText("Quotations issued", { exact: true })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("2026-01-01");
  await page.getByLabel("To", { exact: true }).fill("2026-06-01");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.locator("#overview-date-error")).toContainText("1 to 90 days");
  await expect(page.getByLabel("To", { exact: true })).toBeFocused();
  expect(state.reads).toHaveLength(1);
  state.mode = "empty";
  await page.getByLabel("To", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(
    page.getByText("No new bookings or orders in this period.", { exact: true }),
  ).toBeVisible();
  expect(state.reads.at(-1)?.searchParams.get("to")).toBe("2026-01-01");
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your overview" }),
  ).toBeVisible();
  await expect(page.locator(".overview-metric")).toHaveCount(0);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry overview" }).click();
  await expect(page.getByText("Quotations issued", { exact: true })).toBeVisible();
  await page.getByLabel("Overview date preset").selectOption("7");
  await page.getByText("View daily data", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Daily activity data" }).locator("tbody tr"),
  ).toHaveCount(7);
});

test("account switching removes private aggregates and ignores a late refresh", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/admin");
  await expect(page.getByText("Payments collected", { exact: true })).toBeVisible();
  state.mode = "hold";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  state.held?.();
  await expect(page.getByText("Payments collected", { exact: true })).toHaveCount(0);
});
