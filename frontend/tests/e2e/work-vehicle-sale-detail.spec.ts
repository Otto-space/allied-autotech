import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workSaleDetailFixture, bookingId } from "../fixtures/work-vehicle-sale-detail";
import { salesRecord } from "../fixtures/work-vehicle-sales";
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
async function open(page: Page) {
  await page.goto(`/admin/vehicle-sales/${bookingId(10000)}`);
  await expect(
    page.getByRole("heading", { name: "Toyota Camry SE", exact: true }),
  ).toBeVisible();
}
async function negotiate(page: Page) {
  await page.getByLabel("Agreed price (NGN)", { exact: true }).fill("12345678.91");
  await page
    .getByLabel("Negotiation notes (optional)")
    .fill("Customer-visible agreed notes\nSecond line");
  await btn(page, "Review negotiated price").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} reads named purchase, full references, precise dates and amounts`, async ({
    page,
  }) => {
    await workSaleDetailFixture(page, role);
    await open(page);
    await expect(page.locator(".work-sale-detail")).toContainText("Amina Okafor");
    await expect(page.locator(".wsd-overview")).toContainText("99,999,999,999,999.99");
    await expect(page.locator(".wsd-overview")).toContainText("10:00:37.123");
    await expect(page.locator(".wsd-overview")).toContainText(bookingId(11000));
    await expect(page.getByRole("link", { name: "AA-001", exact: true })).toHaveAttribute(
      "href",
      `/admin/vehicles/${bookingId(13000)}`,
    );
    await expect(page.getByText("No progress entries are recorded.")).toBeVisible();
  });
test("private record read waits for own profile and recovers", async ({ page }) => {
  const f = await workSaleDetailFixture(page);
  f.state.profileMode = "hold";
  await page.goto(`/admin/vehicle-sales/${bookingId(10000)}`);
  await expect(
    page.getByText("Checking purchase access…", { exact: true }),
  ).toBeVisible();
  expect(f.detail.reads).toBe(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry purchase access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry purchase access").click();
  await expect(
    page.getByRole("heading", { name: "Toyota Camry SE", exact: true }),
  ).toBeVisible();
});
for (const mode of ["malformed", "mismatch", "denied", "missing"])
  test(`${mode} detail exposes no purchase facts`, async ({ page }) => {
    const f = await workSaleDetailFixture(page);
    f.detail.mode = mode;
    await page.goto(`/admin/vehicle-sales/${bookingId(10000)}`);
    await expect(btn(page, "Retry vehicle purchase")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Toyota Camry SE", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".wsd-overview")).toHaveCount(0);
    expect(f.detail.writes).toHaveLength(0);
  });
test("Staff foreign branch response is rejected", async ({ page }) => {
  const f = await workSaleDetailFixture(page, "STAFF");
  f.detail.record.vehicleListing.branchId = bookingId(103);
  await page.goto(`/admin/vehicle-sales/${bookingId(10000)}`);
  await expect(btn(page, "Retry vehicle purchase")).toBeVisible();
  await expect(page.locator(".wsd-overview")).toHaveCount(0);
});
test("full review can be cancelled and confirmation sends exact amounts and notes once", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  await open(page);
  await negotiate(page);
  await expect(page.getByRole("dialog")).toContainText("Customer-visible agreed notes");
  await expect(page.getByRole("dialog")).toContainText("12,345,678.91");
  await btn(page, "Go back").click();
  expect(f.detail.writes).toHaveLength(0);
  await btn(page, "Review negotiated price").click();
  f.detail.writeMode = "hold";
  await confirm(page).click();
  await expect(btn(page, "Submitting…")).toBeDisabled();
  await expect.poll(() => f.detail.writes.length).toBe(1);
  f.detail.writeMode = "normal";
  f.detail.held?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes[0].body).toEqual({
    expectedVersion: 0,
    agreedPriceKobo: "1234567891",
    reservationRequiredKobo: null,
    notes: "Customer-visible agreed notes\nSecond line",
  });
  await expect(page.locator(".wsd-history")).toContainText(
    "Customer-visible agreed notes",
  );
  await expect(page.getByLabel("Agreed price (NGN)", { exact: true })).toHaveValue(
    "12345678.91",
  );
});
test("concurrent record retains draft, blocks old version and requires explicit field reload", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  await open(page);
  await page.getByLabel("Agreed price (NGN)", { exact: true }).fill("123.45");
  f.detail.record.version++;
  f.detail.record.agreedPriceKobo = "77777";
  await btn(page, "Refresh vehicle purchase").click();
  await expect(btn(page, "Reload negotiation fields")).toBeVisible();
  await expect(page.getByLabel("Agreed price (NGN)", { exact: true })).toHaveValue(
    "123.45",
  );
  await expect(btn(page, "Review negotiated price")).toBeDisabled();
  await btn(page, "Reload negotiation fields").click();
  await expect(page.getByLabel("Agreed price (NGN)", { exact: true })).toHaveValue(
    "777.77",
  );
  expect(f.detail.writes).toHaveLength(0);
});
test("fresh preflight blocks changed facts without sending and preserves the draft", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  await open(page);
  await negotiate(page);
  f.detail.record.version++;
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(page.getByLabel("Negotiation notes (optional)")).toHaveValue(
    "Customer-visible agreed notes\nSecond line",
  );
  expect(f.detail.writes).toHaveLength(0);
});
test("definitive API rejection remains distinct from an unsent preflight", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  f.detail.writeMode = "reject";
  await open(page);
  await negotiate(page);
  await confirm(page).click();
  await expect(btn(page, "Go back")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(btn(page, "Load current purchase")).toHaveCount(0);
  expect(f.detail.writes).toHaveLength(1);
});
for (const mode of ["lost", "malformed", "mismatch", "throttle"])
  test(`${mode} receipt stays locked through reload and explicit recovery never replays`, async ({
    page,
  }) => {
    const f = await workSaleDetailFixture(page);
    f.detail.writeMode = mode;
    await open(page);
    await negotiate(page);
    await confirm(page).click();
    await expect(btn(page, "Close & review record")).toBeVisible();
    await btn(page, "Close & review record").click();
    await expect(btn(page, "Load current purchase")).toBeVisible();
    await expect(btn(page, "Review negotiated price")).toBeDisabled();
    const markers = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:sale-detail:v1:"),
      ),
    );
    expect(markers).toHaveLength(1);
    expect(markers[0][1]).not.toContain("Customer-visible");
    expect(markers[0][1]).not.toContain("1234567891");
    await page.reload();
    await expect(btn(page, "Load current purchase")).toBeVisible();
    await btn(page, "Load current purchase").click();
    await expect(btn(page, "Load current purchase")).toHaveCount(0);
    await expect(page.locator(".work-sale-detail")).toContainText(
      "previous request outcome is not proven",
    );
    expect(f.detail.writes).toHaveLength(1);
  });
test("temporary read error keeps facts read-only, access denial removes them", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  await open(page);
  f.detail.mode = "error";
  await btn(page, "Refresh vehicle purchase").click();
  await expect(btn(page, "Retry vehicle purchase")).toBeVisible();
  await expect(page.locator(".wsd-overview")).toBeVisible();
  await expect(btn(page, "Review negotiated price")).toBeDisabled();
  f.detail.mode = "denied";
  await btn(page, "Retry vehicle purchase").click();
  await expect(page.locator(".wsd-overview")).toHaveCount(0);
});
test("handover uses its own revision, retains zero facts and offers completion only with evidence", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  f.detail.record = {
    ...f.detail.record,
    status: "HANDOVER_PENDING",
    version: 15,
    handover: {
      ...salesRecord(2).handover!,
      status: "PENDING",
      recipientName: "Amina Okafor",
      recipientPhone: "+2348000000000",
      version: 4,
    },
  };
  await open(page);
  await expect(page.locator("#purchase-handover")).toContainText("Attached");
  await expect(
    page.locator("#purchase-handover dt", { hasText: /^Odometer$/ }).locator("+ dd"),
  ).toContainText("0");
  await btn(page, "Review handover status").click();
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes[0].body).toEqual({ status: "READY", expectedVersion: 4 });
  expect(f.detail.record.version).toBe(15);
  await page.getByLabel("Next handover status").selectOption("COMPLETED");
  await btn(page, "Review handover status").click();
  await expect(page.getByRole("dialog")).toContainText("marks the vehicle listing sold");
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.record.version).toBe(16);
  expect(f.detail.record.handover?.version).toBe(6);
  await expect(page.locator(".status").first()).toHaveText("Completed");
});
test("independent handover version change preserves fields until explicit reload", async ({
  page,
}) => {
  const f = await workSaleDetailFixture(page);
  f.detail.record = {
    ...f.detail.record,
    status: "HANDOVER_PENDING",
    handover: {
      ...salesRecord(2).handover!,
      status: "PENDING",
      hasSignedDocument: false,
    },
  };
  await open(page);
  f.detail.record.handover!.version++;
  f.detail.record.handover!.status = "READY";
  await btn(page, "Refresh vehicle purchase").click();
  await expect(btn(page, "Reload handover fields")).toBeVisible();
  await expect(btn(page, "Review handover status")).toBeDisabled();
  await btn(page, "Reload handover fields").click();
  await expect(page.getByLabel("Next handover status")).toHaveValue("CANCELLED");
  await expect(
    page
      .getByLabel("Next handover status")
      .getByRole("option", { name: "COMPLETED", exact: true }),
  ).toHaveCount(0);
  expect(f.detail.writes).toHaveLength(0);
});
test("seven responsive widths and review retain accessible names, contrast and no overflow", async ({
  page,
}) => {
  await workSaleDetailFixture(page);
  await open(page);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
  await negotiate(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
