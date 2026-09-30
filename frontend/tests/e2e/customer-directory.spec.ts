import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Opt-in real API tests: sessions must belong to an isolated test database.
const fixturePath = process.env.BG_DIRECTORY_SESSION_FILE;
test.skip(
  !fixturePath,
  "Requires the isolated directory API and synthetic role sessions",
);
function fixture(): { sessions: Record<string, string>; ids: string[] } {
  if (!fixturePath) throw new Error("Missing isolated session fixture");
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}
async function signIn(page: Page, role = "ADMIN") {
  await page.context().addCookies([
    {
      name: "aat_session",
      value: fixture().sessions[role],
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3011",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function search(page: Page, value: string) {
  await page.getByLabel("Search customers", { exact: true }).fill(value);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/admin/customers" &&
      new URL(r.url()).searchParams.get("search") === value,
  );
  await page.getByRole("button", { name: "Search customers", exact: true }).click();
  expect((await response).status()).toBe(200);
}
test("real customer search, filters, pagination and responsive detail", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/customers");
  await expect(page).toHaveTitle(/Customers/);
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  await search(page, "Browserdemo");
  await expect(
    page.getByRole("region", { name: "Customer results" }).locator("tbody tr"),
  ).toHaveCount(25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Customer results" }).locator("tbody tr"),
  ).toHaveCount(5);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Customer results" }).locator("tbody tr"),
  ).toHaveCount(25);
  await page.getByLabel("Email verification", { exact: true }).selectOption("true");
  await page.getByRole("button", { name: "Search customers", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Customer results" }).locator("tbody tr"),
  ).toHaveCount(15);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg01-directory-desktop.png"),
    fullPage: false,
  });
  await page.goto(`/admin/customers/${fixture().ids[0]}`);
  await expect(
    page.getByRole("heading", { name: "Browserdemo Customer 00" }),
  ).toBeVisible();
  await expect(page.getByText("2020 Toyota Corolla", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2020 Toyota Corolla", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-bg01-detail-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("no results and invalid input are recoverable", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/customers");
  await search(page, "MissingBrowserCustomer");
  await expect(
    page.getByRole("heading", { name: "No matching customers" }),
  ).toBeVisible();
  await page.getByLabel("Search customers", { exact: true }).fill("a");
  await page.getByRole("button", { name: "Search customers", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("at least 2");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("region", { name: "Customer results" })).toBeVisible();
});
test("Staff cannot view directory controls or call restricted routes", async ({
  page,
}) => {
  await signIn(page, "STAFF");
  await page.goto("/admin/customers");
  await expect(
    page.getByText("Administrator access is required to view customers."),
  ).toBeVisible();
  await expect(page.getByLabel("Search customers", { exact: true })).toHaveCount(0);
  expect((await page.request.get("/api/v1/admin/customers")).status()).toBe(403);
});
test("server rate-limit, validation and permission errors support recovery", async ({
  page,
}) => {
  await signIn(page);
  for (const [status, code] of [
    [429, "RATE_LIMITED"],
    [422, "VALIDATION_FAILED"],
    [403, "FORBIDDEN"],
    [503, "DATABASE_UNAVAILABLE"],
  ] as const) {
    await page.route("**/api/v1/admin/customers?**", (route) =>
      route.fulfill({
        status,
        json: {
          success: false,
          message: "Controlled error state",
          error: { code },
          meta: { requestId: "directory-error-test" },
        },
      }),
    );
    await page.goto("/admin/customers");
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await page.unroute("**/api/v1/admin/customers?**");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("region", { name: "Customer results" })).toBeVisible();
  }
});
test("loading skeleton and empty directory render honestly", async ({ page }) => {
  await signIn(page);
  let release: (() => void) | undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/admin/customers?**", async (route) => {
    await hold;
    await route.fulfill({
      json: {
        success: true,
        message: "Controlled empty state",
        data: { items: [] },
        meta: { requestId: "directory-empty-test" },
      },
    });
  });
  await page.goto("/admin/customers");
  await expect(page.getByRole("status", { name: "Loading customers" })).toBeVisible();
  release?.();
  await expect(page.getByRole("heading", { name: "No customers yet" })).toBeVisible();
});
