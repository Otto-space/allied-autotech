import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";
import {
  workforceNotificationsFixture,
  notificationResponsibilities,
} from "../fixtures/workforce-notifications";
import { showNotificationSettings } from "../fixtures/notification-settings";
const out = path.join(os.tmpdir(), "allied-notifications-cycle-20261025");

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  for (const width of [390, 1440])
    test(`${role} notification journey at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const state = await notificationsFixture(page, role);
      state.items = Array.from({ length: 30 }, (_, n) => ({
        ...notificationItem(n + 1),
        title: `Synthetic account update ${n + 1}`,
      }));
      const inbox =
        role === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications";
      await page.goto(inbox);
      await expect(page).toHaveTitle(/Notifications/i);
      await expect(
        page.getByRole("heading", { name: "Notifications", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Synthetic account update 1", exact: true }),
      ).toBeVisible();
      expect(state.reads.some((s) => s.includes("preferences/current"))).toBe(false);
      await expect(
        page.getByRole("region", { name: "Delivery preferences", exact: true }),
      ).toHaveCount(0);
      const bell = page.getByRole("button", {
        name: "Open notifications, 30 unread",
        exact: true,
      });
      await expect(bell).toBeVisible();
      await page.screenshot({
        path: path.join(out, `${role.toLowerCase()}-inbox-${width}.png`),
      });
      await bell.focus();
      await page.keyboard.press("Enter");
      const preview = page.getByRole("dialog", { name: "Notifications", exact: true });
      await expect(
        preview.getByRole("link", { name: /Synthetic account update/ }),
      ).toHaveCount(5);
      await expect(preview.getByText("30 unread in your inbox")).toBeVisible();
      await expect(
        preview.getByRole("link", { name: "View all notifications" }),
      ).toHaveAttribute("href", inbox);
      expect(state.writes).toEqual([]);
      await page.screenshot({
        path: path.join(out, `${role.toLowerCase()}-preview-${width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(bell).toBeFocused();
      await page
        .getByRole("button", {
          name: "Mark Synthetic account update 1 as read",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Mark Synthetic account update 1 as unread",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Open notifications, 29 unread", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Mark Synthetic account update 1 as unread",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", { name: "Open notifications, 30 unread", exact: true }),
      ).toBeVisible();
      await showNotificationSettings(page);
      const marketing = page.getByRole("switch", {
        name: "Marketing by email",
        exact: true,
      });
      await expect(marketing).not.toBeChecked();
      await expect(
        page.getByRole("switch", { name: "Service updates by email", exact: true }),
      ).toBeChecked();
      await expect(page.getByText(/Background push is not configured/)).toBeVisible();
      await page.screenshot({
        path: path.join(out, `${role.toLowerCase()}-settings-${width}.png`),
      });
      await marketing.click();
      await expect(page.getByRole("dialog")).toContainText(
        "Marketing delivery is not available yet",
      );
      await page.keyboard.press("Escape");
      await expect(marketing).toBeFocused();
      expect(state.writes).toHaveLength(2);
      expect(
        state.writes.every((s) =>
          s.endpoint.startsWith(
            `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/`,
          ),
        ),
      ).toBe(true);
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
      expect(errors).toEqual([]);
      await expect(
        page.locator("nextjs-portal").filter({ hasText: /Build Error|Runtime Error/ }),
      ).toHaveCount(0);
    });

for (const width of [360, 768, 1024])
  test(`long notification content reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await notificationsFixture(page);
    state.items = [
      {
        ...notificationItem(),
        title: "Synthetic " + "W".repeat(145),
        message: "Synthetic reference " + "M".repeat(1800),
      },
    ];
    await page.goto("/dashboard/notifications");
    await expect(
      page.getByRole("heading", { name: state.items[0].title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await showNotificationSettings(page);
    await page.screenshot({ path: path.join(out, `settings-reflow-${width}.png`) });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

for (const template of Object.keys(
  notificationResponsibilities,
) as (keyof typeof notificationResponsibilities)[])
  test(`${template} uses personal notifications without additional privileges`, async ({
    page,
  }) => {
    const state = await workforceNotificationsFixture(
      page,
      template,
      template === "OPERATIONS" ? "ADMIN" : "STAFF",
    );
    await page.goto("/admin/notifications");
    await expect(
      page.getByRole("button", { name: "Mark Booking update as read", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Open notifications, 1 unread", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Notifications", exact: true })
        .getByText("Booking update", { exact: true }),
    ).toBeVisible();
    expect(state.notifications.writes).toEqual([]);
    expect(
      state.notifications.reads.every((s) => s.startsWith("/staff/notifications")),
    ).toBe(true);
  });

test("empty inbox has no pagination; filter-empty and failed requests are distinct", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  state.items = [];
  await page.goto("/dashboard/notifications");
  await expect(page.getByText("You have no notifications.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  if (
    !(await page
      .locator(".cn-filter-details")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator(".cn-filter-details > summary").click();
  await page.getByLabel("Notification type", { exact: true }).selectOption("ENQUIRY");
  await expect(
    page.getByText("No notifications match this page and filters."),
  ).toBeVisible();
  state.failInbox = true;
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Inbox", exact: true }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByText("You have no notifications.")).toHaveCount(0);
});

test("read updates reconcile in another tab without marking preview rows read", async ({
  page,
  context,
}) => {
  const state = await notificationsFixture(page);
  const second = await context.newPage();
  await second.route("**/api/v1/**", (route) => route.fallback());
  // Share fixture state across pages via context routing to model one account.
  await page.goto("/dashboard/notifications");
  const secondary = await notificationsFixture(second);
  secondary.items = state.items;
  await second.goto("/dashboard/notifications");
  await expect(
    second.getByRole("button", { name: "Open notifications, 1 unread", exact: true }),
  ).toBeVisible();
  await page.bringToFront();
  await page
    .getByRole("button", { name: "Mark Booking update as read", exact: true })
    .click();
  await second.bringToFront();
  await expect(
    second.getByRole("button", { name: "Mark Booking update as unread", exact: true }),
  ).toBeEnabled();
  await expect(second.locator(".dashboard-icon-link .notification-badge")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(secondary.writes).toEqual([]);
  await second.close();
});

test("preview rows stay stable while unread counts update", async ({ page }) => {
  const state = await notificationsFixture(page);
  await page.goto("/dashboard/notifications");
  await page
    .getByRole("button", { name: "Open notifications, 1 unread", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(preview.getByText("Booking update", { exact: true })).toBeVisible();
  state.items.unshift({ ...notificationItem(7), title: "Synthetic new arrival" });
  await page.evaluate(
    (userId) =>
      window.dispatchEvent(
        new CustomEvent("aat-notifications-changed", { detail: userId }),
      ),
    state.sessionUserId,
  );
  await expect(preview.getByText("2 unread in your inbox")).toBeVisible();
  await expect(preview.getByText("Synthetic new arrival")).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("enquiry release gives a permitted Contact fallback for historical commerce updates", async ({
  page,
}) => {
  await notificationsFixture(page);
  await page.goto("/dashboard/notifications");
  await expect(
    page.getByRole("link", {
      name: "Contact about this update: Booking update",
      exact: true,
    }),
  ).toHaveAttribute("href", "/contact");
});

test("preview dismisses outside, restores focus, and settings reflow with doubled text and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await notificationsFixture(page);
  await page.goto("/dashboard/notifications");
  const bell = page.getByRole("button", {
    name: "Open notifications, 1 unread",
    exact: true,
  });
  await bell.click();
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x - 5, box!.y + 10);
  await expect(dialog).not.toBeVisible();
  await expect(bell).toBeFocused();
  await showNotificationSettings(page);
  // Simulate text-only enlargement; this does not certify physical browser zoom.
  await page.evaluate(() => {
    const text = [
      ...document.querySelectorAll<HTMLElement>(
        "main h1, main h2, main h3, main p, main button, main label, main summary, main a, main time, main span",
      ),
    ].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
    for (const [el, size] of text) el.style.fontSize = `${size * 2}px`;
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeFocused();
});
