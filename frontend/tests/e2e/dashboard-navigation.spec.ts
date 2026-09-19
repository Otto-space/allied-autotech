import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { overviewFixture } from "../fixtures/overview";

async function session(page: Page, role: string) {
  const reads: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    reads.push(endpoint);
    const data =
      endpoint === "/auth/session"
        ? {
            id: "b0000000-0000-4000-8000-000000000001",
            user: {
              id: "b0000000-0000-4000-8000-000000000002",
              email: "dashboard@example.test",
              role,
            },
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-17T10:00:00Z",
            expiresAt: "2027-01-01T00:00:00Z",
            idleExpiresAt: "2027-01-01T00:00:00Z",
          }
        : endpoint.endsWith("/overview")
          ? overviewFixture(role)
          : endpoint === "/admin/operations/status"
            ? { queues: [], openPaymentAnomalies: 0, lastReconciliation: null }
            : { items: [] };
    await route.fulfill({
      json: {
        success: true,
        message: "Isolated navigation fixture",
        data,
        meta: { requestId: "isolated-navigation" },
      },
    });
  });
  return reads;
}

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} sees compact permitted groups and searches only permitted destinations`, async ({
    page,
  }) => {
    const reads = await session(page, role);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    const nav = page.getByRole("navigation", {
      name: role === "CUSTOMER" ? "Customer dashboard" : "Administration",
      exact: true,
    });
    await expect(nav).toBeVisible();
    expect(await nav.locator(":scope > a, :scope > details").count()).toBe(
      role === "CUSTOMER" ? 7 : role === "STAFF" ? 6 : 8,
    );
    await expect(nav.locator("details[open]")).toHaveCount(0);
    const search = page.getByRole("searchbox", { name: "Search dashboard pages" });
    await search.fill("refund");
    if (["CUSTOMER", "STAFF"].includes(role)) {
      await expect(page.getByText("No matching pages", { exact: true })).toBeVisible();
      expect(reads).not.toContain("/staff/payments");
      expect(reads).not.toContain("/staff/invoices");
      if (role === "STAFF") expect(reads).not.toContain("/admin/operations/status");
    } else {
      await expect(
        page
          .locator(".dashboard-search-results")
          .getByRole("link", { name: /Refund requests/ }),
      ).toHaveAttribute("href", "/admin/refunds");
    }
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(page.locator(".dashboard-search-results")).toHaveCount(0);
    await search.fill(role === "CUSTOMER" ? "Bookings" : "Workshop bookings");
    await page.locator(".dashboard-search-results").getByRole("link").click();
    await expect(page).toHaveURL(
      role === "CUSTOMER" ? /\/dashboard\/bookings$/ : /\/admin\/bookings$/,
    );
    await expect(
      nav.getByRole("link", {
        name: role === "CUSTOMER" ? "My bookings" : "Workshop bookings",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    if (role !== "CUSTOMER") {
      await expect(nav.locator("details[open]")).toHaveCount(1);
      await expect(nav.locator("details[open] summary")).toHaveText("Service Centre");
    }
  });
}

for (const destination of [
  "/admin/payments",
  "/admin/invoices",
  "/admin/invoices/b0000000-0000-4000-8000-000000000003",
]) {
  test(`STAFF direct finance link fetches no financial data: ${destination}`, async ({
    page,
  }) => {
    const reads = await session(page, "STAFF");
    await page.goto(destination);
    await expect(
      page.getByText("Administrator access is required for finance.", { exact: true }),
    ).toBeVisible();
    expect(
      reads.filter(
        (endpoint) =>
          endpoint.startsWith("/staff/payments") ||
          endpoint.startsWith("/staff/invoices"),
      ),
    ).toEqual([]);
  });
}

for (const width of [320, 360, 390, 768, 850, 900, 901, 1024, 1440, 1655]) {
  test(`shared navigation is accessible at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await session(page, "ADMIN");
    await page.setViewportSize({ width, height: width === 1655 ? 1133 : 960 });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Welcome back.", exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Administration", exact: true });
    if (width <= 900) {
      await expect(nav).toBeHidden();
      await page.getByRole("button", { name: "Open dashboard navigation" }).click();
      await expect(nav).toBeVisible();
    }
    const shop = nav.locator("summary").filter({ hasText: /^Shop$/ });
    await shop.focus();
    await page.keyboard.press("Enter");
    await expect(
      nav.getByRole("link", { name: "Parts inventory", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Payment records", exact: true }),
    ).toBeHidden();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-dashboard-shell-${width}.png`),
    });
    if (width <= 900) {
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Open dashboard navigation" }),
      ).toBeFocused();
    } else {
      const signOut = await page
        .getByRole("button", { name: "Sign out", exact: true })
        .boundingBox();
      expect((signOut?.y ?? 1000) + (signOut?.height ?? 0)).toBeLessThanOrEqual(
        width === 1655 ? 1133 : 960,
      );
    }
    expect(errors).toEqual([]);
  });
}

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} can collapse and restore the laptop sidebar without losing navigation`, async ({
    page,
  }) => {
    await session(page, role);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    const nav = page.getByRole("navigation", {
      name: role === "CUSTOMER" ? "Customer dashboard" : "Administration",
      exact: true,
    });
    await expect(nav).toBeVisible();
    const links = await nav
      .locator("a")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
    const toggle = page.getByRole("button", { name: "Collapse sidebar", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    const expand = page.getByRole("button", { name: "Expand sidebar", exact: true });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(expand).toBeFocused();
    await expect(nav).toBeVisible();
    expect(await nav.locator(":scope > a, :scope > button").count()).toBe(
      role === "CUSTOMER" ? 7 : role === "STAFF" ? 6 : 8,
    );
    for (const icon of await nav.locator("svg").all()) await expect(icon).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCSS("width", "80px");
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search dashboard pages" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-sidebar-collapsed-${role}.png`),
    });
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect(nav).toBeVisible();
    expect(
      await nav
        .locator("a")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("href")),
        ),
    ).toEqual(links);
    await toggle.click();
    const group = nav.getByRole("button").first();
    const groupName = await group.getAttribute("title");
    await group.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const summary = nav.locator("summary").filter({ hasText: groupName! });
    await expect(summary).toBeFocused();
    await expect(summary.locator("..")).toHaveAttribute("open", "");
  });
}

test("sidebar adapts between compact desktop and mobile without stranding keyboard focus", async ({
  page,
}) => {
  await session(page, "ADMIN");
  await page.setViewportSize({ width: 1655, height: 960 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "80px");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole("button", { name: "Close dashboard navigation" });
  await expect(mobile).toBeFocused();
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(nav).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(
    page.getByRole("button", { name: "Collapse sidebar", exact: true }),
  ).toBeFocused();
  await expect(nav).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("short laptop sidebar scrolls every group while keeping its controls visible", async ({
  page,
}) => {
  await session(page, "ADMIN");
  await page.setViewportSize({ width: 1366, height: 480 });
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(nav).toBeVisible();
  for (const summary of await nav.locator("summary").all()) await summary.click();
  const last = nav.locator("a").last();
  await last.focus();
  const box = await last.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y + box!.height).toBeLessThan(480);
  const scroller = page.locator(".dashboard-navigation-container");
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(scroller).toHaveCSS("scrollbar-width", "none");
  expect(
    await scroller.evaluate(
      (element) => getComputedStyle(element, "::-webkit-scrollbar").display,
    ),
  ).toBe("none");
  for (const name of ["Collapse sidebar", "Sign out"]) {
    const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
  }
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-sidebar-short-laptop.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
