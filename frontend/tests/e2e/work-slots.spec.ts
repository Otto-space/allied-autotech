import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workSlotsFixture, bookingId } from "../fixtures/work-slots";

test("filters preserve Lagos boundaries, scope and browser traversal", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page);
  await page.goto("/admin/booking-slots");
  await expect(page.getByText("3 slots on this page")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("2 slots on this page")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Starts from", { exact: true }).fill("2027-01-01");
  await page.getByLabel("Starts to", { exact: true }).fill("2027-01-01");
  await page.getByLabel("Slot status", { exact: true }).selectOption("CLOSED");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("1 slot on this page")).toBeVisible();
  expect(state.reads.at(-1)?.searchParams.get("startsFrom")).toBe(
    "2026-12-31T23:00:00.000Z",
  );
  expect(state.reads.at(-1)?.searchParams.get("startsTo")).toBe(
    "2027-01-01T23:00:00.000Z",
  );
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 slot on this page")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/booking-slots$/);
});
test("advanced administrator filters send real record IDs", async ({ page }) => {
  const { state } = await workSlotsFixture(page);
  await page.goto("/admin/booking-slots");
  await page
    .locator("summary")
    .filter({ hasText: "Branch, service & staff filters" })
    .click();
  await page.getByLabel("Branch", { exact: true }).selectOption(bookingId(101));
  await page.getByLabel("Service", { exact: true }).selectOption(bookingId(100));
  await page.getByLabel("Staff", { exact: true }).selectOption(bookingId(601));
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect
    .poll(() => state.reads.at(-1)?.searchParams.get("staffId"))
    .toBe(bookingId(601));
  expect(state.reads.at(-1)?.searchParams.get("branchId")).toBe(bookingId(101));
  expect(state.reads.at(-1)?.searchParams.get("serviceId")).toBe(bookingId(100));
  await page.reload();
  await expect(page.getByLabel("Branch", { exact: true })).toHaveValue(bookingId(101));
});
test("invalid URL and reversed dates fail closed", async ({ page }) => {
  const { state } = await workSlotsFixture(page);
  await page.goto("/admin/booking-slots?status=UNKNOWN");
  await expect(page.getByText(/These slot filters are invalid/)).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.getByRole("button", { name: "Clear invalid filters" }).click();
  await page.getByLabel("Starts from", { exact: true }).fill("2027-02-02");
  await page.getByLabel("Starts to", { exact: true }).fill("2027-01-01");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByText("Choose valid dates with the end on or after the start."),
  ).toBeVisible();
  await expect(page.getByLabel("Starts from", { exact: true })).toBeFocused();
});
test("staff publication and filtering stay in their branch", async ({ page }) => {
  const { state } = await workSlotsFixture(page, "STAFF");
  state.records[1].staff = { ...state.records[1].staff!, id: bookingId(602) };
  state.records[1].staffId = bookingId(602);
  await page.goto("/admin/booking-slots");
  await expect(page.getByLabel("Appointment branch")).toHaveValue(bookingId(101));
  await expect(page.getByLabel("Appointment branch").locator("option")).toHaveCount(1);
  await expect(
    page.getByText("Assigned staff or administrator manages this slot."),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Branch, service & staff filters" })
    .click();
  await expect(page.getByLabel("Branch", { exact: true })).toHaveCount(0);
  await page.getByLabel("Only slots assigned to me").check();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect
    .poll(() => state.reads.at(-1)?.searchParams.get("staffId"))
    .toBe(bookingId(601));
  expect(state.reads.at(-1)?.searchParams.has("branchId")).toBe(false);
});
for (const mode of ["empty", "error", "denied", "malformed"]) {
  test(`${mode} slots expose no unsafe actions`, async ({ page }) => {
    const { state } = await workSlotsFixture(page);
    state.mode = mode;
    await page.goto("/admin/booking-slots");
    await expect(
      page.getByRole("heading", {
        name:
          mode === "empty"
            ? "No appointment slots match this page and filter."
            : "Appointment slots unavailable",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close slot", exact: true }),
    ).toHaveCount(0);
    if (mode !== "empty") {
      await expect(page.getByRole("button", { name: "Review new slot" })).toBeDisabled();
      state.mode = "normal";
      await page.getByRole("button", { name: "Retry slots" }).click();
      await expect(page.getByText("3 slots on this page")).toBeVisible();
    }
    expect(state.writes).toHaveLength(0);
  });
}
test("loading blocks authoring and resolves to records", async ({ page }) => {
  const { state } = await workSlotsFixture(page);
  state.mode = "hold";
  await page.goto("/admin/booking-slots");
  await expect(page.getByText("Checking appointment slots...")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review new slot" })).toBeDisabled();
  await expect.poll(() => !!state.held).toBe(true);
  state.mode = "normal";
  state.held?.();
  await expect(page.getByText("3 slots on this page")).toBeVisible();
});
test("background failure retains records and drafts but blocks writes", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page);
  await page.goto("/admin/booking-slots");
  await expect(page.getByText("3 slots on this page")).toBeVisible();
  await page.getByLabel("Appointment starts (Lagos time)").fill("2027-01-02T10:00");
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Slots may be out of date. Refresh before making changes."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close slot", exact: true }).first(),
  ).toBeDisabled();
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toHaveValue(
    "2027-01-02T10:00",
  );
  state.mode = "normal";
  await page.getByRole("button", { name: "Refresh slots" }).click();
  await expect(
    page.getByRole("button", { name: "Close slot", exact: true }).first(),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
test("versioned status review supports cancellation and prevents rejected replay", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page);
  await page.goto("/admin/booking-slots");
  await page.getByRole("button", { name: "Close slot", exact: true }).first().click();
  await expect(
    page.getByRole("dialog").getByText(/does not cancel an existing booking/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  state.outcome = "conflict";
  await page.getByRole("button", { name: "Close slot", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toEqual({ expectedVersion: 1, status: "CLOSED" });
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
});
test("publication validates future time before review", async ({ page }) => {
  const { state } = await workSlotsFixture(page, "STAFF");
  await page.goto("/admin/booking-slots");
  await page.getByLabel("Appointment service").selectOption(bookingId(100));
  await page.getByLabel("Appointment starts (Lagos time)").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Review new slot" }).click();
  await expect(
    page.getByText("Choose a future appointment time in Lagos time."),
  ).toBeVisible();
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toBeFocused();
  await page.getByLabel("Appointment starts (Lagos time)").fill("2027-01-02T10:00");
  await page.getByRole("button", { name: "Review new slot" }).click();
  await expect(
    page.getByRole("dialog", { name: "Publish this appointment slot?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
});
test("staff draft survives permission refresh denial without enabling edits", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page, "STAFF");
  await page.goto("/admin/booking-slots");
  await page.getByLabel("Appointment starts (Lagos time)").fill("2027-01-02T10:00");
  state.profileMode = "denied";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toBeDisabled();
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toHaveValue(
    "2027-01-02T10:00",
  );
  await expect(page.getByRole("button", { name: "Close slot", exact: true })).toHaveCount(
    0,
  );
  state.profileMode = "normal";
  await page.getByRole("button", { name: "Refresh slots" }).click();
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toBeEnabled();
  await expect(page.getByLabel("Appointment starts (Lagos time)")).toHaveValue(
    "2027-01-02T10:00",
  );
  expect(state.writes).toHaveLength(0);
});
test("publication choice failures offer read retry and prevent submission", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page, "STAFF");
  state.choicesMode = "error";
  await page.goto("/admin/booking-slots");
  await expect(page.getByRole("button", { name: "Review new slot" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retry branch choices" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry service choices" })).toBeEnabled();
  state.choicesMode = "normal";
  await page.getByRole("button", { name: "Retry branch choices" }).click();
  await page.getByRole("button", { name: "Retry service choices" }).click();
  await expect(page.getByRole("button", { name: "Review new slot" })).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
for (const width of [320, 390, 768, 1024, 1280, 1505, 1920]) {
  test(`slots are readable and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1045 });
    await workSlotsFixture(page);
    await page.goto("/admin/booking-slots");
    await expect(page.getByText("3 slots on this page")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator("nav[aria-label='Breadcrumb'] ol [aria-current='page']"),
    ).toHaveText("Appointment slots");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if ([320, 768, 1505].includes(width)) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    }
    if (width === 390) {
      await page.getByRole("link", { name: "Publish slot", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Publish an appointment slot" }),
      ).toBeInViewport();
    }
  });
}
