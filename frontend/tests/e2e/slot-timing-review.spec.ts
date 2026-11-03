import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { workSlotsFixture } from "../fixtures/work-slots";
import { verifyConsole } from "../fixtures/preview-console";
import { bookingRuntimeCapabilities } from "../fixtures/booking-runtime-capabilities";

test.beforeEach(async ({ request }) => {
  await bookingRuntimeCapabilities(request);
});

for (const role of ["ADMIN", "STAFF"])
  for (const width of [320, 1440])
    test(`${role} reviews a stale slot against current service estimates at ${width}px`, async ({
      page,
    }) => {
      const { state } = await workSlotsFixture(page, role),
        row = state.records[0];
      state.records = [row];
      row.timingReviewRequired = true;
      row.service = {
        ...row.service,
        version: 7,
        durationMinutes: 45,
        preparationMinutes: 10,
        cleanupMinutes: 0,
      };
      const errors: string[] = [],
        warnings: string[] = [],
        external: string[] = [];
      page.on("request", (request) => {
        if (
          /^https?:/.test(request.url()) &&
          !["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)
        )
          external.push(request.url());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
        if (message.type() === "warning") warnings.push(message.text());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin/booking-slots");
      await expect(page).toHaveURL(/\/admin\/booking-slots$/);
      await expect(page).toHaveTitle(/Allied/i);
      await expect(
        page.getByText("Timing review required", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Close slot", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Review and reopen", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("45 minutes");
      await expect(dialog).toContainText("10 minutes");
      await expect(dialog).toContainText("0 minutes");
      expect(state.writes).toEqual([]);
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "ADMIN")
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-slot-timing-${width}.png`),
        });
      await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
      await expect(
        page.getByText("Slot change recorded. Review the refreshed availability.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(state.writes).toHaveLength(1);
      expect(state.writes[0].body).toEqual({
        expectedVersion: 1,
        status: "OPEN",
        expectedServiceVersion: 7,
      });
      await expect(page.getByText("Timing review required", { exact: true })).toHaveCount(
        0,
      );
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Close slot", exact: true }),
      ).toBeVisible();
      expect(state.writes).toHaveLength(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(external).toEqual([]);
      await verifyConsole(page, errors, warnings);
    });
test("a service change after reopening review rejects without adopting a different estimate", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page);
  state.records = [state.records[0]];
  const row = state.records[0];
  row.timingReviewRequired = true;
  await page.goto("/admin/booking-slots");
  await page.getByRole("button", { name: "Review and reopen", exact: true }).click();
  const reviewed = row.service.version;
  row.service.version++;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.expectedServiceVersion).toBe(reviewed);
  expect(row.timingReviewRequired).toBe(true);
});

test("older slot responses keep the existing reopen request shape during a coordinated rollout", async ({
  page,
}) => {
  const { state } = await workSlotsFixture(page);
  state.records = [state.records[2]];
  await page.route("**/api/v1/staff/booking-slots**", (route) => {
    if (
      route.request().method() !== "GET" ||
      new URL(route.request().url()).pathname !== "/api/v1/staff/booking-slots"
    )
      return route.fallback();
    const { timingReviewRequired: _notPublished, ...legacy } = state.records[0];
    void _notPublished;
    return route.fulfill({
      json: {
        success: true,
        data: { items: [legacy] },
        message: "Synthetic older slot API",
        meta: { requestId: "legacy-slot-fixture" },
      },
    });
  });
  await page.goto("/admin/booking-slots");
  await page.getByRole("button", { name: "Open slot", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(
    page.getByText("Slot change recorded. Review the refreshed availability.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({ expectedVersion: 1, status: "OPEN" });
});
