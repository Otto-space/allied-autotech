import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  inspectionsFixture,
  inspectionRecord,
  inspectionId,
} from "../fixtures/customer-inspections";

const route = "/dashboard/inspections";
test("all six statuses filter on the server and preserve the status labels", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  const statuses = [
    "REQUESTED",
    "CONFIRMED",
    "COMPLETED",
    "RESCHEDULED",
    "CANCELLED",
    "NO_SHOW",
  ];
  state.records = statuses.map((status, i) => inspectionRecord(i + 1, status));
  await page.goto(route);
  for (const [i, status] of statuses.entries()) {
    await page.getByLabel("Inspection status", { exact: true }).selectOption(status);
    await expect(page.locator(".inspection-row")).toHaveCount(1);
    await expect(page.locator(".inspection-status")).toHaveText(
      ["Requested", "Confirmed", "Completed", "Rescheduled", "Cancelled", "No show"][i],
    );
    expect(state.reads.at(-1)?.searchParams.get("status")).toBe(status);
  }
  expect(state.writes).toEqual([]);
});
test("appointment details and report use recorded values without inventing actions", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  await page.goto(route);
  await expect(page.locator(".inspection-row").first()).toContainText(
    "Awaiting confirmation",
  );
  await expect(page.locator(".inspection-row").nth(2)).toContainText("Last scheduled");
  const trigger = page.getByRole("button", {
    name: "View details for 2020 Honda Accord",
  });
  await trigger.click();
  const detail = page.getByRole("region", { name: "Details for 2020 Honda Accord" });
  await expect(detail).toContainText(
    "Engine and transmission checked. Front tyres require attention.",
  );
  await expect(detail).toContainText("52,400 km");
  await expect(detail).toContainText("82/100");
  await expect(detail).toContainText("Replace front tyres");
  await expect(detail).toContainText("13:30");
  await expect(detail).toContainText("Lagos time");
  await expect(
    detail.getByRole("link", { name: "Contact customer care" }),
  ).toHaveAttribute("href", "/dashboard/support");
  await page.getByRole("button", { name: "Hide details for 2020 Honda Accord" }).click();
  await expect(detail).toBeHidden();
  await page
    .getByRole("button", { name: "View details for 2023 Toyota Highlander" })
    .click();
  await expect(
    page.getByRole("region", { name: "Details for 2023 Toyota Highlander" }),
  ).toContainText("Customer requested another date.");
  await expect(
    page.getByRole("button", { name: /cancel inspection|reschedule|download report/i }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("report presence does not promote server status and absent values stay honest", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  state.records = [
    {
      ...inspectionRecord(1),
      conditionReport: {
        ...inspectionRecord(3, "COMPLETED").conditionReport!,
        odometerKm: 0,
        conditionScore: 0,
      },
    },
  ];
  await page.goto(route);
  await expect(page.locator(".inspection-status")).toHaveText("Requested");
  await page.getByRole("button", { name: /View details for/ }).click();
  await expect(page.locator(".inspection-report")).toContainText("0 km");
  await expect(page.locator(".inspection-report")).toContainText("0/100");
});
test("long record titles notes and findings remain text and fit mobile", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  state.records = [inspectionRecord(1)];
  state.records[0].vehicleListing.title = "ExtendedVehicleName".repeat(20);
  state.records[0].notes =
    "<script>alert('unsafe')</script>\n" + "Long inspection note ".repeat(80);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(route);
  await page.getByRole("button", { name: /View details for/ }).click();
  await expect(page.locator(".inspection-preserve")).toContainText("<script>");
  await expect(page.getByText("No inspection report available.")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("cursor pagination reload and browser history preserve filters", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  await page.goto(route);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".inspection-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".inspection-row")).toHaveCount(1);
  await expect(page.locator(".inspection-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  await page.getByLabel("Inspection status", { exact: true }).selectOption("COMPLETED");
  await expect(page.locator(".inspection-row")).toHaveCount(1);
  await page.goBack();
  await expect(page.getByLabel("Inspection status", { exact: true })).toHaveValue("");
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  await page.goForward();
  await expect(page.getByLabel("Inspection status", { exact: true })).toHaveValue(
    "COMPLETED",
  );
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
});
test("direct cursor links recover and invalid query fields never reach the API", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  await page.goto(`${route}?cursor=${inspectionId(4)}&customerId=${inspectionId(999)}`);
  await expect(page.locator(".inspection-pagination")).toContainText("Later page");
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  await page.goto(`${route}?status=ADMIN&limit=1000&cursor=invalid`);
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  expect(state.reads.at(-1)?.searchParams.get("limit")).toBe("20");
});
for (const mode of ["error", "malformed", "offline", "rate", "denied"])
  test(`${mode} hides private rows and supports recovery`, async ({ page }) => {
    const state = await inspectionsFixture(page);
    await page.goto(route);
    await expect(page.locator(".inspection-row")).toHaveCount(4);
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh inspections", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your inspections" }),
    ).toBeVisible();
    await expect(page.locator(".inspection-row")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry inspections", exact: true }).click();
    await expect(page.locator(".inspection-row")).toHaveCount(4);
  });
test("background failures preserve clearly stale rows but disable forward paging", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  await page.goto(route);
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".inspection-warning")).toContainText(
    "These inspections may be out of date.",
  );
  await expect(page.locator(".inspection-row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry inspections", exact: true }).click();
  await expect(page.locator(".inspection-warning")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
});
test("loading and all empty states have useful recovery", async ({ page }) => {
  const state = await inspectionsFixture(page);
  state.mode = "hold";
  await page.goto(route);
  await expect(page.locator(".inspection-skeleton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect.poll(() => !!state.held).toBe(true);
  state.mode = "empty";
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No inspection requests yet" }),
  ).toBeVisible();
  await page.getByLabel("Inspection status", { exact: true }).selectOption("COMPLETED");
  await expect(
    page.getByRole("heading", { name: "No inspections with this status" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset inspection filters" }).click();
  await expect(page.getByLabel("Inspection status", { exact: true })).toBeFocused();
  await page.goto(`${route}?cursor=${inspectionId(4)}`);
  await expect(
    page.getByRole("heading", { name: "No inspections on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "No inspection requests yet" }),
  ).toBeVisible();
});
test("session changes discard open private reports and late responses", async ({
  page,
}) => {
  const state = await inspectionsFixture(page);
  await page.goto(route);
  await page.getByRole("button", { name: "View details for 2020 Honda Accord" }).click();
  state.mode = "hold";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.held?.();
  await expect(page.locator(".inspection-row")).toHaveCount(0);
  await expect(page.getByText("Replace front tyres", { exact: true })).toHaveCount(0);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} never reads customer inspections`, async ({ page }) => {
    const state = await inspectionsFixture(page, role);
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Vehicle inspections", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin$/);
    expect(state.reads).toEqual([]);
  });
test("short mobile keyboard disclosure and filter recovery remain usable", async ({
  page,
}) => {
  await inspectionsFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  const button = page.getByRole("button", { name: "View details for 2020 Honda Accord" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Details for 2020 Honda Accord" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.getByLabel("Inspection status", { exact: true }).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No inspections with this status" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset inspection filters" }).click();
  await expect(page.getByLabel("Inspection status", { exact: true })).toBeFocused();
});
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`inspection layout at ${width}px`, async ({ page }) => {
    await inspectionsFixture(page);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator(".inspection-row")).toHaveCount(4);
    await page
      .getByRole("button", { name: "View details for 2020 Honda Accord" })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('.inspection-breadcrumb [aria-current="page"]')).toHaveText(
      "Inspections",
    );
    expect(errors).toEqual([]);
    await expect(page).toHaveTitle("Vehicle inspections · Allied AutoTech");
  });
for (const width of [390, 768, 1280, 1440])
  test(`inspection accessibility at ${width}px`, async ({ page }) => {
    await inspectionsFixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(route);
    await page
      .getByRole("button", { name: "View details for 2020 Honda Accord" })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
