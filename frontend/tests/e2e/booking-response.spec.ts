import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
// Test-runner-only import: exercise the actual HTML renderer, never a browser import.
import {
  bookingActionPage,
  bookingActionSuccess,
  bookingActionError,
  bookingPageCsp,
  type BookingActionSummary,
} from "../../../backend/src/modules/service-operations/booking-action-page";

const token = "synthetic-purpose-bound-token";
const endpoint = "/api/v1/public/booking-response";
const fixture = (): BookingActionSummary => ({
  scheduledAt: new Date("2026-10-14T09:30:00Z"),
  status: "CONFIRMED",
  attendanceConfirmedAt: null,
  service: { name: "Vehicle diagnostics" },
  branch: {
    name: "Port Harcourt workshop",
    address: "133 Stadium Road, beside Kilimanjaro",
    city: "Port Harcourt",
    state: "Rivers State",
  },
});

async function setup(page: Page, booking = fixture(), responseStatus = 200) {
  const writes: string[] = [];
  const consoles: string[] = [];
  const errors: string[] = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) consoles.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/v1/public/booking-response**", async (route) => {
    const request = route.request();
    const post = request.method() === "POST";
    let html = bookingActionPage(booking, token);
    if (post) {
      const body = new URLSearchParams(request.postData() ?? "");
      expect(body.get("token")).toBe(token);
      expect(request.headers()["origin"]).toBe("http://localhost:3000");
      expect(request.headers()["referer"]).toBe("http://localhost:3000/");
      const action = body.get("action");
      expect(["CONFIRM", "CANCEL"]).toContain(action);
      writes.push(action!);
      html = bookingActionSuccess(booking, action === "CANCEL" ? "CANCEL" : "CONFIRM");
    }
    if (responseStatus !== 200) html = bookingActionError(responseStatus, post);
    await route.fulfill({
      status: responseStatus,
      contentType: "text/html; charset=utf-8",
      headers: {
        "content-security-policy": bookingPageCsp,
        "cache-control": "no-store",
        "referrer-policy": "strict-origin",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
      body: html,
    });
  });
  return { writes, consoles, errors };
}

test("read-only reminder, explicit attendance, loaded Quicksand, responsive layout and accessible cancellation review", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${endpoint}?token=${token}`);
  await expect(page).toHaveTitle("Let us know you’re coming | Allied AutoTech");
  await expect(
    page.getByRole("heading", { name: "Let us know you’re coming" }),
  ).toBeVisible();
  await expect(page.getByText("10:30", { exact: false })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('500 16px "Quicksand"'))).toBe(
    true,
  );
  expect(
    await page.evaluate(() =>
      [...document.fonts].some((f) => f.family === "Quicksand" && f.status === "loaded"),
    ),
  ).toBe(true);
  expect(state.writes).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Yes, cancel appointment" }),
  ).not.toBeVisible();
  for (const width of [320, 360, 375, 390, 414, 768, 844, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-reminder-1440.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Cancel this appointment", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review cancellation" })).toBeVisible();
  expect(state.writes).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-booking-cancellation-390.png"),
    fullPage: true,
  });
  await page.getByText("Cancel this appointment", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm attendance" }).click();
  await expect(page.getByRole("heading", { name: "Attendance confirmed" })).toBeVisible();
  expect(state.writes).toEqual(["CONFIRM"]);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.consoles).toEqual([]);
});

test("cancellation needs an explicit review action and gives honest refund wording", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(`${endpoint}?token=${token}`);
  await page.getByText("Cancel this appointment", { exact: true }).click();
  expect(state.writes).toEqual([]);
  await page.getByRole("button", { name: "Yes, cancel appointment" }).click();
  await expect(
    page.getByRole("heading", { name: "Appointment cancelled" }),
  ).toBeVisible();
  await expect(page.getByText("Any refund", { exact: false })).toBeVisible();
  expect(state.writes).toEqual(["CANCEL"]);
  expect(state.errors).toEqual([]);
  expect(state.consoles).toEqual([]);
});

for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW", "EXPIRED"] as const)
  test(`${status} is read-only`, async ({ page }) => {
    const state = await setup(page, { ...fixture(), status });
    await page.goto(`${endpoint}?token=${token}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "View bookings in your account" }),
    ).toHaveAttribute("href", "/dashboard/bookings");
    expect(state.writes).toEqual([]);
  });

test("already confirmed attendance and escaped service names", async ({ page }) => {
  await setup(page, {
    ...fixture(),
    attendanceConfirmedAt: new Date(),
    service: { name: '<script>alert("unsafe")</script>' },
  });
  await page.goto(`${endpoint}?token=${token}`);
  await expect(page.getByRole("heading", { name: "We’re expecting you" })).toBeVisible();
  await expect(page.locator("script")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm attendance" })).toHaveCount(0);
});

test("invalid links offer private account recovery with no token in outgoing links", async ({
  page,
}) => {
  await setup(page, fixture(), 409);
  await page.goto(`${endpoint}?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "This appointment link needs attention" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Check my bookings" })).toHaveAttribute(
    "href",
    "/dashboard/bookings",
  );
  await expect(page.locator("form")).toHaveCount(0);
  expect(
    await page
      .locator("a")
      .evaluateAll((links) =>
        links.every((link) => !(link.getAttribute("href") ?? "").includes("token=")),
      ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("uncertain POST result directs account review before another action", async ({
  page,
}) => {
  await page.route("**/api/v1/public/booking-response**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "text/html",
      headers: { "content-security-policy": bookingPageCsp },
      body: bookingActionError(500, true),
    }),
  );
  await page.goto(endpoint);
  await expect(
    page.getByText(
      "Check your booking in your account before submitting another action.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});
