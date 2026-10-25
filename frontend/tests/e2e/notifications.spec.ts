import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

import { notificationsFixture as fixture } from "../fixtures/customer-notifications";
import { showNotificationSettings } from "../fixtures/notification-settings";
const id = (n: number) => `b3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
test("customer inbox filters and cursor pages preserve query scope", async ({ page }) => {
  const state = await fixture(page);
  state.paginate = true;
  await page.goto("/dashboard/notifications");
  await expect(page).toHaveTitle(/Notifications/);
  await expect(page.getByRole("heading", { name: "Booking update" })).toBeVisible();
  if (
    !(await page
      .locator(".cn-filter-details")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator(".cn-filter-details > summary").click();
  await page.getByLabel("Notification type", { exact: true }).selectOption("BOOKING");
  await page
    .getByLabel("Notification category", { exact: true })
    .selectOption("TRANSACTIONAL");
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Older update" })).toBeVisible();
  expect(state.reads.at(-1)).toContain(`cursor=${id(1)}`);
  expect(state.reads.at(-1)).toContain("unreadOnly=true");
  if (
    !(await page
      .locator(".cn-filter-details")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator(".cn-filter-details > summary").click();
  await page.getByLabel("Notification type", { exact: true }).selectOption("PAYMENT");
  await expect(
    page.getByText("No notifications match this page and filters."),
  ).toBeVisible();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  expect(state.reads.at(-1)).not.toContain("cursor=");
});
test("individual read uses CSRF and confirmed server state", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/dashboard/notifications");
  await page.getByRole("button", { name: "Mark Booking update as read" }).click();
  await expect(
    page.getByText("Notification marked as read.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark Booking update as read" }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([
    {
      endpoint: `/customers/notifications/${id(1)}/read`,
      body: {},
      csrf: "isolated-notification-csrf-".repeat(3),
    },
  ]);
});
test("mark all explicitly includes hidden records and reports server count", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/notifications");
  if (
    !(await page
      .locator(".cn-filter-details")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator(".cn-filter-details > summary").click();
  await page.getByLabel("Notification type", { exact: true }).selectOption("PAYMENT");
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect(
    page.getByText(/includes notifications outside the current filters/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await confirm(page).click();
  await expect(
    page.getByText("1 notification marked as read.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({});
});
test("preferences derive defaults and require explicit marketing consent", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await expect(
    page.getByRole("article", { name: "Service updates by email" }),
  ).toContainText("On (default)");
  await expect(page.getByRole("article", { name: "Marketing by email" })).toContainText(
    "Off (default)",
  );
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await expect(page.getByText(/you consent to receive marketing/)).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
  expect(state.writes[0].body).toEqual({
    category: "MARKETING",
    channel: "EMAIL",
    enabled: true,
    expectedVersion: 0,
  });
  await page.getByRole("switch", { name: "Service updates by SMS", exact: true }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("switch", { name: "Service updates by SMS", exact: true }),
  ).toBeEnabled();
});
test("failed and malformed inbox responses never imply an empty account", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failInbox = true;
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await expect(
    page.getByRole("region", { name: "Inbox", exact: true }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByText("You have no notifications.")).toHaveCount(0);
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
  state.failInbox = false;
  state.malformed = true;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(
    page.getByText("We could not read this information. Please try again."),
  ).toBeVisible();
  state.malformed = false;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(page.getByRole("heading", { name: "Booking update" })).toBeVisible();
  await expect(page.getByText("private server details")).toHaveCount(0);
});
test("preference failures never invent enabled defaults", async ({ page }) => {
  const state = await fixture(page);
  state.failPreferences = true;
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await expect(
    page
      .getByRole("region", { name: "Delivery preferences", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark Booking update as read" }),
  ).toBeEnabled();
  state.failPreferences = false;
  await page.getByRole("button", { name: "Refresh preferences" }).click();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
});
for (const mode of ["unknown", "wrongResponse"] as const)
  test(`${mode} read update locks repeat writes`, async ({ page }) => {
    const state = await fixture(page);
    state[mode] = true;
    await page.goto("/dashboard/notifications");
    await page.getByRole("button", { name: "Mark Booking update as read" }).click();
    await expect(page.getByText(/A read update has an unknown outcome/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark all read", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Refresh inbox" }).click();
    expect(state.writes).toHaveLength(1);
  });
test("contradictory preference response never confirms consent or permits replay", async ({
  page,
}) => {
  const state = await fixture(page);
  state.wrongResponse = true;
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByText(/The preference change could not be confirmed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh preferences" }).click();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("staff notifications use only staff routes and expose own-account navigation", async ({
  page,
}) => {
  const state = await fixture(page, "STAFF");
  await page.goto("/admin/notifications");
  await showNotificationSettings(page);
  await expect(
    page.getByRole("link", { name: /^Notifications(?:, \d+ unread updates)?$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark Booking update as read" }).click();
  await expect(
    page.getByText("Notification marked as read.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Marketing by SMS", exact: true }).click();
  await confirm(page).click();
  await expect(
    page.getByRole("switch", { name: "Marketing by SMS", exact: true }),
  ).toBeEnabled();
  expect(state.reads.every((url) => url.startsWith("/staff/notifications"))).toBe(true);
  expect(
    state.writes.every((write) => write.endpoint.startsWith("/staff/notifications")),
  ).toBe(true);
});
test("account change removes notification content and an in-flight consent review", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delay = true;
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await confirm(page).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("heading", { name: "Booking update" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  state.release?.();
  await expect(page.getByText(/Delivery preference saved/)).toHaveCount(0);
});
test("mobile inbox and consent dialog are accessible with keyboard focus recovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await expect(page.getByRole("heading", { name: "Booking update" })).toBeVisible();
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
    path: path.join(os.tmpdir(), "allied-notifications-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-notifications-review-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-notifications-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("forbidden read changes show safe errors without a false success", async ({
  page,
}) => {
  const state = await fixture(page);
  state.deny = true;
  await page.goto("/dashboard/notifications");
  await page.getByRole("button", { name: "Mark Booking update as read" }).click();
  await expect(
    page.getByRole("region", { name: "Inbox", exact: true }).getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByText("Notification marked as read.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("private server details")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

test("malformed mark-all response locks resubmission without claiming success", async ({
  page,
}) => {
  const state = await fixture(page);
  state.wrongResponse = true;
  await page.goto("/dashboard/notifications");
  await page.getByRole("button", { name: "Mark all read", exact: true }).click();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(
    page.getByRole("button", { name: "Mark all read", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("1 notification marked as read.", { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});

for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads all personal updates through the staff endpoint`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    await page.goto("/admin/notifications");
    await page.getByRole("button", { name: "Mark all read", exact: true }).click();
    await confirm(page).click();
    await expect(
      page.getByText("1 notification marked as read.", { exact: true }),
    ).toBeVisible();
    expect(state.writes[0].endpoint).toBe("/staff/notifications/read-all");
  });

test("marketing without a recorded consent remains disabled", async ({ page }) => {
  const state = await fixture(page);
  state.preferences = [
    {
      category: "MARKETING",
      channel: "EMAIL",
      enabled: true,
      version: 1,
      consentedAt: null,
      updatedAt: time,
    },
  ];
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  await expect(
    page.getByRole("article", { name: "Marketing by email", exact: true }),
  ).toContainText("Off");
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
