import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
import { workforceBookingsFixture } from "../fixtures/workforce-bookings";
const root = "/admin/workforce/bookings";
const rows = (page: Page) => page.locator(".wfb-results tbody tr");
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh bookings", exact: true });
async function ready(page: Page) {
  const state = await workforceBookingsFixture(page);
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  return state;
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`workforce bookings layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = await ready(page);
    await expect(
      page.getByRole("heading", { name: "Bookings", exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Vehicle not recorded", { exact: true })).toBeVisible();
    await expect(
      page.locator(".wfb-status").filter({ hasText: "Confirmed" }).first(),
    ).toBeVisible();
    const links = page.locator(".wfb-results a");
    await expect(links).toHaveCount(25);
    expect(
      await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
    ).toEqual(
      state.bookings
        .slice(0, 25)
        .map((booking) => `/admin/workforce/bookings/${booking.id}`),
    );
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
    await page.getByLabel("Search bookings", { exact: true }).focus();
    await expect(page.getByLabel("Search bookings", { exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
for (const template of ["OPERATIONS", "CUSTOMER_SERVICE"] as const)
  test(`${template} sees permitted bookings`, async ({ page }) => {
    const state = await workforceBookingsFixture(page, template);
    await page.goto(root);
    await expect(rows(page)).toHaveCount(25);
    expect(state.base.requests).not.toContain("/staff/bookings");
    expect(state.base.requests).not.toContain("/staff/payments");
  });
test("search and booking status submit together across permitted records", async ({
  page,
}) => {
  const state = await ready(page),
    before = state.reads.length;
  await page.getByLabel("Search bookings", { exact: true }).fill("Toyota");
  await page.getByLabel("Booking status", { exact: true }).selectOption("CONFIRMED");
  expect(state.reads).toHaveLength(before);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/q=Toyota&status=CONFIRMED/);
  await expect(rows(page)).toHaveCount(4);
  await expect(page.locator(".wfb-results")).not.toContainText("Honda");
  await page.reload();
  await expect(page.getByLabel("Search bookings", { exact: true })).toHaveValue("Toyota");
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(root + "$"));
  await expect(rows(page)).toHaveCount(25);
});
test("clear filters resets an unsent draft even on the unfiltered URL", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Search bookings", { exact: true }).fill("Unsent draft");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByLabel("Search bookings", { exact: true })).toHaveValue("");
});
test("paging survives reload, previous, browser Back and first page", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Next bookings", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  const nextURL = page.url();
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(nextURL);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
});
test("empty scope and unmatched search have distinct helpful states", async ({
  page,
}) => {
  const state = await workforceBookingsFixture(page);
  state.bookings = [];
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "No bookings in your current scope" }),
  ).toBeVisible();
  await page.getByLabel("Search bookings", { exact: true }).fill("Missing");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No bookings match these filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next bookings", exact: true }),
  ).toBeDisabled();
});
test("loading and denied reads show no records", async ({ page }) => {
  const state = await workforceBookingsFixture(page);
  state.hold = true;
  await page.goto(root);
  await expect(
    page.getByText("Checking permitted bookings…", { exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  state.hold = false;
  state.denied = true;
  state.release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Booking access unavailable",
  );
  await expect(rows(page)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("foreground and background failures hide retained records and retry recovers", async ({
  page,
}) => {
  const state = await ready(page);
  state.fail = true;
  await refresh(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Bookings could not be refreshed",
  );
  await expect(rows(page)).toHaveCount(0);
  state.fail = false;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(25);
  state.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Bookings could not be refreshed",
  );
});
test("background refresh preserves the unsent search draft", async ({ page }) => {
  const state = await ready(page),
    before = state.reads.length;
  await page.getByLabel("Search bookings", { exact: true }).fill("Unsent diagnostics");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.reads.length).toBeGreaterThan(before);
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByLabel("Search bookings", { exact: true })).toHaveValue(
    "Unsent diagnostics",
  );
});
test("invalid URLs never send a bookings request and can be reset", async ({ page }) => {
  const state = await workforceBookingsFixture(page);
  for (const query of [
    "q=a&q=b",
    "status=toString",
    "cursor=not-a-cursor",
    "branchId=foreign",
  ]) {
    await page.goto(root + "?" + query);
    await expect(
      page.getByRole("heading", { name: "Booking filters unavailable" }),
    ).toBeVisible();
  }
  expect(state.reads).toEqual([]);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
});
test("mismatched access versions cannot render booking data", async ({ page }) => {
  const state = await workforceBookingsFixture(page);
  state.responseAccess = structuredClone(state.base.access);
  state.responseAccess.version++;
  await page.goto(root);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your responsibilities changed",
  );
  await expect(rows(page)).toHaveCount(0);
  state.responseAccess = state.base.access;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(25);
});
test("malformed and foreign-branch responses fail closed", async ({ page }) => {
  const state = await workforceBookingsFixture(page);
  const original = state.bookings[0].status;
  state.bookings[0].status = "UNKNOWN";
  await page.goto(root);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Bookings could not be refreshed",
  );
  state.bookings[0].status = original;
  state.bookings[0].branchId = "b6000000-0000-4000-8000-000000000999";
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Bookings could not be refreshed",
  );
});
test("revoked responsibility removes retained bookings and queue access", async ({
  page,
}) => {
  const state = await ready(page);
  state.base.access.assignments = [];
  state.base.access.permissions = [];
  state.base.access.version++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});
test("an accountant responsibility cannot read the bookings queue", async ({ page }) => {
  const state = await workforceBookingsFixture(page);
  state.base.access.permissions = ["FINANCE_READ"];
  state.base.access.assignments[0].template = "ACCOUNTANT";
  await page.goto(root);
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  expect(state.reads).toEqual([]);
});
test("long service, contact, branch and vehicle labels wrap at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const state = await workforceBookingsFixture(page);
  state.bookings[0].service.name = "D".repeat(180);
  state.bookings[0].vehicle!.registrationNumber = "R".repeat(100);
  state.bookings[0].customer.firstName = "N".repeat(100);
  state.bookings[0].customer.phone = "+" + "2".repeat(80);
  state.bookings[0].branch.name = "B".repeat(100);
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByText("D".repeat(180), { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("all booking status options apply their corresponding server filter", async ({
  page,
}) => {
  await ready(page);
  for (const [status, label] of Object.entries({
    REQUESTED: "Requested",
    AWAITING_DEPOSIT: "Awaiting deposit",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",

    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No show",
    EXPIRED: "Expired",
  })) {
    await page.getByLabel("Booking status", { exact: true }).selectOption(status);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`status=${status}`));
    await expect(page.locator(".wfb-status").first()).toHaveText(label);
    expect(
      (await page.locator(".wfb-status").allTextContents()).every(
        (value) => value === label,
      ),
    ).toBe(true);
  }
});
test("temporary assignment expiry removes the bookings queue without interaction", async ({
  page,
}) => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  await page.clock.install({ time: now });
  const state = await workforceBookingsFixture(page);
  state.base.access.assignments[0].temporary = true;
  state.base.access.assignments[0].expiresAt = new Date(
    now.getTime() + 10000,
  ).toISOString();
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  state.base.access.assignments = [];
  state.base.access.permissions = [];
  await page.clock.fastForward(10100);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

for (const [queue, title, template] of [
  ["enquiries", "Enquiries", "CUSTOMER_SERVICE"],
  ["complaints", "Complaints", "CUSTOMER_SERVICE"],
  ["orders", "Order progress", "OPERATIONS"],
  ["finance", "Payment records", "ACCOUNTANT"],
] as const) {
  test(`existing ${queue} queue retains its own workspace and breadcrumb`, async ({
    page,
  }) => {
    const state = await workforceNotificationsFixture(page, template);
    await page.route(`**/api/v1/staff/workforce/${queue}**`, (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            ...(["enquiries", "complaints", "orders", "finance"].includes(queue)
              ? { access: state.access, generatedAt: "2026-10-19T08:00:00.000Z" }
              : {}),
            items: [
              {
                id: "ba000000-0000-4000-8000-000000000099",
                status: "CLOSED",
                version: 0,
                subject: "Existing queue record",
                ...(queue === "finance"
                  ? {
                      paymentNumber: "Existing queue record",
                      status: "PROCESSING",
                      purpose: "ORDER_PAYMENT",
                      amountKobo: "2750050",
                      currency: "NGN",
                      createdAt: "2026-10-19T08:00:00.000Z",
                      succeededAt: null,
                      sources: [
                        {
                          kind: "ORDER",
                          reference: "AA-110",
                          branch: {
                            id: state.access.assignments[0].branchId,
                            name: "Stadium Road",
                          },
                        },
                      ],
                    }
                  : {}),
                ...(queue === "orders"
                  ? {
                      orderNumber: "Existing queue record",
                      status: "COMPLETED",
                      fulfillmentMethod: "COLLECTION",
                      paidAt: "2026-10-19T08:00:00.000Z",
                      createdAt: "2026-10-19T08:00:00.000Z",
                      updatedAt: "2026-10-19T08:00:00.000Z",
                      branchId: state.access.assignments[0].branchId,
                      branch: {
                        id: state.access.assignments[0].branchId,
                        name: "Stadium Road",
                      },
                      items: [],
                      availableNextStates: [],
                    }
                  : {}),
                ...(queue === "complaints"
                  ? {
                      description: "Existing complaint content",
                      priority: "MEDIUM",
                      createdAt: "2026-10-19T08:00:00.000Z",
                      updatedAt: "2026-10-19T08:00:00.000Z",
                      branchId: state.access.assignments[0].branchId,
                      branch: {
                        id: state.access.assignments[0].branchId,
                        name: "Stadium Road",
                      },
                    }
                  : {}),
                ...(queue === "enquiries"
                  ? {
                      type: "GENERAL",
                      message: "Existing enquiry content",
                      createdAt: "2026-10-19T08:00:00.000Z",
                      updatedAt: "2026-10-19T08:00:00.000Z",
                      branchId: state.access.assignments[0].branchId,
                      branch: {
                        id: state.access.assignments[0].branchId,
                        name: "Stadium Road",
                      },
                      assignedStaffId: null,
                      assignedStaff: null,
                    }
                  : {}),
              },
            ],
          },
          message: "Isolated route regression",
          meta: { requestId: "q106-regression" },
        },
      }),
    );
    await page.goto(`/admin/workforce/${queue}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      ["enquiries", "complaints", "orders", "finance"].includes(queue)
        ? page.getByRole("rowheader", { name: /^Existing queue record/ })
        : page.getByRole("heading", { name: "Existing queue record", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.locator(".workforce-bookings")).toHaveCount(0);
    expect(state.requests).not.toContain("/staff/workforce/bookings");
  });
}

test("keyboard filter, reset and paging retain visible focus", async ({ page }) => {
  await ready(page);
  const search = page.getByLabel("Search bookings", { exact: true });
  await search.focus();
  await page.keyboard.type("Toyota");
  expect(await search.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
    "none",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Booking status", { exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Apply filters", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=Toyota&status=REQUESTED/);
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Clear filters", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(rows(page)).toHaveCount(25);
  await page.getByRole("button", { name: "Next bookings", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(rows(page)).toHaveCount(2);
});
