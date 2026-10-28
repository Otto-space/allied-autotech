import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerReviewsFixture } from "../fixtures/customer-reviews";
import { workforceBookingsFixture } from "../fixtures/workforce-bookings";
import { workBookingsFixture } from "../fixtures/work-bookings";

test("review detail offers recovery after a background read failure", async ({
  page,
}) => {
  const state = await customerReviewsFixture(page);
  Object.assign(state.rows[0], {
    status: "REJECTED",
    moderationNote: "Synthetic moderation reason",
    moderatedAt: "2026-10-24T19:00:00.000Z",
  });
  await page.goto(`/dashboard/reviews/${state.rows[0].id}`);
  await expect(
    page.getByRole("heading", { name: "Review update", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic customer feedback", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Isolated review", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Moderation update", level: 3 }),
  ).toBeVisible();
  state.failList = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  state.failList = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Synthetic customer feedback", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("managed booking links open only the scoped detail and recover from a failed refresh", async ({
  page,
}) => {
  const state = await workforceBookingsFixture(page);
  const row = state.bookings[0];
  let unavailable = false;
  await page.route(`**/api/v1/staff/workforce/bookings/${row.id}`, (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: { success: false, error: { code: "UNAVAILABLE" } } }
        : {
            json: {
              success: true,
              message: "Synthetic booking detail",
              meta: { requestId: "page-recovery" },
              data: {
                ...row,
                access: state.base.access,
                generatedAt: "2026-10-24T19:00:00.000Z",
              },
            },
          },
    ),
  );
  await page.goto("/admin/workforce/bookings");
  await page
    .locator(`.wfb-results a[href="/admin/workforce/bookings/${row.id}"]`)
    .click();
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Booking appointment", exact: true }),
  ).toContainText(row.service.name);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  unavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Booking appointment", exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Booking appointment", exact: true }),
  ).toBeVisible();
});

test("unrecognized administration resources give a non-indexed missing page", async ({
  page,
}) => {
  await workBookingsFixture(page, "ADMIN");
  // Next.js preserves 200 after streaming starts, while rendering not-found/noindex.
  expect([200, 404]).toContain((await page.goto("/admin/no-such-workspace"))?.status());
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toHaveAttribute("content", /noindex/);
  await expect(
    page.getByRole("heading", { name: "We couldn’t find that page.", exact: true }),
  ).toBeVisible();
});
