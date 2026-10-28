import { test, expect } from "@playwright/test";
import { customerSupportFixture } from "../fixtures/customer-support";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";
import { fixture as overviewFixture } from "../fixtures/overview-browser";

for (const width of [390, 1440]) {
  test(`reply shortcut focuses the existing draft and copies the complete reference at ${width}`, async ({
    page,
  }) => {
    const state = await customerSupportFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copied = text;
          },
        },
      }),
    );
    await page.goto(`/dashboard/support/enquiries/${state.records.enquiries.id}`);
    const reply = page.getByRole("textbox", { name: "Reply text" });
    await reply.fill("Keep this unsent fictional draft");
    const shortcut = page.getByRole("link", { name: "Reply to this request" });
    await shortcut.focus();
    await page.keyboard.press("Enter");
    await expect(reply).toBeFocused();
    await expect(reply).toHaveValue("Keep this unsent fictional draft");
    await page.getByRole("button", { name: "Copy full case reference" }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-copied",
      state.records.enquiries.id,
    );
    expect(state.writes).toHaveLength(0);
  });
  test(`booking card foreground survives navigating from Customer Care at ${width}`, async ({
    page,
  }) => {
    await customerSupportFixture(page);
    await page.goto("/dashboard/support");
    await expect(
      page.getByRole("heading", { name: "Your conversations", exact: true }),
    ).toBeVisible();
    await overviewFixture(page, "CUSTOMER");
    await page.setViewportSize({ width, height: 900 });
    // Client navigation deliberately retains styles loaded by the Care route.
    const menu = page.getByRole("button", { name: "Open dashboard navigation" });
    if (await menu.isVisible()) await menu.click();
    await page
      .locator("nav.side-nav:visible")
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await expect(page.locator(".customer-care-next h2")).toHaveCSS(
      "color",
      "rgb(8, 12, 15)",
    );
    await expect(page.locator(".customer-care-next")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
  });
  test(`privacy headings, contents and footer destinations at ${width}`, async ({
    page,
  }) => {
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({ status: 401, json: { success: false } }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy notice", exact: true }),
    ).toBeVisible();
    for (const heading of await page.locator(".privacy-notice h2").all()) {
      expect(
        await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
      ).toBeLessThan(30);
    }
    await page
      .getByRole("navigation", { name: "Privacy notice contents" })
      .getByRole("link", { name: "Who receives information" })
      .click();
    await expect(page).toHaveURL(/#privacy-recipients$/);
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Privacy", exact: true }),
    ).toHaveAttribute("href", "/privacy");
    await expect(
      page.getByRole("link", { name: /Allied AutoTech on Instagram/ }),
    ).toHaveAttribute("href", "https://www.instagram.com/alliedautotech/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
}

test("all-read inbox disables bulk action, but a filtered view does not hide unread scope", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  state.items = [{ ...notificationItem(), readAt: "2026-10-27T08:00:00Z" }];
  await page.goto("/dashboard/notifications");
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  state.items.push({ ...notificationItem(2), type: "SYSTEM", readAt: null });
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeEnabled();
  await page.locator(".cn-filter-details > summary").click();
  await page.getByLabel("Notification type", { exact: true }).selectOption("BOOKING");
  await expect(page.getByRole("button", { name: "Mark all read" })).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
