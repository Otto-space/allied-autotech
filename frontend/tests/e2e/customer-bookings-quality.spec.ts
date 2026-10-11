import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bookingsFixture, bookingId } from "../fixtures/customer-bookings";

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`bookings fit ${width}px with readable records and controls`, async ({ page }) => {
    await bookingsFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/bookings");
    await expect(
      page.getByRole("heading", { name: "Vehicle diagnostics", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator(".customer-bookings a,.customer-bookings button,.customer-bookings select")
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
    await expect(page.locator('.booking-breadcrumb ol [aria-current="page"]')).toHaveText(
      "Bookings",
    );
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }).last(),
    ).toHaveAttribute("href", "/dashboard");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`bookings accessibility ${width}px`, async ({ page }) => {
    await bookingsFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/bookings");
    await expect(page.locator(".booking-table")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("status and page size persist across reload, Back and Forward", async ({ page }) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings");
  await page.getByLabel("Booking status", { exact: true }).selectOption("CONFIRMED");
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(1);
  await expect(page).toHaveURL(/status=CONFIRMED/);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.reload();
  await expect(page.getByLabel("Booking status", { exact: true })).toHaveValue(
    "CONFIRMED",
  );
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.goBack();
  await expect(page.getByLabel("Rows per page")).toHaveValue("20");
  await page.goForward();
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Booking status", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("cursor pages survive reload and return to the correct prior page", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings");
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".booking-pagination")).toContainText("Page 2");
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#booking-results")).toBeFocused();
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.locator(".booking-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
});
test("a direct cursor link uses first-page recovery without inventing a page number", async ({
  page,
}) => {
  await bookingsFixture(page);
  await page.goto(`/dashboard/bookings?cursor=${bookingId(4)}`);
  await expect(page.locator(".booking-pagination")).toContainText("Later page");
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
});
test("changing status resets cursor and ignores untrusted query fields", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  await page.goto(
    `/dashboard/bookings?cursor=${bookingId(4)}&_trail=start&customerId=${bookingId(999)}`,
  );
  await expect(page.locator(".booking-table")).toBeVisible();
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page.getByLabel("Booking status", { exact: true }).selectOption("REQUESTED");
  await expect(page.locator(".booking-table")).toContainText("Brake inspection");
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
});
test("invalid filters fail safely with a visible explanation", async ({ page }) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings?status=ADMIN&limit=99999&cursor=bad");
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  expect(state.reads[0].searchParams.get("limit")).toBe("20");
  expect(state.reads[0].searchParams.has("status")).toBe(false);
});
for (const mode of ["error", "malformed"])
  test(`${mode} hides stale records and offers retry`, async ({ page }) => {
    const state = await bookingsFixture(page);
    await page.goto("/dashboard/bookings");
    await expect(page.locator(".booking-table")).toBeVisible();
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your bookings" }),
    ).toBeVisible();
    await expect(page.locator(".booking-table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry bookings", exact: true }).click();
    await expect(page.locator(".booking-table")).toBeVisible();
  });
test("empty and filtered-empty accounts have different recovery actions", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  state.mode = "empty";
  await page.goto("/dashboard/bookings");
  await expect(
    page.getByRole("heading", { name: "No bookings yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Choose a service", exact: true }),
  ).toHaveAttribute("href", "/services");
  await page.getByLabel("Booking status", { exact: true }).selectOption("CANCELLED");
  await expect(
    page.getByRole("heading", { name: "No bookings with this status", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset booking filters", exact: true }),
  ).toBeVisible();
});
test("late responses cannot restore bookings after account invalidation", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings");
  await expect(page.locator(".booking-table")).toBeVisible();
  state.mode = "hold";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
  await expect(page.getByRole("button", { name: "Verify session again" })).toBeVisible();
  state.held?.();
  await expect(page.locator(".booking-table")).toHaveCount(0);
});
test("long and missing fields fit short mobile screens without inventing payment state", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  state.records[0].service.name = "ExtendedServiceName".repeat(15);
  state.records[0].vehicle!.model = "LongVehicleName".repeat(12);
  state.records[0].depositAmountKobo = "9007199254740993";
  state.records[0].depositPaidAt = null;
  state.records[1].scheduledAt = null;
  state.records[1].branch = null;
  state.records[1].vehicle = null;
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/dashboard/bookings");
  await expect(page.locator(".booking-table")).toContainText("90,071,992,547,409.93");
  await expect(page.locator(".booking-table")).toContainText("Time not set");
  await expect(page.locator(".booking-table")).not.toContainText("Deposit recorded");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("a background refresh failure clearly labels the retained list", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings");
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/The list may be out of date/)).toBeVisible();
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry bookings", exact: true }).click();
  await expect(page.getByText(/The list may be out of date/)).toHaveCount(0);
  await expect(page.locator(".booking-table tbody tr")).toHaveCount(4);
});

test("detail navigation uses the selected booking and triggers no mutation", async ({
  page,
}) => {
  const state = await bookingsFixture(page);
  await page.goto("/dashboard/bookings");
  await page
    .getByRole("link", { name: "View booking: Vehicle diagnostics", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bookings/${bookingId(1)}`));
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot fetch customer bookings from a direct route`, async ({ page }) => {
    const state = await bookingsFixture(page, role);
    await page.goto("/dashboard/bookings");
    await expect(page.locator(".customer-bookings")).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).waitFor();
    expect(state.reads).toEqual([]);
  });
