import { showNotificationSettings } from "../fixtures/notification-settings";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";
const route = "/dashboard/notifications";
const mark = (page: Page) =>
  page.getByRole("button", { name: "Mark Booking update as read", exact: true });
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
const inbox = (page: Page) => page.getByRole("region", { name: "Inbox", exact: true });
async function ready(page: Page) {
  const state = await notificationsFixture(page);
  await page.goto(route);
  await expect(mark(page)).toBeEnabled();
  await showNotificationSettings(page);
  return state;
}

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`notification layout ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await notificationsFixture(page);
    state.items = [
      notificationItem(1),
      { ...notificationItem(2), readAt: "2026-10-12T10:00:00Z" },
    ];
    await page.goto(route);
    await showNotificationSettings(page);
    await expect(mark(page)).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Mark Older update as read" }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("article", { name: "Marketing by email", exact: true })
        .getByText("Delivery unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
  });

for (const width of [320, 390, 768, 1440])
  test(`notification accessibility and confirmation ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
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
  });

test("empty account and filtered empty remain distinct", async ({ page }) => {
  const state = await ready(page);
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
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(mark(page)).toBeEnabled();
  state.items = [];
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(page.getByText("You have no notifications.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});

test("foreground error hides old rows and denied recovery clears content", async ({
  page,
}) => {
  const state = await ready(page);
  state.failInbox = true;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(inbox(page).getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Booking update" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark all read", exact: true }),
  ).toBeDisabled();
  state.failStatus = 403;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(page.getByText("You have no notifications.")).toHaveCount(0);
  state.failInbox = false;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(mark(page)).toBeEnabled();
});

test("background stale inbox and preferences lock writes independently", async ({
  page,
}) => {
  const state = await ready(page);
  state.failInbox = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "These updates may be out of date. Refresh the inbox before making read changes.",
    ),
  ).toBeVisible();
  await expect(mark(page)).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
  state.failInbox = false;
  state.failPreferences = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "Saved preferences may be out of date. Refresh preferences before making changes.",
    ),
  ).toBeVisible();
  await expect(mark(page)).toBeEnabled();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeDisabled();
});

test("refresh in progress disables mutations while retaining the rows", async ({
  page,
}) => {
  const state = await ready(page);
  state.readDelay = 1400;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Refreshing notifications...")).toBeVisible();
  await expect(mark(page)).toBeDisabled();
  await expect(mark(page)).toBeEnabled();
});

test("read recovery survives reload and requires manual refresh and acknowledgement", async ({
  page,
}) => {
  const state = await ready(page);
  state.unknown = true;
  await mark(page).click();
  await expect(page.getByText("A read update has an unknown outcome.")).toBeVisible();
  await page.reload();
  const ack = page.getByRole("button", { name: "I've checked the inbox", exact: true });
  await expect(ack).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(ack).toBeDisabled();
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(ack).toBeEnabled();
  await ack.click();
  await expect(mark(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test("preference recovery reconciles committed result without repeating consent", async ({
  page,
}) => {
  const state = await ready(page);
  state.wrongResponse = true;
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await confirm(page).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  // Legacy clients retained only uncertainty; keep that compatibility path covered.
  await page.evaluate(() =>
    sessionStorage.setItem(
      "aat:notification-write:v1:b3000000-0000-4000-8000-000000000020:preferences",
      "pending",
    ),
  );
  await page.reload();
  await showNotificationSettings(page);
  const ack = page.getByRole("button", { name: "I've checked preferences", exact: true });
  await expect(ack).toBeDisabled();
  await page.getByRole("button", { name: "Refresh preferences" }).click();
  await expect(ack).toBeEnabled();
  await ack.click();
  await expect(
    page.getByRole("switch", { name: "Marketing by email", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

test("another account never inherits recovery marker", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "aat:notification-write:v1:b3000000-0000-4000-8000-000000000999:inbox",
      "pending",
    ),
  );
  await ready(page);
  await expect(page.getByText("A read update has an unknown outcome.")).toHaveCount(0);
});

test("storage unavailable prevents both kinds of write", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  const state = await ready(page);
  await mark(page).click();
  await expect(
    inbox(page).getByText(/Your browser could not save the recovery marker/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("preflight detects a different customer before read or consent", async ({
  page,
}) => {
  const state = await ready(page);
  state.sessionUserId = "b3000000-0000-4000-8000-000000000999";
  await mark(page).click();
  await expect(inbox(page).getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("stale data arriving while review is open blocks confirmation", async ({ page }) => {
  const state = await ready(page);
  await page.getByRole("switch", { name: "Marketing by email", exact: true }).click();
  state.failPreferences = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "Saved preferences may be out of date. Refresh preferences before making changes.",
    ),
  ).toBeAttached();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});

test("Retry-After blocks fresh attempts until the cooldown completes", async ({
  page,
}) => {
  const state = await ready(page);
  state.retryAfter = "3";
  await mark(page).click();
  await expect(
    page.getByText(/Please wait [1-3] seconds before making another change/),
  ).toBeVisible();
  await expect(mark(page)).toBeDisabled();
  await expect(mark(page)).toBeEnabled({ timeout: 6000 });
  expect(state.writes).toHaveLength(1);
});

test("long messages preserve text and short mobile dialog stays scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const state = await notificationsFixture(page);
  state.items[0].title = "W".repeat(160);
  state.items[0].message = "M".repeat(1900);
  await page.goto(route);
  await showNotificationSettings(page);
  await expect(
    page.getByRole("heading", { name: state.items[0].title, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole("switch", { name: "Marketing by SMS", exact: true }).click();
  await confirm(page).scrollIntoViewIfNeeded();
  await expect(confirm(page)).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot fetch customer notifications through direct route`, async ({
    page,
  }) => {
    const state = await notificationsFixture(page, role);
    await page.goto(route);
    await expect(page).not.toHaveURL(/dashboard\/notifications/);
    expect(state.reads.some((p) => p.startsWith("/customers/notifications"))).toBe(false);
  });

test("failed next page retains Previous for recovery", async ({ page }) => {
  const state = await ready(page);
  state.paginate = true;
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  state.failInbox = true;
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(inbox(page).getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
  state.failInbox = false;
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(mark(page)).toBeEnabled();
});

test("failed manual recovery cannot be acknowledged after a background-only success", async ({
  page,
}) => {
  const state = await ready(page);
  state.unknown = true;
  await mark(page).click();
  await expect(page.getByText("A read update has an unknown outcome.")).toBeVisible();
  state.failInbox = true;
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(inbox(page).getByRole("alert").first()).toBeVisible();
  state.failInbox = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "Booking update", exact: true }),
  ).toBeVisible();
  const ack = page.getByRole("button", { name: "I've checked the inbox", exact: true });
  await expect(ack).toBeDisabled();
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(ack).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

for (const mode of ["error", "uncertain", "stale", "empty"] as const)
  test(`notification ${mode} state accessibility`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await ready(page);
    if (mode === "uncertain") {
      state.unknown = true;
      await mark(page).click();
      await expect(page.getByText("A read update has an unknown outcome.")).toBeVisible();
    } else if (mode === "stale") {
      state.failInbox = true;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByText(/These updates may be out of date/)).toBeVisible();
    } else {
      if (mode === "error") state.failInbox = true;
      else state.items = [];
      await page.getByRole("button", { name: "Refresh inbox" }).click();
      if (mode === "error") await expect(inbox(page).getByRole("alert")).toBeVisible();
      else await expect(page.getByText("You have no notifications.")).toBeVisible();
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
