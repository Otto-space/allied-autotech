import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workforceBookingConfirmationFixture,
  id,
} from "../fixtures/workforce-booking-confirmation";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request, page }) => {
  await bookingRuntimeCapabilities(request, page);
});

async function start(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
  width = 320,
  mode = "normal",
) {
  const f = await workforceBookingConfirmationFixture(page, role);
  f.booking.status = "CONFIRMED";
  f.booking.confirmedAt = "2040-01-01T08:00:00.000Z";
  const writes: { body: Record<string, unknown>; csrf?: string }[] = [];
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Synthetic isolated capabilities",
        meta: { requestId: "timing-capabilities" },
        data: {
          scope: "POLICY_SUMMARY",
          serverTime: new Date().toISOString(),
          release: {
            mode: "full",
            customerAccountsEnabled: true,
            enquiriesEnabled: true,
            bookingRequestsEnabled: true,
            inspectionRequestsEnabled: true,
          },
          checkoutEnabled: false,
          vehicleDeposits: { enabled: false },
        },
      },
    }),
  );
  await page.route("**/api/v1/staff/workforce/bookings/*/timing", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const body = request.postDataJSON();
    writes.push({ body, csrf: request.headers()["x-csrf-token"] });
    expect(body.expectedVersion).toBe(f.booking.version);
    f.booking.version++;
    f.booking.scheduleVersion++;
    const timing = {
      scheduleVersion: f.booking.scheduleVersion,
      scheduledAt: f.booking.scheduledAt,
      durationMinutes: body.durationMinutes,
      preparationMinutes: body.preparationMinutes,
      cleanupMinutes: body.cleanupMinutes,
      source: "APPOINTMENT_OVERRIDE" as const,
      reason: body.reason,
      createdAt: new Date().toISOString(),
    };
    f.booking.timingSnapshots = [timing];
    f.booking.service.durationMinutes = body.durationMinutes;
    if (mode === "lost") return route.abort("failed");
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic timing receipt",
        meta: { requestId: "timing-fixture" },
        data: {
          id: f.booking.id,
          branchId: f.booking.branchId,
          version: f.booking.version,
          scheduleVersion: f.booking.scheduleVersion,
          scheduledAt: f.booking.scheduledAt,
          status: f.booking.status,
          timing,
          performedByUserId: mode === "malformed" ? id(9999) : f.base.access.userId,
        },
      },
    });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const expected =
      mode === "lost" &&
      message.location().url.includes("/timing") &&
      /^Failed to load resource:/.test(message.text());
    if (message.type() === "error" && !expected) errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)
    )
      external.push(request.url());
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/admin/workforce/bookings/${f.booking.id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/workforce/bookings/${f.booking.id}$`));
  await expect(page).toHaveTitle(/Allied/i);
  await expect(
    page.getByRole("heading", { name: "Review appointment timing", exact: true }),
  ).toBeVisible();
  return {
    f,
    writes,
    check: async () => {
      expect(external).toEqual([]);
      await verifyConsole(page, errors, warnings);
    },
  };
}
async function review(page: Page) {
  await page.getByLabel("Estimated job time (minutes)", { exact: true }).fill("45");
  await page
    .getByLabel("Preparation before arrival (minutes)", { exact: true })
    .fill("10");
  await page.getByLabel("Cleanup after work (minutes)", { exact: true }).fill("15");
  await page
    .getByLabel("Reason for this appointment override (internal)")
    .fill("Synthetic individual assessment");
  await page
    .getByLabel("People and equipment review for this estimate")
    .fill("Synthetic people and equipment checked");
  await page.getByRole("button", { name: "Review estimate change", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 768, 1440])
    test(`${role} reviews an individual estimate at ${width}px without moving the appointment`, async ({
      page,
    }) => {
      const { f, writes, check } = await start(page, role, width);
      const original = f.booking.scheduledAt;
      await review(page);
      expect(writes).toEqual([]);
      expect(f.booking.service.durationMinutes).toBe(60);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("45 minutes");
      await expect(dialog).toContainText("Internal decision reason");
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "STAFF")
        await page.screenshot({
          path: test.info().outputPath(`allied-booking-timing-${width}.png`),
        });
      await dialog
        .getByRole("button", { name: "Confirm estimate change", exact: true })
        .click();
      await expect(
        page.getByText(
          "Appointment estimate updated. The start time and status are unchanged.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByLabel("Estimated job time (minutes)", { exact: true }),
      ).toHaveValue("45");
      expect(f.booking.scheduledAt).toBe(original);
      expect(f.booking.status).toBe("CONFIRMED");
      expect(writes).toHaveLength(1);
      expect(writes[0].csrf).toBeTruthy();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.reload();
      await expect(
        page.getByLabel("Estimated job time (minutes)", { exact: true }),
      ).toHaveValue("45");
      expect(writes).toHaveLength(1);
      await check();
    });
for (const mode of ["lost", "malformed"])
  test(`${mode} estimate result requires inspection without replay`, async ({ page }) => {
    const { writes, check } = await start(page, "STAFF", 320, mode);
    await review(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm estimate change", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier estimate change" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Check the earlier estimate change" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Check current estimate", exact: true })
      .click();
    await page
      .getByLabel("I have checked the current estimate and timing history.")
      .check();
    await page.getByRole("button", { name: "Clear checked estimate reference" }).click();
    await expect(
      page.getByRole("heading", { name: "Check the earlier estimate change" }),
    ).toHaveCount(0);
    expect(writes).toHaveLength(1);
    await check();
  });
test("grant removed after estimate review prevents submission", async ({ page }) => {
  const { f, writes, check } = await start(page);
  await review(page);
  f.base.access.independentCapabilities = [];
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm estimate change", exact: true })
    .click();
  await expect(page.getByText(/No estimate was sent/)).toBeVisible();
  expect(writes).toEqual([]);
  await check();
});
