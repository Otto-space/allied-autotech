import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workBookingsFixture, bookingId, workBooking } from "../fixtures/work-bookings";
const rows = ".work-booking-table tbody tr";
const apply = { name: "Apply filters", exact: true };
for (const width of [320, 360, 375, 390, 430, 768, 844, 1024, 1280, 1440, 1505, 1920]) {
  test(`workshop records and expanded filters fit ${width}px`, async ({ page }) => {
    const state = await workBookingsFixture(page);
    state.records[0].service.name =
      "Comprehensive engine diagnostics and electrical fault investigation";
    state.records[0].branch!.name =
      "Stadium Road workshop with a long permitted branch name";
    await page.setViewportSize({ width, height: width === 844 ? 390 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/bookings");
    await expect(page.locator(rows)).toHaveCount(5);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator('.work-booking-breadcrumb [aria-current="page"]'),
    ).toHaveText("Workshop bookings");
    for (const link of await page.locator(".work-booking-action a").all()) {
      const box = await link.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByText("Branch & staff filters", { exact: true }).click();
    await expect(page.getByLabel("Assigned staff", { exact: true })).toContainText(
      "Ada Okoro",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    if ([320, 768, 1505].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    expect(errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} filters remain read-only and role appropriate`, async ({ page }) => {
    const state = await workBookingsFixture(page, role);
    await page.goto("/admin/bookings");
    await expect(page.locator(rows)).toHaveCount(5);
    await page.getByText("Branch & staff filters", { exact: true }).click();
    if (role === "STAFF") {
      await expect(page.getByLabel("Branch", { exact: true })).toHaveCount(0);
      await page.getByLabel("Only bookings assigned to me").check();
    } else {
      await page.getByLabel("Branch", { exact: true }).selectOption(bookingId(101));
      await page
        .getByLabel("Assigned staff", { exact: true })
        .selectOption(bookingId(601));
    }
    await page
      .getByRole("button", { name: "Apply branch & staff filters", exact: true })
      .click();
    await expect
      .poll(() => state.reads.at(-1)?.searchParams.get("assignedStaffId"))
      .toBe(bookingId(601));
    expect(state.reads.at(-1)?.searchParams.get("branchId")).toBe(
      role === "STAFF" ? null : bookingId(101),
    );
    await expect(page.locator(rows)).toHaveCount(5);
    expect(state.writes).toEqual([]);
  });
test("status and inclusive dates persist across reload, Back and Forward", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  await page.getByLabel("Booking status", { exact: true }).selectOption("CONFIRMED");
  await page.getByLabel("Appointment from").fill("2026-10-12");
  await page.getByLabel("Appointment to").fill("2026-10-12");
  await page.getByRole("button", apply).click();
  await expect(page.locator(rows)).toHaveCount(1);
  expect(state.reads.at(-1)?.searchParams.get("scheduledFrom")).toBe(
    "2026-10-11T23:00:00.000Z",
  );
  expect(state.reads.at(-1)?.searchParams.get("scheduledTo")).toBe(
    "2026-10-12T23:00:00.000Z",
  );
  await page.reload();
  await expect(page.getByLabel("Appointment from")).toHaveValue("2026-10-12");
  await page.goBack();
  await expect(page.locator(rows)).toHaveCount(5);
  await page.goForward();
  await expect(page.locator(rows)).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(5);
  await expect(page.getByLabel("Booking status", { exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("cursor navigation persists and filters reset paging", async ({ page }) => {
  const state = await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.locator("#work-booking-results")).toBeFocused();
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(5);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(1);
  await page.getByLabel("Booking status").selectOption("REQUESTED");
  await page.getByRole("button", apply).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
});
test("invalid date ranges focus an associated error without reading or replacing results", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  const count = state.reads.length;
  await page.getByLabel("Appointment from").fill("2026-10-13");
  await page.getByLabel("Appointment to").fill("2026-10-12");
  await page.getByRole("button", apply).click();
  await expect(page.getByLabel("Appointment to")).toBeFocused();
  await expect(page.getByLabel("Appointment to")).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Choose valid dates in order, covering no more than 366 days."),
  ).toBeVisible();
  expect(state.reads).toHaveLength(count);
  await expect(page.locator(rows)).toHaveCount(5);
});
for (const query of [
  "status=BOGUS",
  "from=2026-02-30",
  "cursor=bad",
  "status=REQUESTED&status=CONFIRMED",
])
  test(`invalid URL fails closed: ${query}`, async ({ page }) => {
    const state = await workBookingsFixture(page);
    await page.goto(`/admin/bookings?${query}`);
    await expect(page.getByText(/These booking filters are invalid/)).toBeVisible();
    expect(state.reads).toHaveLength(0);
    await page.getByRole("button", { name: "Clear invalid filters" }).click();
    await expect(page.locator(rows)).toHaveCount(5);
  });
for (const mode of ["empty", "error", "denied", "malformed"])
  test(`truthful ${mode} and explicit recovery`, async ({ page }) => {
    const state = await workBookingsFixture(page);
    state.mode = mode;
    await page.goto("/admin/bookings");
    await expect(
      page.getByRole("heading", {
        name: mode === "empty" ? "No workshop bookings yet" : "Bookings unavailable",
      }),
    ).toBeVisible();
    await expect(page.locator(rows)).toHaveCount(0);
    state.mode = "normal";
    await page
      .getByRole("button", {
        name: mode === "empty" ? "Refresh bookings" : "Retry bookings",
        exact: true,
      })
      .click();
    await expect(page.locator(rows)).toHaveCount(5);
  });
test("background failure discloses stale data; manual failure and denial hide old rows", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Bookings may be out of date/)).toBeVisible();
  await expect(page.locator(rows)).toHaveCount(5);
  await page.getByRole("button", { name: "Refresh bookings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bookings unavailable" })).toBeVisible();
  await expect(page.locator(rows)).toHaveCount(0);
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry bookings" }).click();
  await expect(page.locator(rows)).toHaveCount(5);
  state.mode = "denied";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(rows)).toHaveCount(0);
});
test("a slow filter hides the previous scope and prevents duplicate refresh", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  state.mode = "hold";
  await page.getByLabel("Booking status").selectOption("CONFIRMED");
  await page.getByRole("button", apply).click();
  await expect(page.locator(rows)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Updating bookings…" })).toBeDisabled();
  await expect.poll(() => !!state.held).toBe(true);
  state.mode = "normal";
  state.held!();
  await expect(page.locator(rows)).toHaveCount(1);
});
test("filtered empty and missing legacy fields remain actionable", async ({ page }) => {
  const state = await workBookingsFixture(page);
  state.records = [
    {
      ...workBooking(),
      scheduledAt: null,
      branch: null,
      assignedStaff: null,
      vehicle: null,
    } as unknown as ReturnType<typeof workBooking>,
  ];
  await page.goto("/admin/bookings");
  await expect(page.getByText("Not scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText("Not linked", { exact: true })).toBeVisible();
  await page.getByLabel("Booking status").selectOption("EXPIRED");
  await page.getByRole("button", apply).click();
  await expect(
    page.getByRole("heading", { name: "No bookings match these filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear booking filters", exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(1);
  await page
    .getByRole("link", { name: "View booking: Vehicle diagnostics", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/bookings/${bookingId(1)}$`));
});
test("directory failures do not make the booking list unavailable", async ({ page }) => {
  const state = await workBookingsFixture(page);
  state.choicesMode = "error";
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  await page.getByText("Branch & staff filters", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry staff choices" })).toBeVisible();
  state.choicesMode = "normal";
  await page.getByRole("button", { name: "Retry staff choices" }).click();
  await page.getByRole("button", { name: "Retry branch choices" }).click();
  await expect(page.getByLabel("Assigned staff", { exact: true })).toContainText(
    "Ada Okoro",
  );
  await expect(page.locator(rows)).toHaveCount(5);
});

test("all eight server statuses remain filterable, including historical deposit records", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  const statuses = [
    "REQUESTED",
    "AWAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "EXPIRED",
  ];
  state.records = statuses.map((status, index) => workBooking(index + 1, status));
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(8);
  for (const status of statuses) {
    await page.getByLabel("Booking status").selectOption(status);
    await page.getByRole("button", apply).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => state.reads.at(-1)?.searchParams.get("status")).toBe(status);
    await expect(page.locator(rows)).toHaveCount(1);
  }
  expect(state.writes).toEqual([]);
});
test("session invalidation removes private records", async ({ page }) => {
  await workBookingsFixture(page);
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.locator(rows)).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
});
test("customer routes away before privileged records load", async ({ page }) => {
  const state = await workBookingsFixture(page, "CUSTOMER");
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(state.reads).toHaveLength(0);
});
test("staff cannot apply a branch override from a URL", async ({ page }) => {
  const state = await workBookingsFixture(page, "STAFF");
  await page.goto(`/admin/bookings?branchId=${bookingId(102)}`);
  await expect(page.getByText(/These booking filters are invalid/)).toBeVisible();
  expect(state.reads).toHaveLength(0);
});
test("mismatched returned status fails closed", async ({ page }) => {
  await workBookingsFixture(page);
  await page.route("**/api/v1/staff/bookings?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Fixture",
        meta: { requestId: "scope-qa" },
        data: { items: [workBooking(1, "REQUESTED")] },
      },
    }),
  );
  await page.goto("/admin/bookings?status=CONFIRMED");
  await expect(
    page.getByText(/returned records do not match your filters/),
  ).toBeVisible();
  await expect(page.locator(rows)).toHaveCount(0);
});
test("directory pagination neither applies filters nor loses selection", async ({
  page,
}) => {
  const state = await workBookingsFixture(page);
  for (const kind of ["branches", "staff"])
    await page.route(`**/api/v1/admin/${kind}?**`, (route) => {
      const next = new URL(route.request().url()).searchParams.has("cursor");
      const data = {
        items:
          kind === "branches"
            ? [
                {
                  id: bookingId(next ? 102 : 101),
                  name: next ? "Older branch" : "Stadium Road workshop",
                  isActive: !next,
                },
              ]
            : [
                {
                  id: bookingId(next ? 304 : 302),
                  role: "STAFF",
                  email: "choice@example.test",
                  status: next ? "SUSPENDED" : "ACTIVE",
                  staffProfile: {
                    id: bookingId(next ? 602 : 601),
                    firstName: next ? "Previous" : "Ada",
                    lastName: "Technician",
                    branchId: bookingId(101),
                  },
                },
              ],
        ...(!next ? { nextCursor: bookingId(700) } : {}),
      };
      return route.fulfill({
        json: {
          success: true,
          message: "Fixture",
          meta: { requestId: "choices-qa" },
          data,
        },
      });
    });
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  const reads = state.reads.length;
  await page.getByText("Branch & staff filters", { exact: true }).click();
  const branches = page.getByRole("navigation", { name: "Branch choices pages" });
  await branches.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Branch", { exact: true }).selectOption(bookingId(102));
  await branches.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByLabel("Branch", { exact: true })).toHaveValue(bookingId(102));
  const staff = page.getByRole("navigation", { name: "Staff choices pages" });
  await staff.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Assigned staff", { exact: true })).toContainText(
    "Previous Technician (Suspended)",
  );
  await page.getByLabel("Assigned staff", { exact: true }).selectOption(bookingId(602));
  await staff.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByLabel("Assigned staff", { exact: true })).toHaveValue(
    bookingId(602),
  );
  expect(state.reads).toHaveLength(reads);
  expect(state.writes).toEqual([]);
});

test("another staff assignment in a shared URL is not labelled as my own", async ({
  page,
}) => {
  const state = await workBookingsFixture(page, "STAFF");
  state.records[0].assignedStaff.id = bookingId(602);
  await page.goto(`/admin/bookings?assignedStaffId=${bookingId(602)}`);
  await expect(page.locator(rows)).toHaveCount(1);
  await expect(page.getByLabel("Only bookings assigned to me")).not.toBeChecked();
  await expect(page.getByText(/A different staff assignment is selected/)).toBeVisible();
  await page.getByLabel("Only bookings assigned to me").check();
  await page.getByRole("button", { name: "Apply branch & staff filters" }).click();
  await expect
    .poll(() => state.reads.at(-1)?.searchParams.get("assignedStaffId"))
    .toBe(bookingId(601));
  await expect(page.locator(rows)).toHaveCount(4);
});
test("missing own staff profile is explained without blocking permitted list reads", async ({
  page,
}) => {
  await workBookingsFixture(page, "STAFF");
  await page.route("**/api/v1/staff/profile", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Fixture",
        meta: { requestId: "profile-qa" },
        data: {
          id: bookingId(302),
          role: "STAFF",
          email: "staff@example.test",
          status: "ACTIVE",
          capabilities: [],
          staffProfile: null,
        },
      },
    }),
  );
  await page.goto("/admin/bookings");
  await expect(page.locator(rows)).toHaveCount(5);
  await page.getByText("Branch & staff filters", { exact: true }).click();
  await expect(page.getByLabel("Only bookings assigned to me")).toBeDisabled();
  await expect(
    page.getByText("A staff profile is needed to filter your own assignments."),
  ).toBeVisible();
});
