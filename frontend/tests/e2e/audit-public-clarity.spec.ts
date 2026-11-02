import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ordersFixture } from "../fixtures/customer-orders";

for (const width of [320, 390, 1440])
  test(`service handoff, contact and combined public search at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes.push(request.url());
    });
    const categories = await (
      await page.request.get("/api/v1/public/services/categories?limit=50")
    ).json();
    const group = categories.data.items.find((row: { name: string }) =>
      /AC Maintenance/.test(row.name),
    );
    await page.goto(`/services?categoryId=${group.id}`);
    const visit = page.getByRole("link", {
      name: "Ask about a workshop visit",
      exact: true,
    });
    await expect(visit).toHaveAttribute(
      "href",
      `/contact?serviceGroup=${group.id}#enquiry`,
    );
    await visit.click();
    await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
      /Service request/,
    );
    await expect(page.locator("main")).toContainText(group.name);
    await expect(page.locator("main")).not.toContainText(
      "Find your way to Allied AutoTech",
    );
    await page.goto("/search");
    await page.getByLabel("Search for", { exact: true }).fill("diagnostics");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Results for “diagnostics”" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Services search results" })
        .getByRole("link", { name: "Comprehensive Vehicle Diagnostics", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Help search results" })).toBeVisible();
    await page.getByLabel("Search in", { exact: true }).selectOption("help");
    await page.getByLabel("Search for", { exact: true }).fill("inspect");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Help search results" }).getByRole("link", {
        name: "Can I inspect a vehicle before buying?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Services search results" }),
    ).toHaveCount(0);
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
    await page.screenshot({ path: info.outputPath(`help-search-${width}.png`) });
    expect(writes).toEqual([]);
  });
test("empty orders explains the enabled enquiry action without promising checkout", async ({
  page,
}) => {
  const f = await ordersFixture(page);
  f.mode = "empty";
  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Online checkout is not available");
  await expect(page.locator("main")).not.toContainText("review your order at checkout");
  expect(f.writes).toEqual([]);
});

for (const width of [320, 1440])
  test(`progressive vehicle filters retain exact values, invalid-field recovery and search at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/vehicles?search=BMW&sort=price_asc");
    const trigger = page.getByRole("button", { name: /^Filters/ });
    if (width < 1024) await trigger.click();
    const panel = page.locator("#vehicle-filter-panel");
    const years = panel.getByText("Year and mileage", { exact: true });
    const from = page.getByLabel("Year from", { exact: true }),
      to = page.getByLabel("Year to", { exact: true });
    await expect(from).not.toBeVisible();
    await years.click();
    await from.fill("2024");
    await to.fill("2018");
    await years.click();
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(to).toBeFocused();
    await expect(to).toHaveAttribute("aria-invalid", "true");
    await from.fill("2018");
    await to.fill("2024");
    await panel.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("maxYear")).toBe("2024");
    expect(new URL(page.url()).searchParams.get("search")).toBe("BMW");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("price_asc");
    await page.reload();
    if (width < 1024) await trigger.click();
    await expect(from).toBeVisible();
    await expect(from).toHaveValue("2018");
    await expect(to).toHaveValue("2024");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });

for (const width of [320, 1440])
  test(`public vehicle retains the known fault before enquiry with optional description at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.request.get("/api/v1/public/vehicles/discovery?limit=12");
    const { data } = await response.json();
    const listing = data.items[0];
    expect(listing?.id).toBeTruthy();
    await page.goto(`/vehicles/${listing.id}`);
    await expect(
      page.getByText(
        "AC not working. Owner reports a leak. Diagnosis and repair required.",
        { exact: true },
      ),
    ).toBeVisible();
    const fault = page.getByText("Known issues reported by owner", { exact: true });
    const enquiry = page.getByRole("link", { name: "Send an enquiry", exact: true });
    expect((await fault.boundingBox())!.y).toBeLessThan((await enquiry.boundingBox())!.y);
    const description = page.locator(".vd-description");
    await expect(description).not.toHaveAttribute("open", "");
    await description.getByText("About this vehicle", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(description).toHaveAttribute("open", "");
    await expect(description).toContainText("air conditioning is currently not working");
    await expect(page.locator("main")).not.toContainText("Published listing");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
