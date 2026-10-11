import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  purchasesFixture,
  purchaseRecord,
  purchaseId,
} from "../fixtures/customer-purchases";

import { transactionStatuses } from "@/lib/api/vehicle-schemas";
import { purchaseLabels } from "@/lib/customer-purchase-query";
const route = "/dashboard/vehicle-transactions";
test("all twelve server statuses and exact prices remain authoritative", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  state.records = transactionStatuses.map((status, i) => purchaseRecord(i + 1, status));
  await page.goto(route);
  for (const status of transactionStatuses) {
    await page.getByLabel("Purchase status", { exact: true }).selectOption(status);
    await expect(page.locator(".purchase-row")).toHaveCount(1);
    await expect(page.locator(".purchase-status")).toHaveText(purchaseLabels[status]);
    expect(state.reads.at(-1)?.searchParams.get("status")).toBe(status);
  }
  expect(state.writes).toEqual([]);
});
test("prices preserve precision null versus zero and never imply amount due", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  state.records = [
    purchaseRecord(1),
    { ...purchaseRecord(2), agreedPriceKobo: "0" },
    { ...purchaseRecord(3), agreedPriceKobo: "9007199254740993" },
  ];
  await page.goto(route);
  await expect(page.locator(".purchase-price").nth(0)).toHaveText(
    /Asking price.*24,500,000.00/,
  );
  await expect(page.locator(".purchase-price").nth(1)).toHaveText(/Agreed price.*0.00/);
  await expect(page.locator(".purchase-price").nth(2)).toHaveText(
    /Agreed price.*90,071,992,547,409.93/,
  );
  await expect(
    page.getByRole("button", { name: /pay now|reserve|cancel enquiry/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View progress for 2021 Toyota Camry" }),
  ).toHaveAttribute("href", `${route}/${purchaseId(1)}`);
  await page.getByRole("link", { name: "View progress for 2021 Toyota Camry" }).click();
  await expect(page).toHaveURL(new RegExp(`${purchaseId(1)}$`));
  await expect(
    page.getByRole("heading", { name: "Vehicle purchase progress", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("media uses actual safe primary image and missing or failed images recover", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  state.records[0].vehicleListing.vehicle.images.unshift({
    ...state.records[0].vehicleListing.vehicle.images[0],
    id: purchaseId(800),
    url: "https://untrusted.example/private.jpg",
    isPrimary: false,
  });
  state.records[1].vehicleListing.vehicle.images = [];
  state.records[2].vehicleListing.vehicle.images[0].url = "javascript:alert(1)";
  await page.route(`**/public/vehicles/images/${purchaseId(404)}`, (route) =>
    route.fulfill({ status: 404, body: "unavailable" }),
  );
  await page.goto(route);
  const img = page.locator(".purchase-row").first().locator("img");
  await expect(img).toHaveAttribute("src", new RegExp(purchaseId(401)));
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText("Image unavailable", { exact: true })).toHaveCount(3);
  expect(state.reads).toHaveLength(1);
});
test("long titles references and large exact prices fit320px as escaped text", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  state.records = [purchaseRecord(1)];
  state.records[0].vehicleListing.title =
    "<script>unsafe</script>" + "ExtendedVehicleName".repeat(12);
  state.records[0].transactionNumber = "REFERENCE".repeat(25);
  state.records[0].agreedPriceKobo = "900719925474099399";
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(route);
  await expect(page.locator(".purchase-title")).toContainText("<script>");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("cursor pagination reload and browser history preserve filters", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  await page.goto(route);
  await page.getByLabel("Rows per page").selectOption("10");
  await expect.poll(() => state.reads.at(-1)?.searchParams.get("limit")).toBe("10");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".purchase-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".purchase-row")).toHaveCount(1);
  await expect(page.locator(".purchase-pagination")).toContainText("Page 2");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  await page.getByLabel("Purchase status", { exact: true }).selectOption("RESERVED");
  await expect(page.locator(".purchase-row")).toHaveCount(1);
  await page.goBack();
  await expect(page.getByLabel("Purchase status", { exact: true })).toHaveValue("");
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  await page.goForward();
  await expect(page.getByLabel("Purchase status", { exact: true })).toHaveValue(
    "RESERVED",
  );
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
});
test("direct cursor links recover and invalid query fields never reach the API", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  await page.goto(`${route}?cursor=${purchaseId(4)}&customerId=${purchaseId(999)}`);
  await expect(page.locator(".purchase-pagination")).toContainText("Later page");
  expect(state.reads[0].searchParams.has("customerId")).toBe(false);
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  await page.goto(`${route}?status=ADMIN&limit=1000&cursor=invalid`);
  await expect(page.getByText(/Some invalid filters were ignored/)).toBeVisible();
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  expect(state.reads.at(-1)?.searchParams.get("limit")).toBe("20");
});
for (const mode of ["error", "malformed", "offline", "rate", "denied"])
  test(`${mode} hides private rows and supports recovery`, async ({ page }) => {
    const state = await purchasesFixture(page);
    await page.goto(route);
    await expect(page.locator(".purchase-row")).toHaveCount(4);
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh enquiries", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your enquiries" }),
    ).toBeVisible();
    await expect(page.locator(".purchase-row")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry enquiries", exact: true }).click();
    await expect(page.locator(".purchase-row")).toHaveCount(4);
  });
test("background failures preserve clearly stale rows but disable forward paging", async ({
  page,
}) => {
  const state = await purchasesFixture(page);
  await page.goto(route);
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".purchase-warning")).toContainText(
    "These enquiries may be out of date.",
  );
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry enquiries", exact: true }).click();
  await expect(page.locator(".purchase-warning")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
});
test("loading and all empty states have useful recovery", async ({ page }) => {
  const state = await purchasesFixture(page);
  state.mode = "hold";
  await page.goto(route);
  await expect(page.locator(".purchase-skeleton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect.poll(() => !!state.held).toBe(true);
  state.mode = "empty";
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No vehicle enquiries yet" }),
  ).toBeVisible();
  await page.getByLabel("Purchase status", { exact: true }).selectOption("COMPLETED");
  await expect(
    page.getByRole("heading", { name: "No enquiries with this status" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset purchase filters" }).click();
  await expect(page.getByLabel("Purchase status", { exact: true })).toBeFocused();
  await page.goto(`${route}?cursor=${purchaseId(4)}`);
  await expect(
    page.getByRole("heading", { name: "No enquiries on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: "No vehicle enquiries yet" }),
  ).toBeVisible();
});
test("session changes discard private records and late responses", async ({ page }) => {
  const state = await purchasesFixture(page);
  await page.goto(route);
  await expect(page.locator(".purchase-row")).toHaveCount(4);
  state.mode = "hold";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => !!state.held).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.held?.();
  await expect(page.locator(".purchase-row")).toHaveCount(0);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} never reads customer purchases`, async ({ page }) => {
    const state = await purchasesFixture(page, role);
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Vehicle enquiries & purchases", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin$/);
    expect(state.reads).toEqual([]);
  });
test("short mobile keyboard filter recovery and progress navigation remain usable", async ({
  page,
}) => {
  await purchasesFixture(page);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await page.getByLabel("Purchase status", { exact: true }).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No enquiries with this status" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset purchase filters" }).click();
  await expect(page.getByLabel("Purchase status", { exact: true })).toBeFocused();
  const progress = page.getByRole("link", {
    name: "View progress for 2021 Toyota Camry",
  });
  await progress.focus();
  await expect
    .poll(() =>
      progress.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight - 70;
      }),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(purchaseId(1) + "$"));
});
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`purchase layout at ${width}px`, async ({ page }) => {
    await purchasesFixture(page);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator(".purchase-row")).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('.purchase-breadcrumb [aria-current="page"]')).toHaveText(
      "Vehicle purchases",
    );
    expect(errors).toEqual([]);
    await expect(page).toHaveTitle("Vehicle enquiries & purchases · Allied AutoTech");
  });
for (const width of [390, 768, 1280, 1440])
  test(`purchase accessibility at ${width}px`, async ({ page }) => {
    await purchasesFixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(route);
    await expect(page.locator(".purchase-row")).toHaveCount(4);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
