import { showNotificationSettings } from "../fixtures/notification-settings";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  notificationResponsibilities,
  workforceNotificationsFixture,
} from "../fixtures/workforce-notifications";

const route = "/admin/notifications";
const mark = (page: Page) =>
  page.getByRole("button", { name: "Mark Booking update as read", exact: true });
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function ready(page: Page) {
  const state = await workforceNotificationsFixture(page);
  await page.goto(route);
  await expect(mark(page)).toBeEnabled();
  await showNotificationSettings(page);
  return state;
}

for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`managed notifications and review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    if (width > 900) {
      await expect(
        page.getByRole("button", { name: /^Open notifications(?:,.*)?$/ }),
      ).toBeVisible();
    } else {
      await page
        .getByRole("button", { name: "Open dashboard navigation", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("link", { name: /^Notifications(?:, \d+ unread updates)?$/ }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
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
    const opener = page.getByRole("switch", { name: "Marketing by email", exact: true });
    await opener.click();
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    expect(errors).toEqual([]);
  });

for (const template of Object.keys(notificationResponsibilities) as Array<
  keyof typeof notificationResponsibilities
>)
  test(`${template} can reach personal notifications without legacy privileges`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const state = await workforceNotificationsFixture(
      page,
      template,
      template === "OPERATIONS" ? "ADMIN" : "STAFF",
    );
    await page.goto(route);
    await expect(mark(page)).toBeEnabled();
    const nav = page.getByRole("navigation", { name: "Administration", exact: true });
    await expect(
      nav.getByRole("link", { name: /^Notifications(?:, \d+ unread updates)?$/ }),
    ).toBeVisible();
    const links = await nav
      .locator("a")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(
      links.every(
        (href) =>
          href === "/admin" ||
          href === "/admin/security" ||
          href === route ||
          (href === "/admin/fitment" &&
            ["OPERATIONS", "SALES_SUPERVISOR", "WORKSHOP_LEAD"].includes(template)) ||
          href?.startsWith("/admin/workforce/"),
      ),
    ).toBe(true);
    expect(
      state.requests.every(
        (path) =>
          path.startsWith("/auth/") ||
          path === "/staff/workforce/access" ||
          path.startsWith("/staff/notifications"),
      ),
    ).toBe(true);
    await page.goto("/admin/payments");
    await expect(
      page.getByRole("heading", { name: "Access unavailable", exact: true }),
    ).toBeVisible();
    expect(state.requests).not.toContain("/staff/payments");
  });

test("read marker and preference use existing account endpoints and exact payloads", async ({
  page,
}) => {
  const state = await ready(page);
  await mark(page).click();
  await expect(mark(page)).toHaveCount(0);
  expect(state.notifications.writes[0]).toMatchObject({
    endpoint: `/staff/notifications/${state.notifications.items[0].id}/read`,
    body: {},
  });
  const opener = page.getByRole("switch", {
    name: "Service updates by email",
    exact: true,
  });
  await opener.click();
  await page.keyboard.press("Escape");
  expect(state.notifications.writes).toHaveLength(1);
  await opener.click();
  await confirm(page).click();
  await expect(
    page.getByRole("switch", { name: "Service updates by email", exact: true }),
  ).toBeEnabled();
  expect(state.notifications.writes).toHaveLength(2);
  expect(state.notifications.writes[1]).toMatchObject({
    endpoint: "/staff/notifications/preferences/current",
    body: {
      category: "OPERATIONAL",
      channel: "EMAIL",
      enabled: false,
      expectedVersion: 0,
    },
  });
  expect(state.notifications.writes.every((write) => Boolean(write.csrf))).toBe(true);
  expect(state.notifications.writes[1].key).toBeTruthy();
});

test("initial workforce verification gates all notification reads and navigation", async ({
  page,
}) => {
  const state = await workforceNotificationsFixture(page);
  state.hold = true;
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Retry access check" })).toBeVisible();
  expect(state.notifications.reads).toEqual([]);
  await expect(page.getByRole("button", { name: "Open notifications" })).toHaveCount(0);
  state.hold = false;
  state.release?.();
  await expect(mark(page)).toBeEnabled();
});

test("denied and different-account workforce snapshots cannot mount the inbox", async ({
  page,
}) => {
  const state = await workforceNotificationsFixture(page);
  state.denied = true;
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Retry access check" })).toBeVisible();
  expect(state.notifications.reads).toEqual([]);
  state.denied = false;
  state.access.userId = "b4000000-0000-4000-8000-000000000099";
  await page.getByRole("button", { name: "Retry access check" }).click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  expect(state.notifications.reads).toEqual([]);
  state.access.userId = state.notifications.sessionUserId;
  await page.getByRole("button", { name: "Retry access check" }).click();
  await expect(mark(page)).toBeEnabled();
});

test("active account without assignments retains only personal access", async ({
  page,
}) => {
  const state = await workforceNotificationsFixture(page);
  state.access.assignments = [];
  state.access.permissions = [];
  await page.goto(route);
  await expect(mark(page)).toBeEnabled();
  await page.goto("/admin/workforce/jobs");
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(
    page.getByText(
      "Your current responsibilities do not permit that page. You can continue with the tools available here.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.requests).not.toContain("/staff/workforce/jobs");
  await page.getByRole("button", { name: /^Open notifications(?:,.*)?$/ }).click();
  await page.getByRole("link", { name: "View all notifications", exact: true }).click();
  await expect(mark(page)).toBeEnabled();
});

test("account switch detected during confirmation sends no preference mutation", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  state.notifications.sessionUserId = "b4000000-0000-4000-8000-000000000099";
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.notifications.writes).toEqual([]);
});

test("mobile page search navigates to personal notifications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search dashboard pages" })
    .fill("notifications");
  await page
    .locator(".dashboard-search-results")
    .getByRole("link", { name: /Notifications/ })
    .click();
  await expect(mark(page)).toBeEnabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
