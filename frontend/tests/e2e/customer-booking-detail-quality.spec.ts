import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  bookingDetailFixture,
  detailId,
  future,
} from "../fixtures/customer-booking-detail";
import { bookingId } from "../fixtures/customer-bookings";
const route = `/dashboard/bookings/${detailId}`;
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`booking detail fits ${width}px`, async ({ page }) => {
    await bookingDetailFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page.locator(".booking-appointment")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
    await expect(page.locator('[aria-current="page"]').last()).toHaveText(
      "Vehicle diagnostics",
    );
    for (const control of await page
      .locator(
        ".customer-booking-detail a,.customer-booking-detail button,.customer-booking-detail summary",
      )
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".booking-quote-totals")).toContainText("85,000.00");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`booking detail accessibility ${width}px`, async ({ page }) => {
    await bookingDetailFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await expect(page.locator(".booking-appointment")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("reschedule reviews exact slot and records the version with a key", async ({
  page,
}) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
  await page.locator(".booking-slot").click();
  await page.getByRole("button", { name: "Review reschedule" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("New appointment");
  await expect(modal).toContainText("QA-123-AA");
  await expect(modal.getByRole("button", { name: "Go back" })).toBeFocused();
  await modal.getByRole("button", { name: "Confirm change" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".booking-appointment")).toContainText(
    "Awaiting workshop confirmation.",
  );
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({ slotId: bookingId(504), expectedVersion: 1 });
  expect(state.writes[0].key).toBeTruthy();
});
test("uncertain reschedule repeats the identical key and body", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  state.failure = 503;
  await page.goto(route);
  await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
  await page.locator(".booking-slot").click();
  await page.getByRole("button", { name: "Review reschedule" }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("button", { name: "Retry same request" })).toBeVisible();
  state.failure = 0;
  await page.getByRole("button", { name: "Retry same request" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
for (const action of ["Accept", "Reject"] as const)
  test(`${action} quotation reviews revision and total`, async ({ page }) => {
    const state = await bookingDetailFixture(page);
    await page.goto(route);
    await page.getByRole("button", { name: `${action} quotation`, exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText("QUO-QA-101");
    await expect(modal).toContainText("85,000.00");
    await expect(modal).toContainText("Revision");
    await modal.getByRole("button", { name: "Confirm change" }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator(".booking-quotation .booking-detail-status")).toHaveText(
      action === "Accept" ? "Accepted" : "Rejected",
    );
    expect(state.writes[0].body).toEqual({ expectedRevision: 2 });
    expect(state.writes[0].key).toBeUndefined();
  });
test("quotation expiry is checked again on confirmation", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  state.record.quotes[0].expiresAt = future(-1);
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
});
test("expired quotations have no decision controls", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  state.record.quotes[0].expiresAt = future(-1);
  await page.goto(route);
  await expect(page.getByText(/expiry is missing or has passed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
});
test("cancellation validates and reviews the exact reason", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await page.getByText("Cancel this booking", { exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Review cancellation" }).click();
  await expect(page.getByLabel("Reason", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Reason", { exact: true }).fill("  Plans changed  ");
  await page.getByRole("button", { name: "Review cancellation" }).click();
  await expect(page.getByRole("dialog")).toContainText("Plans changed");
  await expect(page.getByRole("dialog")).toContainText("separate refund review");
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".booking-appointment")).toContainText("Cancelled");
  expect(state.writes[0].body).toEqual({ reason: "Plans changed", expectedVersion: 1 });
});
test("uncertain quotation outcome cannot be blindly repeated", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  state.failure = 503;
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry same request" })).toHaveCount(0);
  state.mode = "error";
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect(page.getByRole("heading", { name: "Booking unavailable" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("changed booking version prevents a stale reviewed write", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  state.record.version++;
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["error", "malformed", "wrongId"])
  test(`${mode} detail fails closed and can recover`, async ({ page }) => {
    const state = await bookingDetailFixture(page);
    state.mode = mode;
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Booking unavailable" }),
    ).toBeVisible();
    await expect(page.locator(".booking-appointment")).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
    await expect(page.locator(".booking-appointment")).toBeVisible();
  });
test("manual read failure hides the old booking", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await expect(page.locator(".booking-appointment")).toBeVisible();
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Booking unavailable" })).toBeVisible();
  await expect(page.locator(".booking-appointment")).toHaveCount(0);
});
test("background read failure retains facts but disables changes", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  await page.goto(route);
  await expect(page.locator(".booking-appointment")).toBeVisible();
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/details below may be out of date/)).toBeVisible();
  await expect(page.locator(".booking-appointment")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toBeDisabled();
  state.mode = "normal";
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toBeEnabled();
});
test("policy failure offers retry without invented cancellation terms", async ({
  page,
}) => {
  const state = await bookingDetailFixture(page);
  state.policyError = true;
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Retry booking policy" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reschedule appointment", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Cancel this booking", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Review cancellation" })).toBeDisabled();
  state.policyError = false;
  await page.getByRole("button", { name: "Retry booking policy" }).click();
  await expect(page.getByRole("button", { name: "Review cancellation" })).toBeEnabled();
});
test("slots can recover after a read failure", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  state.slotError = true;
  await page.goto(route);
  await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry slots" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review reschedule" })).toBeDisabled();
  state.slotError = false;
  await page.getByRole("button", { name: "Retry slots" }).click();
  await expect(page.locator(".booking-slot")).toHaveCount(1);
});
test("short mobile review supports Escape and restores focus", async ({ page }) => {
  await bookingDetailFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(480);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toBeFocused();
});

for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot read customer booking detail`, async ({ page }) => {
    const state = await bookingDetailFixture(page, role);
    await page.goto(route);
    await expect(page.locator(".customer-booking-detail")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(state.reads).toHaveLength(0);
  });
test("session change discards a late detail response", async ({ page }) => {
  const state = await bookingDetailFixture(page);
  state.mode = "hold";
  await page.goto(route);
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() =>
    (function () {
      const channel = new BroadcastChannel("aat-session");
      channel.postMessage("changed");
      channel.close();
    })(),
  );
  state.held?.();
  await expect(page.locator(".booking-appointment")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
});
test("pending mutation blocks duplicate confirmation and Escape", async ({ page }) => {
  await bookingDetailFixture(page);
  let release: (() => void) | undefined;
  let count = 0;
  await page.route(
    `**/customers/bookings/${detailId}/quotes/*/accept`,
    async (request) => {
      count++;
      await new Promise<void>((resolve) => (release = resolve));
      await request.fulfill({
        json: {
          success: true,
          message: "Isolated detail response",
          meta: { requestId: "booking-detail-extra-qa" },
          data: {},
        },
      });
    },
  );
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect.poll(() => count).toBe(1);
  const submitting = page.getByRole("button", { name: "Submitting" });
  await expect(submitting).toBeDisabled();
  await submitting.evaluate((el: HTMLButtonElement) => el.click());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Go back" })).toBeDisabled();
  expect(count).toBe(1);
  release?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("session change discards a pending mutation result", async ({ page }) => {
  await bookingDetailFixture(page);
  let release: (() => void) | undefined;
  await page.route(
    `**/customers/bookings/${detailId}/quotes/*/accept`,
    async (request) => {
      await new Promise<void>((resolve) => (release = resolve));
      await request.fulfill({
        json: {
          success: true,
          message: "Isolated detail response",
          meta: { requestId: "booking-detail-extra-qa" },
          data: {},
        },
      });
    },
  );
  await page.goto(route);
  await page.getByRole("button", { name: "Accept quotation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect.poll(() => !!release).toBe(true);
  await page.evaluate(() =>
    (function () {
      const channel = new BroadcastChannel("aat-session");
      channel.postMessage("changed");
      channel.close();
    })(),
  );
  release?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Your request was recorded.", { exact: false }),
  ).toHaveCount(0);
});
test("slot paging clears selection and excludes original or mismatched slots", async ({
  page,
}) => {
  await bookingDetailFixture(page);
  const item = (id: number) => ({
    id: bookingId(id),
    branchId: bookingId(101),
    serviceId: bookingId(100),
    startsAt: future(96 + id),
    endsAt: future(97 + id),
    version: 1,
  });
  await page.route("**/public/services/*/slots?*", (request) => {
    const later = new URL(request.request().url()).searchParams.has("cursor");
    return request.fulfill({
      json: {
        success: true,
        message: "Isolated detail response",
        meta: { requestId: "booking-detail-extra-qa" },
        data: later
          ? { items: [item(505)] }
          : {
              items: [item(500), { ...item(506), branchId: bookingId(999) }, item(504)],
              nextCursor: bookingId(504),
            },
      },
    });
  });
  await page.goto(route);
  await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
  await expect(page.locator(".booking-slot")).toHaveCount(1);
  await page.locator(".booking-slot").click();
  await expect(page.getByRole("button", { name: "Review reschedule" })).toBeEnabled();
  await page.getByRole("button", { name: "More slots" }).click();
  await expect(page.getByRole("button", { name: "Review reschedule" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous slots" }).click();
  await expect(page.getByRole("button", { name: "Review reschedule" })).toBeDisabled();
  await expect(page.locator(".booking-slot")).toHaveCount(1);
});
test("a quotation without expiry stays readable without mutation controls", async ({
  page,
}) => {
  const state = await bookingDetailFixture(page);
  await page.route(`**/customers/bookings/${detailId}`, (request) =>
    request.fulfill({
      json: {
        success: true,
        message: "Isolated detail response",
        meta: { requestId: "booking-detail-extra-qa" },
        data: {
          ...state.record,
          quotes: [{ ...state.record.quotes[0], expiresAt: null }],
        },
      },
    }),
  );
  await page.goto(route);
  await expect(page.getByText(/expiry is missing or has passed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
});

test("long booking text and exact large amounts remain readable at 320px", async ({
  page,
}) => {
  const state = await bookingDetailFixture(page);
  state.record.service.name = "Vehicle diagnostics " + "LongServiceName".repeat(15);
  state.record.customerNotes = "Customer concern ".repeat(80);
  state.record.quotes[0].items[0].description = "Diagnostic detail ".repeat(50);
  state.record.quotes[0].totalKobo = "9007199254740993";
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto(route);
  await expect(page.locator(".booking-appointment")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator(".booking-quote-totals")).toContainText(
    "90,071,992,547,409.93",
  );
});
test("loading and empty quotation states expose no premature decision controls", async ({
  page,
}) => {
  const state = await bookingDetailFixture(page);
  state.mode = "hold";
  state.record.quotes = [];
  await page.goto(route);
  await expect(page.getByText("Checking your booking...", { exact: true })).toBeVisible();
  await expect(page.locator(".booking-appointment")).toHaveCount(0);
  await expect.poll(() => !!state.held).toBe(true);
  state.held?.();
  await expect(
    page.getByText("No issued quotations are available.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept quotation", exact: true }),
  ).toHaveCount(0);
});
