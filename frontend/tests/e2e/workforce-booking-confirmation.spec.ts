import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workforceBookingConfirmationFixture } from "../fixtures/workforce-booking-confirmation";
import { verifyConsole } from "../fixtures/preview-console";
const note =
  "Synthetic technician availability and required diagnostic equipment checked";
const reviewButton = (page: Page) =>
  page.getByRole("button", { name: "Review appointment confirmation", exact: true });
const confirmButton = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm appointment", exact: true });
async function start(page: Page, role: "STAFF" | "ADMIN" = "STAFF", width = 390) {
  const f = await workforceBookingConfirmationFixture(page, role);
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const expected =
      (["lost", "policy"].includes(f.actionMode) &&
        message.location().url.includes(`/bookings/${f.booking.id}/confirmation`) &&
        /^Failed to load resource:/.test(message.text()) &&
        /(?:ERR_FAILED|status of 409)/.test(message.text())) ||
      (f.readMode === "error" &&
        message.location().url.endsWith(`/bookings/${f.booking.id}`) &&
        /^Failed to load resource:/.test(message.text()) &&
        /status of 503/.test(message.text()));
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
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  const check = async () => {
    expect(external).toEqual([]);
    await verifyConsole(page, errors, warnings);
  };
  return { f, check };
}
async function review(page: Page) {
  await page.getByLabel("People and equipment review", { exact: true }).fill(note);
  await reviewButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 390, 768, 1440])
    test(`scoped ${role} reviews and confirms an appointment at ${width}px`, async ({
      page,
    }) => {
      const { f, check } = await start(page, role, width);
      await review(page);
      await expect(page.getByRole("dialog")).toContainText(note);
      await expect(page.getByRole("dialog")).toContainText("Synthetic Technician");
      expect(f.writes).toEqual([]);
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "STAFF" && [390, 1440].includes(width))
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-booking-confirmation-review-${width}.png`),
        });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go back", exact: true })
        .click();
      await expect(
        page.getByLabel("People and equipment review", { exact: true }),
      ).toHaveValue(note);
      await reviewButton(page).click();
      await confirmButton(page).click();
      await expect(
        page.getByText(
          "Appointment confirmed. The booking status and one-hour reminder schedule were recorded.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("This appointment is confirmed.", { exact: true }),
      ).toBeVisible();
      if (width <= 390)
        for (const label of await page
          .locator(".workforce-booking-detail > .card > .totals dt")
          .all())
          expect(
            await label.evaluate((element) => element.getBoundingClientRect().height),
          ).toBeLessThan(32);
      expect(f.writes).toHaveLength(1);
      expect(f.writes[0].body).toEqual({ expectedVersion: 0, resourceReviewNote: note });
      expect(f.writes[0].csrf?.length).toBeGreaterThan(31);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await check();
    });

for (const mode of ["lost", "malformed"] as const)
  test(`${mode} confirmation response stays blocked through reload until current state is explicitly inspected`, async ({
    page,
  }) => {
    const { f, check } = await start(page);
    f.actionMode = mode;
    await review(page);
    await confirmButton(page).click();
    await expect(page.getByRole("dialog")).toContainText(
      "The outcome could not be confirmed",
    );
    await expect(confirmButton(page)).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    await expect(
      page.getByText("An earlier confirmation needs checking.", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
    ).not.toContain(note);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Check current booking", exact: true }),
    ).toBeVisible();
    await expect(reviewButton(page)).toHaveCount(0);
    await page
      .getByRole("button", { name: "Check current booking", exact: true })
      .click();
    await expect(
      page.getByText(/Current booking status: Confirmed \(version 1\)/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Acknowledge inspected state", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "I have reviewed the current booking and the earlier confirmation history.",
      })
      .check();
    await page
      .getByRole("button", { name: "Acknowledge inspected state", exact: true })
      .click();
    await expect(
      page.getByText("This appointment is confirmed.", { exact: true }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(1);
    expect(
      await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
    ).not.toContain("aat:workforce-booking-confirm:v1:");
    await check();
  });

test("missing policy is a truthful business dependency and a rejected confirmation retains the editable review", async ({
  page,
}) => {
  const { f, check } = await start(page);
  f.actionMode = "policy";
  await review(page);
  await confirmButton(page).click();
  await expect(page.getByRole("dialog")).toContainText(
    "An authorised policy owner must configure the approved branch capacity and opening calendar before confirmation.",
  );
  await expect(confirmButton(page)).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await expect(
    page.getByLabel("People and equipment review", { exact: true }),
  ).toHaveValue(note);
  expect(f.booking.status).toBe("REQUESTED");
  expect(f.writes).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain(
    "aat:workforce-booking-confirm:v1:",
  );
  await check();
});
test("a changed version fails the fresh preflight without sending and a normal refresh preserves the editable note", async ({
  page,
}) => {
  const { f, check } = await start(page);
  await review(page);
  f.booking.version++;
  await confirmButton(page).click();
  await expect(page.getByRole("dialog")).toContainText("No confirmation was sent.");
  expect(f.writes).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByLabel("People and equipment review", { exact: true }),
  ).toHaveValue(note);
  await check();
});
test("removing the confirmation grant closes its open review while retaining permitted booking reading", async ({
  page,
}) => {
  const { f, check } = await start(page);
  await review(page);
  f.base.access.independentCapabilities = [];
  await page.evaluate(() => window.dispatchEvent(new Event("aat:workforce-recheck")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(reviewButton(page)).toHaveCount(0);
  await expect(
    page.getByText(
      "Confirmation requires a separately granted permission as well as access to this booking.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Booking details", exact: true }),
  ).toBeVisible();
  expect(f.writes).toEqual([]);
  await check();
});
test("removing booking scope discards the protected detail even when the independent grant remains", async ({
  page,
}) => {
  const { f, check } = await start(page);
  await review(page);
  f.base.access.permissions = [];
  f.base.access.assignments = [];
  await page.evaluate(() => window.dispatchEvent(new Event("aat:workforce-recheck")));
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Synthetic diagnostic inspection", { exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toEqual([]);
  await check();
});
test("unavailable recovery storage prevents a confirmation request", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:workforce-booking-confirm:v1:"))
        throw new DOMException("Synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const { f, check } = await start(page);
  await review(page);
  await confirmButton(page).click();
  await expect(page.getByRole("dialog")).toContainText("No confirmation was sent.");
  expect(f.writes).toEqual([]);
  await check();
});

for (const missing of ["staff", "duration"] as const)
  test(`missing ${missing} remains unknown and prevents confirmation controls`, async ({
    page,
  }) => {
    const { f, check } = await start(page);
    if (missing === "staff") f.booking.assignedStaff = null;
    else f.booking.service.durationMinutes = null;
    await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
    await expect(
      page.getByText(
        "An authorised workshop manager must record the assigned staff member and service duration before confirmation.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(reviewButton(page)).toHaveCount(0);
    expect(f.writes).toEqual([]);
    await check();
  });
test("a failed detail refresh hides protected facts and a successful retry preserves the editable review", async ({
  page,
}) => {
  const { f, check } = await start(page);
  await page.getByLabel("People and equipment review", { exact: true }).fill(note);
  f.readMode = "error";
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Booking appointment" })).toHaveCount(0);
  await expect(reviewButton(page)).toHaveCount(0);
  f.readMode = "normal";
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByLabel("People and equipment review", { exact: true }),
  ).toHaveValue(note);
  expect(f.writes).toEqual([]);
  await check();
});
test("long reviewed resource evidence wraps without overflowing the narrow dialog", async ({
  page,
}) => {
  const { f, check } = await start(page, "STAFF", 320);
  const long = "Synthetic checked resources ".repeat(12) + "Evidence".repeat(32);
  await page.getByLabel("People and equipment review", { exact: true }).fill(long);
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toContainText(long);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  expect(f.writes).toEqual([]);
  await check();
});

test("long populated staff names leave mobile booking labels readable", async ({
  page,
}) => {
  const { f, check } = await start(page, "STAFF", 320);
  f.booking.assignedStaff = {
    id: f.booking.assignedStaff!.id,
    firstName: "Synthetic",
    lastName: "MECHANICAL_TECHNICIAN",
  };
  await page.getByRole("button", { name: "Refresh booking", exact: true }).click();
  await expect(
    page.getByText("Synthetic MECHANICAL_TECHNICIAN", { exact: true }),
  ).toBeVisible();
  for (const label of await page
    .locator(".workforce-booking-detail > .card > .totals dt")
    .all())
    expect(
      await label.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThan(32);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-detail-long-name-320.png"),
  });
  expect(f.writes).toEqual([]);
  await check();
});
