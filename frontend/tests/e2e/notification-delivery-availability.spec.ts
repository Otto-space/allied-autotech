import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { notificationsFixture } from "../fixtures/customer-notifications";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
import { showNotificationSettings } from "../fixtures/notification-settings";

const article = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });
for (const [role, width] of [
  ["CUSTOMER", 360],
  ["CUSTOMER", 390],
  ["CUSTOMER", 768],
  ["CUSTOMER", 1440],
  ["STAFF", 390],
  ["ADMIN", 1440],
  ["SUPER_ADMIN", 390],
] as const)
  test(`${role} separates saved preference and delivery availability at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state =
      role === "STAFF"
        ? (await workforceNotificationsFixture(page)).notifications
        : await notificationsFixture(page, role);
    await page.goto(
      role === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications",
    );
    await showNotificationSettings(page);
    const sms = article(page, "Service updates by SMS");
    await expect(sms).toContainText("Default preference: On");
    await expect(sms.getByText("Delivery unavailable", { exact: true })).toBeVisible();
    await expect(
      article(page, "Service updates by email").getByText("Service enabled", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      article(page, "Marketing by email").getByText("Delivery unavailable", {
        exact: true,
      }),
    ).toBeVisible();
    const explanation = page.getByText("How delivery preferences work", { exact: true });
    await explanation.scrollIntoViewIfNeeded();
    await page.keyboard.press("Tab");
    // Start native tab traversal at a known preceding control, then reach the disclosure.
    await page.getByRole("switch", { name: "Marketing by SMS", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(explanation).toBeFocused();
    expect(
      await explanation.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(/Your preference records whether you want optional messages/),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(/Your preference records whether you want optional messages/),
    ).not.toBeVisible();
    const toggle = sms.getByRole("switch");
    await toggle.hover();
    await expect(toggle).toBeChecked();
    expect(
      await toggle.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    expect(state.writes).toHaveLength(0);
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
      path: info.outputPath(`delivery-${role}-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

test("saved SMS choice survives reload while delivery stays unavailable; marketing still requires consent", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  const sms = article(page, "Service updates by SMS");
  await sms.getByRole("switch").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(sms).toContainText("Saved preference: Off");
  await page.reload();
  await showNotificationSettings(page);
  await expect(sms).toContainText("Saved preference: Off");
  await expect(sms.getByText("Delivery unavailable", { exact: true })).toBeVisible();
  await article(page, "Marketing by email").getByRole("switch").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("you consent to receive marketing");
  await expect(dialog).toContainText("Marketing delivery is not available yet");
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({
    category: "OPERATIONAL",
    channel: "SMS",
    enabled: false,
    expectedVersion: 0,
  });
});

test("missing availability is unknown; failed refresh invalidates previously known availability and locks writes", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  state.channels = undefined;
  await page.goto("/dashboard/notifications");
  await showNotificationSettings(page);
  const settings = page.getByRole("region", {
    name: "Delivery preferences",
    exact: true,
  });
  await expect(settings.getByText("Availability unknown", { exact: true })).toHaveCount(
    4,
  );
  state.channels = { email: true, sms: false, marketing: false };
  await settings
    .getByRole("button", { name: "Refresh preferences", exact: true })
    .click();
  await expect(settings.getByText("Service enabled", { exact: true })).toHaveCount(1);
  state.failPreferences = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(settings.getByRole("alert")).toContainText(
    "Saved preferences may be out of date",
  );
  await expect(settings.getByText("Availability unknown", { exact: true })).toHaveCount(
    4,
  );
  await expect(settings.getByText("Service enabled", { exact: true })).toHaveCount(0);
  for (const toggle of await settings.getByRole("switch").all())
    await expect(toggle).toBeDisabled();
  await settings
    .getByRole("button", { name: "Refresh preferences", exact: true })
    .click();
  await expect(settings.getByRole("alert")).toContainText(
    "The request could not be completed",
  );
  await expect(settings.getByRole("switch")).toHaveCount(0);
  await expect(settings.getByText("Service enabled", { exact: true })).toHaveCount(0);
  state.failPreferences = false;
  await settings
    .getByRole("button", { name: "Refresh preferences", exact: true })
    .click();
  await expect(settings.getByText("Service enabled", { exact: true })).toHaveCount(1);
  expect(state.writes).toHaveLength(0);
});
