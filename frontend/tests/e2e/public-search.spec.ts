import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";

for (const width of [320, 390, 768, 1060, 1440]) {
  test(`public search entry and form remain reachable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services");
    const entry = page.getByRole("banner").getByRole("link", {
      name: "Search services, parts, vehicles and help",
      exact: true,
    });
    await expect(entry).toBeVisible();
    const box = (await entry.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(
      await entry.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
        );
      }),
    ).toBe(true);
    await entry.focus();
    await entry.press("Enter");
    await expect(page).toHaveURL(/\/search$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "What are you looking for?" }),
    ).toBeVisible();
    await expect(page.getByLabel("Search in", { exact: true })).toBeVisible();
    await page.getByLabel("Search for", { exact: true }).focus();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    if ([390, 1440].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`search-${width}.png`),
        caret: "initial",
      });
    }
  });
}

for (const [scope, phrase, heading] of [
  ["services", "diagnostics", "Comprehensive Vehicle Diagnostics"],
  ["parts", "Engine Oil Filter", "Engine Oil Filter"],
  ["vehicles", "BMW", /2007 BMW 120i/],
] as const) {
  test(`searching ${scope} opens real catalogue results and preserves the phrase`, async ({
    page,
  }) => {
    await page.goto("/search");
    await page.getByLabel("Search in", { exact: true }).selectOption(scope);
    await page.getByLabel("Search for", { exact: true }).fill(phrase);
    await page.getByLabel("Search for", { exact: true }).press("Enter");
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${scope}`);
    expect(new URL(page.url()).searchParams.get("search")).toBe(phrase);
    await expect(
      page
        .locator("main")
        .getByRole("heading", { name: heading, exact: typeof heading === "string" }),
    ).toBeVisible();
  });
}

test("a catalogue search works with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/search");
    await page.getByLabel("Search in", { exact: true }).selectOption("parts");
    await page.getByLabel("Search for", { exact: true }).fill("Engine Oil Filter");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/parts");
    expect(new URL(page.url()).searchParams.get("search")).toBe("Engine Oil Filter");
    await expect(
      page
        .locator("main")
        .getByRole("heading", { name: "Engine Oil Filter", exact: true }),
    ).toBeVisible();
    await page.goto("/search?scope=all&search=diagnostics");
    await expect(
      page.getByRole("region", { name: "Services search results" }),
    ).toContainText("Comprehensive Vehicle Diagnostics");
  } finally {
    await context.close();
  }
});

test("the primary search action stays usable on a short phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto("/search");
  await page.getByLabel("Search for", { exact: true }).fill("diagnostics");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: "Comprehensive Vehicle Diagnostics", exact: true }),
  ).toBeVisible();
});

test("malformed destinations and overlong searches remain editable on the search page", async ({
  page,
}) => {
  await page.goto("/search?scope=https%3A%2F%2Felsewhere.test&search=diagnostics");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Choose where to search",
  );
  expect(new URL(page.url()).pathname).toBe("/search");
  await expect(page.getByLabel("Search for", { exact: true })).toHaveValue("diagnostics");
  const query = "x".repeat(101);
  await page.goto(`/search?scope=vehicles&search=${query}`);
  await expect(page.locator("main").getByRole("alert")).toContainText("100 characters");
  await expect(page.getByLabel("Search for", { exact: true })).toHaveValue(query);
  await page.getByLabel("Search for", { exact: true }).fill("BMW");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/vehicles");
});

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} dashboard search has visible branded focus and keyboard recovery`, async ({
    page,
  }, info) => {
    await fixture(page, role);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    const search = page.getByRole("searchbox", {
      name: "Search dashboard pages",
      exact: true,
    });
    await expect(search).toBeVisible();
    await search.focus();
    await expect(page.locator(".dashboard-search")).toHaveCSS("outline-width", "3px");
    await expect(page.locator(".dashboard-search")).toHaveCSS(
      "outline-color",
      "rgb(215, 25, 32)",
    );
    await search.fill("booking");
    await expect(page.locator(".dashboard-search-results")).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`dashboard-search-${role}.png`),
      caret: "initial",
    });
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(page.locator(".dashboard-search-results")).toHaveCount(0);
    await expect(search).toBeFocused();
    if (role !== "CUSTOMER") {
      const collapse = page.getByRole("button", {
        name: "Collapse sidebar",
        exact: true,
      });
      await collapse.click();
      await search.focus();
      await expect(page.locator(".dashboard-search")).toHaveCSS("outline-width", "3px");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.emulateMedia({ forcedColors: "active" });
    await search.focus();
    await expect(page.locator(".dashboard-search")).toHaveCSS("outline-style", "solid");
    await expect(page.locator(".dashboard-search")).toHaveCSS("outline-width", "3px");
  });
}

test("combined search preserves the query through refresh and Back, and Escape returns to the previous page", async ({
  page,
}) => {
  await page.goto("/services");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Search services, parts, vehicles and help", exact: true })
    .click();
  const query = page.getByLabel("Search for", { exact: true });
  await query.fill("diagnostics");
  await query.press("Enter");
  await expect(
    page.getByRole("region", { name: "Services search results" }),
  ).toContainText("Comprehensive Vehicle Diagnostics");
  await page
    .getByRole("region", { name: "Services search results" })
    .getByRole("link", { name: "Comprehensive Vehicle Diagnostics", exact: true })
    .click();
  await expect(page).toHaveURL(/\/services\/[0-9a-f-]+$/);
  await page.goBack();
  await expect(query).toHaveValue("diagnostics");
  await page.reload();
  await expect(query).toHaveValue("diagnostics");
  await expect(
    page.getByRole("button", { name: "Close search", exact: true }),
  ).toBeEnabled();
  await query.press("Escape");
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("region", { name: "Services search results" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Close search", exact: true }),
  ).toBeEnabled();
  await query.press("Escape");
  await expect(page).toHaveURL(/\/services$/);
});
