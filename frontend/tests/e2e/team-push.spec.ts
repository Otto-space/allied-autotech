import { expect, test } from "@playwright/test";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
import AxeBuilder from "@axe-core/playwright";

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} has unread sidebar indicators and exact support links`, async ({
    page,
  }) => {
    const state = await notificationsFixture(page, role);
    state.items = [
      {
        ...notificationItem(),
        type: "ENQUIRY",
        resourceType: "ENQUIRY",
        title: "Customer reply",
        supportMessageId: notificationItem(3).id,
      },
    ];
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/notifications");
    await expect(
      page.getByRole("link", { name: "Open notifications, 1 unread", exact: true }),
    ).toBeVisible();
    const nav = page.locator("#dashboard-navigation");
    await nav
      .locator('summary[aria-label="Customers & Support, unread updates"]')
      .click();
    await expect(
      nav.getByRole("link", { name: "Customer care, 1 unread updates", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View update: Customer reply", exact: true }),
    ).toHaveAttribute(
      "href",
      `/admin/support/enquiries/${state.items[0].resourceId}?messageId=${state.items[0].supportMessageId}#support-entry-${state.items[0].supportMessageId}`,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  });
test("managed staff links remain in their permitted workspace", async ({ page }) => {
  const state = await workforceNotificationsFixture(page, "CUSTOMER_SERVICE");
  state.notifications.items = [
    {
      ...notificationItem(),
      type: "ENQUIRY",
      resourceType: "ENQUIRY",
      title: "Customer reply",
    },
  ];
  await page.goto("/admin/notifications");
  await expect(
    page.getByRole("link", { name: "View update: Customer reply", exact: true }),
  ).toHaveAttribute(
    "href",
    `/admin/workforce/enquiries?selected=${state.notifications.items[0].resourceId}`,
  );
});
test("browser push waits for opt-in, uses CSRF and offers device opt-out", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["notifications"]);
  await notificationsFixture(page);
  let enabled = false;
  const writes: string[] = [];
  const publicKey = "B" + "A".repeat(86);
  await page.route("**/api/v1/customers/notifications/push", async (route) => {
    if (route.request().method() !== "GET") {
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      enabled = route.request().method() === "PUT";
      writes.push(route.request().method());
    }
    await route.fulfill({
      json: {
        success: true,
        message: "Synthetic push settings",
        meta: { requestId: "push-test" },
        data: { available: true, publicKey, enabled },
      },
    });
  });
  await page.addInitScript(() => {
    let subscribed = false;
    Object.defineProperty(Notification, "requestPermission", {
      value: async () => {
        document.documentElement.dataset["pushPrompts"] = String(
          Number(document.documentElement.dataset["pushPrompts"] ?? 0) + 1,
        );
        return "granted";
      },
    });
    const sub = {
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
        keys: { p256dh: "synthetic", auth: "synthetic" },
      }),
      unsubscribe: async () => {
        subscribed = false;
        return true;
      },
    };
    PushManager.prototype.getSubscription = async () =>
      subscribed ? (sub as unknown as PushSubscription) : null;
    PushManager.prototype.subscribe = async () => {
      subscribed = true;
      return sub as unknown as PushSubscription;
    };
  });
  await page.goto("/dashboard/notifications");
  const enable = page.getByRole("button", { name: "Enable on this device", exact: true });
  await expect(enable).toBeEnabled();
  expect(await page.locator("html").getAttribute("data-push-prompts")).toBeNull();
  await enable.click();
  await expect(
    page.getByRole("button", { name: "Turn off on this device", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-push-prompts", "1");
  await page
    .getByRole("button", { name: "Turn off on this device", exact: true })
    .click();
  await expect(enable).toBeVisible();
  expect(writes).toEqual(["PUT", "DELETE"]);
});
test("push opens an owned notification's exact destination", async ({ page }) => {
  const state = await notificationsFixture(page);
  const item = { ...notificationItem(), type: "ENQUIRY", resourceType: "ENQUIRY" };
  await page.route(`**/api/v1/customers/notifications/${item.id}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Synthetic owned update",
        meta: { requestId: "push-open" },
        data: item,
      },
    }),
  );
  await page.goto(`/dashboard/notifications?notification=${state.items[0].id}`);
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/support/enquiries/${item.resourceId}$`),
  );
});
