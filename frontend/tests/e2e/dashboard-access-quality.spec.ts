import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";
import { workforceOverviewFixture } from "../fixtures/workforce-overview";
import { workBookingsFixture, bookingId } from "../fixtures/work-bookings";
import inventory from "../../docs/ui-quality-inventory.json";
import { workStaffDetailFixture } from "../fixtures/work-staff-detail";
import os from "node:os";
import path from "node:path";

test("responsibility management starts from a verified staff account", async ({
  page,
}) => {
  await workStaffDetailFixture(page, "SUPER_ADMIN");
  await page.goto("/admin/workforce/access");
  await expect(
    page.getByRole("heading", { name: "Team responsibilities", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: "Find a staff account", exact: true }),
  ).toHaveAttribute("href", "/admin/staff");
  await expect(page.getByLabel("Staff user reference", { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if ([390, 1440].includes(width)) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: path.join(os.tmpdir(), `workforce-entry-${width}.png`),
      });
    }
  }
});

test("unmanaged staff receive an explained responsibility-management denial", async ({
  page,
}) => {
  await workBookingsFixture(page, "STAFF");
  await page.goto("/admin/workforce/access");
  await expect(
    page.getByRole("heading", {
      name: "Responsibility management unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: "Return to overview", exact: true }),
  ).toHaveAttribute("href", "/admin");
  await expect(page.getByLabel("Staff user reference", { exact: true })).toHaveCount(0);
});

test("legacy staff permission failures remove capability links and offer retry", async ({
  page,
}) => {
  await workBookingsFixture(page, "STAFF");
  let unavailable = false;
  await page.route("**/api/v1/staff/profile", (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: { success: false, error: { code: "UNAVAILABLE" } } }
        : {
            json: {
              success: true,
              message: "Synthetic permission check",
              meta: { requestId: "dashboard-access" },
              data: {
                id: bookingId(302),
                email: "staff@example.test",
                role: "STAFF",
                status: "ACTIVE",
                capabilities: ["REFUND_APPROVE"],
                staffProfile: null,
              },
            },
          },
    ),
  );
  await page.goto("/admin");
  const link = page.locator('.dashboard-navigation-container a[href="/admin/refunds"]');
  await expect(link).toHaveCount(1);
  unavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("button", { name: "Retry work permissions", exact: true }),
  ).toBeVisible();
  await expect(link).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Retry work permissions", exact: true }).click();
  await expect(link).toHaveCount(1);
});

test("every currently restricted customer route preserves the enquiry launch boundary", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE !== "browse_enquiries",
    "Current-launch acceptance only",
  );
  await fixture(page, "CUSTOMER");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  const restricted = inventory.routes.filter(({ route }) =>
    /^\/dashboard\/(?:cart|orders|bookings|payments|vehicle-transactions|inspections|invoices)(?:\/|$)/.test(
      route,
    ),
  );
  expect(restricted.length).toBeGreaterThan(10);
  for (const { route } of restricted) {
    const response = await page.request.get(route.replace(/\[[^\]]+\]/g, bookingId(1)), {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location).pathname).toBe("/contact");
    expect(new URL(response.headers().location).hash).toBe("#enquiry");
  }
  await page.goto("/dashboard/cart");
  await expect(page).toHaveURL(/\/contact#enquiry$/);
  await expect(page.locator("#enquiry")).toBeVisible();
  expect(writes).toEqual([]);
});

for (const role of ["STAFF", "ADMIN"])
  test(`unverified managed ${role} access hides stale work and retries`, async ({
    page,
  }) => {
    const state = await workforceOverviewFixture(page);
    await page.setViewportSize({ width: role === "STAFF" ? 390 : 1440, height: 900 });
    state.notifications.role = role;
    let unavailable = false;
    await page.route("**/api/v1/staff/workforce/access", (route) =>
      unavailable
        ? route.fulfill({
            status: 503,
            json: { success: false, error: { code: "UNAVAILABLE" } },
          })
        : route.fallback(),
    );
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toBeVisible();
    unavailable = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.getByRole("heading", { name: "Work access unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('.dashboard-navigation-container a[href^="/admin/workforce/"]'),
    ).toHaveCount(0);
    await expect(
      page.getByText("Checking current responsibility access", { exact: false }),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(os.tmpdir(), `dashboard-access-${role}-error.png`),
    });
    unavailable = false;
    await page.getByRole("button", { name: "Retry access check", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Operational overview", exact: true }),
    ).toBeVisible();
  });

test("session check has a named page and announced pending state", async ({ page }) => {
  await fixture(page, "CUSTOMER");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Opening your dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Verifying your session");
  release();
  await expect(page.locator(".customer-care")).toBeVisible();
});

for (const audience of ["customer", "admin", "managed"])
  test(`${audience} drawer wraps keyboard focus and restores it on Escape`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (audience === "managed") await workforceOverviewFixture(page);
    else await fixture(page, audience === "customer" ? "CUSTOMER" : "ADMIN");
    await page.goto(audience === "customer" ? "/dashboard" : "/admin");
    const trigger = page.getByRole("button", {
      name: "Open dashboard navigation",
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Dashboard navigation",
      exact: true,
    });
    const first = dialog.getByRole("button", {
      name: "Close dashboard navigation",
      exact: true,
    });
    const last = dialog.getByRole("button", { name: "Sign out", exact: true });
    await last.focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
