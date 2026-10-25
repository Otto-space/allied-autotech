import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  notificationsFixture,
  notificationItem,
} from "../fixtures/customer-notifications";
const route = "/dashboard/notifications";
const enquiry = (n = 1) => ({
  ...notificationItem(n),
  title: `Enquiry update ${n}`,
  type: "ENQUIRY" as const,
  resourceType: "ENQUIRY",
});

for (const width of [430, 1440])
  test(`bell and sidebar reflect read state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await notificationsFixture(page);
    state.items = [enquiry(1), enquiry(2)];
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "Open notifications, 2 unread", exact: true }),
    ).toBeVisible();
    if (width < 901) {
      const bell = await page.locator(".dashboard-icon-link").boundingBox();
      const account = await page.locator(".dashboard-account-link").boundingBox();
      const logout = await page.locator(".dashboard-mobile-logout").boundingBox();
      expect(bell!.x + bell!.width).toBeLessThanOrEqual(account!.x);
      expect(account!.x + account!.width).toBeLessThanOrEqual(logout!.x);
    }
    if (width < 901)
      await page.getByRole("button", { name: "Open dashboard navigation" }).click();
    const nav =
      width < 901
        ? page.locator("#dashboard-mobile-navigation")
        : page.locator("#dashboard-navigation");
    await expect(
      nav.locator('summary[aria-label="Support, unread updates"] .notification-badge'),
    ).toBeVisible();
    await nav.locator('summary[aria-label="Support, unread updates"]').click();
    await expect(
      nav.getByRole("link", { name: "Customer care, 2 unread updates", exact: true }),
    ).toBeVisible();
    if (width < 901)
      await page.getByRole("button", { name: "Close dashboard navigation" }).click();
    await page
      .getByRole("button", { name: "Mark Enquiry update 1 as read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Open notifications, 1 unread", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mark all read", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(page.locator(".dashboard-icon-link .notification-badge")).toHaveCount(0);
    await expect(page.locator(".side-nav .notification-badge")).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test("large count and collapsed sidebar remain visible without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await notificationsFixture(page);
  state.items = Array.from({ length: 100 }, (_, n) => enquiry(n + 1));
  await page.goto(route);
  await expect(
    page.getByRole("button", { name: "Open notifications, 100 unread", exact: true }),
  ).toHaveText("99+");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page
      .getByRole("button", {
        name: "Open Support navigation, unread updates",
        exact: true,
      })
      .locator(".notification-badge-dot"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});

test("notifications link to the exact conversation and an older review detail", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  const reviewId = notificationItem(9).resourceId!;
  state.items = [
    enquiry(),
    {
      ...notificationItem(3),
      type: "REVIEW",
      resourceType: "REVIEW",
      resourceId: reviewId,
      title: "Review moderation update",
    },
  ];
  await page.route("**/api/v1/customers/support/reviews?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("reviewId")).toBe(reviewId);
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic",
        meta: { requestId: "test" },
        data: {
          items: [
            {
              id: reviewId,
              targetType: "BUSINESS",
              rating: 4,
              title: "My older review",
              comment: "An earlier workshop visit.",
              status: "REJECTED",
              version: 1,
              productId: null,
              orderItemId: null,
              serviceId: null,
              bookingId: null,
              orderId: null,
              vehicleTransactionId: null,
              product: null,
              service: null,
              moderationNote: "Please remove personal contact information.",
              moderatedAt: "2026-10-20T10:00:00Z",
              createdAt: "2020-01-01T00:00:00Z",
              updatedAt: "2026-10-20T10:00:00Z",
            },
          ],
        },
      },
    });
  });
  await page.goto(route);
  await expect(
    page.getByRole("link", { name: "View enquiry: Enquiry update 1", exact: true }),
  ).toHaveAttribute("href", `/dashboard/support/enquiries/${enquiry().resourceId}`);
  await page
    .getByRole("link", { name: "View review: Review moderation update", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/reviews/${reviewId}$`), {
    timeout: 40000,
  });
  await expect(
    page.getByRole("heading", { name: "My older review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Please remove personal contact information.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Mark displayed updates as read", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({
    endpoint: "/customers/notifications/read-context",
    body: {
      resourceType: "REVIEW",
      resourceId: reviewId,
      notificationIds: [notificationItem(3).id],
    },
  });
  expect(state.items.find((item) => item.id === enquiry().id)?.readAt).toBeNull();
});

test("manual refresh discovers new unread updates and an error never shows a false count", async ({
  page,
}) => {
  const state = await notificationsFixture(page);
  state.items = [];
  await page.goto(route);
  await expect(page.getByText("You have no notifications.")).toBeVisible();
  state.items = [enquiry()];
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open notifications, 1 unread", exact: true }),
  ).toBeVisible();
  state.failInbox = true;
  await page.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open notifications, unread status unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-icon-link .notification-badge")).toHaveCount(0);
});
