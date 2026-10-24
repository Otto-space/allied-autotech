import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workPaymentFixture, paymentRow } from "../fixtures/work-payments";
import { workforceBookingsFixture } from "../fixtures/workforce-bookings";
import { workThreadFixture, threadMessage } from "../fixtures/work-support-detail";
import { bookingDetailFixture, detailId } from "../fixtures/customer-booking-detail";
import { customerSupportFixture } from "../fixtures/customer-support";
import { notificationItem } from "../fixtures/customer-notifications";
import type { InboxNotification } from "@/lib/api/notification-schemas";

const recordPath = `/dashboard/bookings/${detailId}`;
const item = (n = 1, resourceId = detailId): InboxNotification => ({
  ...notificationItem(n),
  resourceType: "BOOKING",
  resourceId,
  destination: {
    section: "/dashboard/bookings",
    href: `/dashboard/bookings/${resourceId}`,
    label: "View booking",
  },
  title: `Booking update ${n}`,
});
function state(items = [item()]) {
  return {
    items,
    writes: [] as { resourceId: string; notificationIds: string[] }[],
    failRead: false,
    holdContext: false,
    release: undefined as (() => void) | undefined,
  };
}
async function notifications(
  page: Page,
  data: ReturnType<typeof state>,
  audience = "CUSTOMER",
) {
  const base =
    audience === "CUSTOMER" ? "/customers/notifications" : "/staff/notifications";
  const inbox =
    audience === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications";
  await page.route(`**/api/v1${base}**`, async (route: Route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1", "");
    const reply = (value: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic notification context",
          data: value,
          meta: { requestId: "test" },
        },
      });
    const unread = data.items.filter((n) => !n.readAt);
    if (route.request().method() === "POST" && path === `${base}/read-context`) {
      const body = route.request().postDataJSON();
      data.writes.push(body);
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      if (data.failRead)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
        });
      let updated = 0;
      for (const n of data.items)
        if (
          n.resourceId === body.resourceId &&
          body.notificationIds.includes(n.id) &&
          !n.readAt
        ) {
          n.readAt = new Date().toISOString();
          updated++;
        }
      return reply({ updated });
    }
    if (path === `${base}/summary`) {
      const groups = unread.length
        ? [
            {
              resourceType: unread[0].resourceType,
              type: "BOOKING",
              category: "TRANSACTIONAL",
              count: unread.length,
            },
          ]
        : [];
      const records = new Set(unread.map((n) => n.resourceId));
      return reply({
        unreadCount: unread.length,
        groups,
        destinations: unread.length
          ? [
              {
                section: unread[0].destination?.section ?? "/dashboard/bookings",
                count: unread.length,
                recordCount: records.size,
                href:
                  records.size === 1
                    ? `${inbox}?notification=${unread[0].id}`
                    : `${inbox}?attention=${encodeURIComponent(unread[0].destination?.section ?? "/dashboard/bookings")}`,
              },
            ]
          : [],
      });
    }
    if (path === `${base}/context`) {
      if (data.holdContext)
        await new Promise<void>((resolve) => {
          data.release = resolve;
        });
      return reply({
        items: unread.filter(
          (n) =>
            n.resourceType === url.searchParams.get("resourceType") &&
            n.resourceId === url.searchParams.get("resourceId"),
        ),
      });
    }
    if (path === `${base}/attention`) return reply({ items: unread });
    if (path === `${base}/preferences/current`)
      return reply({
        immutableCategories: ["SECURITY", "TRANSACTIONAL"],
        preferences: [],
      });
    if (path === `${base}/push`)
      return reply({ available: false, publicKey: null, enabled: false });
    const found = data.items.find((n) => path === `${base}/${n.id}`);
    if (found) return reply(found);
    return reply({ items: data.items });
  });
}

for (const width of [1440, 390])
  test(`single sidebar update waits for displayed content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const booking = await bookingDetailFixture(page);
    booking.mode = "hold";
    const data = state();
    await notifications(page, data);
    await page.goto("/dashboard/notifications");
    if (width < 901)
      await page.getByRole("button", { name: "Open dashboard navigation" }).click();
    const nav = page.locator(
      width < 901 ? "#dashboard-mobile-navigation" : "#dashboard-navigation",
    );
    await nav
      .getByRole("link", { name: "My bookings, 1 unread updates", exact: true })
      .click();
    await expect(page).toHaveURL(recordPath, { timeout: 40000 });
    await expect.poll(() => !!booking.held).toBe(true);
    expect(data.writes).toEqual([]);
    expect(
      await page.getByRole("region", { name: "Related record updates" }).count(),
    ).toBe(0);
    booking.mode = "normal";
    booking.held?.();
    await expect(page.locator(".booking-appointment")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Related record updates" }),
    ).toContainText("Displayed updates marked as read");
    expect(data.writes).toEqual([
      {
        resourceType: "BOOKING",
        resourceId: detailId,
        notificationIds: [data.items[0].id],
      },
    ]);
    expect(
      (await page
        .getByRole("region", { name: "Related record updates" })
        .getByRole("link", { name: "All notifications" })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    expect(booking.writes).toEqual([]);
    expect(booking.record.status).toBe("CONFIRMED");
    await expect(page.locator(".dashboard-icon-link .notification-badge")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test("multiple records have individual links, no reads on the queue, and a normal full-page route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await bookingDetailFixture(page);
  const data = state([item(), item(2, notificationItem(2).resourceId!)]);
  await notifications(page, data);
  await page.goto("/dashboard/notifications");
  await page
    .locator("#dashboard-navigation")
    .getByRole("link", { name: "My bookings, 2 unread updates", exact: true })
    .click();
  const queue = page.getByRole("region", { name: "Needs attention" });
  await expect(queue.getByRole("link", { name: /^View update:/ })).toHaveCount(2);
  await expect(queue.getByRole("link", { name: "Open the full page" })).toHaveAttribute(
    "href",
    "/dashboard/bookings",
  );
  expect(data.writes).toEqual([]);
  await queue
    .getByRole("link", { name: "View update: Booking update 1", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Related record updates" }),
  ).toContainText("Displayed updates marked as read");
  expect(data.items[1].readAt).toBeNull();
  expect(data.writes.flatMap((body) => body.notificationIds)).toEqual([data.items[0].id]);
  await expect(
    page.getByRole("link", { name: "Open notifications, 1 unread", exact: true }),
  ).toBeVisible();
});

test("a generic list does not acknowledge updates; an independent exact record visit does", async ({
  page,
}) => {
  await bookingDetailFixture(page);
  const data = state();
  await notifications(page, data);
  await page.goto("/dashboard/bookings");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(data.writes).toEqual([]);
  await page.goto(recordPath);
  await expect.poll(() => data.writes.length).toBe(1);
  await page.reload();
  await expect(page.locator(".booking-appointment")).toBeVisible();
  expect(data.writes).toHaveLength(1);
});

for (const mode of ["error", "wrongId"])
  test(`${mode} record responses never trigger a read`, async ({ page }) => {
    const booking = await bookingDetailFixture(page);
    booking.mode = mode;
    const data = state();
    await notifications(page, data);
    await page.goto(recordPath);
    await expect(page.locator(".booking-appointment")).toHaveCount(0);
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(data.writes).toEqual([]);
    expect(data.items[0].readAt).toBeNull();
  });

test("an uncertain read keeps the record usable and retries only the same related notice", async ({
  page,
}) => {
  await bookingDetailFixture(page);
  const data = state();
  data.failRead = true;
  await notifications(page, data);
  await page.goto(recordPath);
  await expect(
    page.getByRole("region", { name: "Related record updates" }),
  ).toContainText("read status could not be saved");
  await expect(page.locator(".booking-appointment")).toBeVisible();
  expect(data.items[0].readAt).toBeNull();
  data.failRead = false;
  await page.getByRole("button", { name: "Retry read update" }).click();
  await expect.poll(() => data.items[0].readAt).not.toBeNull();
  expect(data.writes).toHaveLength(2);
  expect(data.writes[1]).toEqual(data.writes[0]);
});

test("late notification context is discarded after a session change", async ({
  page,
}) => {
  await bookingDetailFixture(page);
  const data = state();
  data.holdContext = true;
  await notifications(page, data);
  await page.goto(recordPath);
  await expect.poll(() => !!data.release).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  data.release?.();
  await expect(page.getByRole("region", { name: "Related record updates" })).toHaveCount(
    0,
  );
  expect(data.writes).toEqual([]);
});

test("a conversation notice waits for its actual message to load and be visible", async ({
  page,
}) => {
  const support = await customerSupportFixture(page);
  support.delayMessages = true;
  const messageId = support.messages[0].id,
    resourceId = support.records.enquiries.id;
  const row: InboxNotification = {
    ...item(),
    resourceType: "ENQUIRY",
    resourceId,
    supportMessageId: messageId,
    destination: {
      section: "/dashboard/support",
      href: `/dashboard/support/enquiries/${resourceId}?messageId=${messageId}#support-entry-${messageId}`,
      label: "View enquiry",
    },
  };
  const data = state([row]);
  await notifications(page, data);
  await page.goto(row.destination!.href);
  await expect.poll(() => support.releaseMessages.length).toBeGreaterThan(0);
  expect(data.writes).toEqual([]);
  support.delayMessages = false;
  support.releaseMessages.splice(0).forEach((release) => release());
  await expect(page.locator(`#support-entry-${messageId}`)).toBeVisible();
  await page.locator(`#support-entry-${messageId}`).scrollIntoViewIfNeeded();
  await expect.poll(() => data.writes.length).toBe(1);
  expect(data.writes[0].notificationIds).toEqual([row.id]);
  expect(support.writes).toEqual([]);
});

test("another tab refreshes its unread count after the exact record is read", async ({
  page,
  context,
}) => {
  await bookingDetailFixture(page);
  const data = state();
  await notifications(page, data);
  const second = await context.newPage();
  await bookingDetailFixture(second);
  await notifications(second, data);
  await second.goto("/dashboard/notifications");
  await expect(
    second.getByRole("link", { name: "Open notifications, 1 unread", exact: true }),
  ).toBeVisible();
  await page.bringToFront();
  await page.goto(recordPath);
  await expect.poll(() => data.items[0].readAt).not.toBeNull();
  await second.bringToFront();
  await expect(second.locator(".dashboard-icon-link .notification-badge")).toHaveCount(0);
  expect(data.writes).toHaveLength(1);
  await second.close();
});

test("a scoped workforce booking opens independently of the queue page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const fixture = await workforceBookingsFixture(page);
  const row = fixture.bookings.at(-1)!;
  await page.route(`**/api/v1/staff/workforce/bookings/${row.id}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Synthetic scoped detail",
        meta: { requestId: "test" },
        data: {
          ...row,
          access: fixture.base.access,
          generatedAt: fixture.base.access.serverTime,
        },
      },
    }),
  );
  const note = {
    ...item(),
    resourceId: row.id,
    destination: {
      section: "/admin/workforce/bookings",
      href: `/admin/workforce/bookings/${row.id}`,
      label: "View booking",
    },
  };
  const data = state([note]);
  await notifications(page, data, "STAFF");
  await page.goto(note.destination.href);
  await expect(page.getByRole("region", { name: "Booking appointment" })).toContainText(
    row.service.name,
  );
  await expect.poll(() => data.writes.length).toBe(1);
  expect(data.writes[0].resourceId).toBe(row.id);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});

test("the active staff conversation view loads the exact message before acknowledging it", async ({
  page,
}) => {
  const fixture = await workThreadFixture(page);
  const message = threadMessage(59),
    record = fixture.detail.record;
  const href = `/admin/support/complaints/${record.id}?messageId=${message.id}#support-entry-${message.id}`;
  const row: InboxNotification = {
    ...item(),
    resourceType: "COMPLAINT",
    resourceId: record.id,
    supportMessageId: message.id,
    destination: { section: "/admin/support", href, label: "View complaint" },
  };
  const data = state([row]);
  await notifications(page, data, "STAFF");
  let anchorRead = false;
  await page.route(
    `**/api/v1/staff/support/complaints/${record.id}/messages?**`,
    (route) => {
      anchorRead =
        new URL(route.request().url()).searchParams.get("messageId") === message.id;
      return route.fulfill({
        json: {
          success: true,
          message: "Synthetic anchored staff message",
          meta: { requestId: "test" },
          data: {
            items: [message],
            cursor: message.id,
            hasMore: false,
            pollAfterMs: 5000,
          },
        },
      });
    },
  );
  await page.goto(href);
  await expect(page.locator(`#support-entry-${message.id}`)).toBeVisible();
  await page.locator(`#support-entry-${message.id}`).scrollIntoViewIfNeeded();
  await expect.poll(() => data.writes.length).toBe(1);
  expect(anchorRead).toBe(true);
  expect(data.writes[0].notificationIds).toEqual([row.id]);
  expect(fixture.detail.writes).toEqual([]);
});

test("a staff payment outside the loaded list is displayed before its notice is read", async ({
  page,
}) => {
  const fixture = await workPaymentFixture(page);
  const payment = fixture.payments.records[0];
  fixture.payments.mode = "empty";
  const note: InboxNotification = {
    ...item(),
    resourceType: "PAYMENT",
    resourceId: payment.id,
    destination: {
      section: "/admin/payments",
      href: `/admin/payments?selected=${payment.id}`,
      label: "View payment",
    },
  };
  const data = state([note]);
  await notifications(page, data, "STAFF");
  await page.goto(note.destination!.href);
  const selected = page.getByRole("region", { name: "Selected payment record" });
  await expect(selected).toContainText(payment.paymentNumber);
  await expect.poll(() => data.writes.length).toBe(1);
  expect(payment.status).toBe("REQUIRES_REVIEW");
  expect(data.writes[0].notificationIds).toEqual([note.id]);
});

for (const directMode of ["mismatch", "denied"])
  test(`staff ${directMode} payment does not acknowledge an unrelated or unavailable record`, async ({
    page,
  }) => {
    const fixture = await workPaymentFixture(page);
    const payment = fixture.payments.records[0];
    fixture.payments.directMode = directMode;
    const note: InboxNotification = {
      ...item(),
      resourceType: "PAYMENT",
      resourceId: payment.id,
      destination: {
        section: "/admin/payments",
        href: `/admin/payments?selected=${payment.id}`,
        label: "View payment",
      },
    };
    const data = state([note]);
    await notifications(page, data, "STAFF");
    await page.goto(note.destination!.href);
    await expect(
      page.getByRole("region", { name: "Selected payment record" }).getByRole("alert"),
    ).toBeVisible();
    expect(data.writes).toEqual([]);
    expect(data.items[0].readAt).toBeNull();
  });

test("an on-page payment keeps list order and its actual record receives focus before acknowledgement", async ({
  page,
}) => {
  const fixture = await workPaymentFixture(page);
  fixture.payments.records = Array.from({ length: 25 }, (_, index) => paymentRow(index));
  const payment = fixture.payments.records[24];
  const note: InboxNotification = {
    ...item(),
    resourceType: "PAYMENT",
    resourceId: payment.id,
    destination: {
      section: "/admin/payments",
      href: `/admin/payments?selected=${payment.id}`,
      label: "View payment",
    },
  };
  const other = {
    ...note,
    id: notificationItem(2).id,
    resourceId: fixture.payments.records[0].id,
  };
  const data = state([note, other]);
  await notifications(page, data, "STAFF");
  await page.goto(note.destination!.href);
  const target = page.locator(`#payment-record-${payment.id}`);
  await expect(target).toBeInViewport();
  await expect.poll(() => data.writes.length).toBe(1);
  await expect(page.locator(".wp-records > .wp-payment")).toHaveCount(25);
  await expect(page.locator(".wp-records > .wp-payment").first()).toContainText(
    fixture.payments.records[0].paymentNumber,
  );
  await expect(target).toHaveCount(1);
  expect(data.writes[0].notificationIds).toEqual([note.id]);
  expect(other.readAt).toBeNull();
});
