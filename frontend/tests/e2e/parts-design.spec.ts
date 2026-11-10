import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  partsDesignFixture,
  partsDesignCategory,
  partsDesignChild,
  partsDesignId,
} from "../fixtures/parts-design";

test.skip(
  !process.env.CAPABILITY_TEST_CONTROL_ORIGIN,
  "Requires isolated production-build Parts records",
);
test.afterEach(async ({ request }) => {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (!origin) return;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Parts cleanup requires loopback");
  expect(
    (
      await request.post(`${origin}/__capabilities`, {
        data: { mode: "full", fail: false },
      })
    ).ok(),
  ).toBe(true);
});

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
}
async function readableCardAction(page: Page) {
  const action = page.locator(".shop-product-card .product-detail-link").first();
  await expect(action).toHaveText("View product");
  const colors = await action.evaluate((element) => ({
    text: getComputedStyle(element).color,
    fill: getComputedStyle(element).backgroundColor,
    card: getComputedStyle(element.closest("article")!).backgroundColor,
  }));
  const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number);
  const fill = channels(colors.fill),
    card = channels(colors.card);
  const alpha = fill[3] ?? 1;
  const background = fill
    .slice(0, 3)
    .map((value, index) => value * alpha + card[index] * (1 - alpha));
  const luminance = (values: number[]) => {
    const linear = values.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const text = luminance(channels(colors.text)),
    surface = luminance(background);
  expect(
    (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05),
  ).toBeGreaterThanOrEqual(4.5);
}
async function chooseCategory(page: Page, subcategory = false) {
  await page
    .locator(
      subcategory
        ? ".product-subcategory .product-category-trigger"
        : ".product-category:not(.product-subcategory) .product-category-trigger",
    )
    .click();
  await page
    .getByRole("option", {
      name: subcategory ? "Synthetic empty subcategory" : "Synthetic parts category",
      exact: true,
    })
    .click();
}

for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test(`Parts search, filters, detail and return at ${width}x${height}`, async ({
    page,
    request,
  }, info) => {
    const state = await partsDesignFixture(request, page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/parts?search=stitch-fixture");
    expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
    await expect(page.locator("main h1")).toHaveText(
      "Parts, oils & automotive essentials",
    );
    await expect(page.locator(".shop-product-card")).toHaveCount(4);
    if (width <= 430)
      await expect(
        page.getByRole("searchbox", { name: "Search products", exact: true }),
      ).toBeInViewport({ ratio: 1 });
    await chooseCategory(page);
    await expect(page).toHaveURL(new RegExp(`categoryId=${partsDesignCategory}`));
    await expect(page.locator(".product-subcategory")).toBeVisible();
    await page.getByLabel("Sort by", { exact: true }).selectOption("price_asc");
    await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("price_asc");
    const filters = page.locator("#product-filter-panel");
    if (width < 1024) await page.locator(".product-filter-trigger").click();
    await expect(filters).toBeVisible();
    await filters.getByLabel("Availability", { exact: true }).selectOption("in_stock");
    await filters.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page.locator(".shop-product-card")).toHaveCount(2);
    const query = new URL(page.url()).searchParams.toString();
    expect(new URL(page.url()).searchParams.get("availability")).toBe("in_stock");
    await noOverflow(page);
    await readableCardAction(page);
    if ([1440, 390].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath(`parts-filtered-${width}.png`) });
    }
    await page
      .getByRole("link")
      .filter({
        has: page.getByRole("heading", {
          name: "Synthetic stitch-fixture part 1",
          exact: true,
        }),
      })
      .click();
    await expect(page.locator("main h1")).toHaveText("Synthetic stitch-fixture part 1");
    await expect(
      page.getByRole("link", { name: "Send an enquiry", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to cart", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".product-timing")).toContainText("3–7 calendar days");
    await noOverflow(page);
    await page.getByRole("button", { name: "View photos", exact: true }).click();
    const lightbox = page.getByRole("dialog", { name: "Product photos", exact: true });
    await expect(lightbox).toBeVisible();
    await lightbox.getByRole("button", { name: "Close photos", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(lightbox.getByText("Photo 2 of 2", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "View photos", exact: true }),
    ).toBeFocused();
    if ([1440, 390].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({ path: info.outputPath(`product-${width}.png`) });
    }
    await page.goBack();
    await expect(
      page.getByRole("searchbox", { name: "Search products", exact: true }),
    ).toHaveValue("stitch-fixture");
    expect(new URL(page.url()).searchParams.toString()).toBe(query);
    await expect(page.locator(".shop-product-card")).toHaveCount(2);
    await page.reload();
    await expect(page.locator(".shop-product-card")).toHaveCount(2);
    await expect(page.getByLabel("Sort by", { exact: true })).toHaveValue("price_asc");
    expect(new URL(page.url()).searchParams.toString()).toBe(query);
    expect(errors).toEqual([]);
    expect(state.unexpectedWrites).toEqual([]);
  });
}

test("Parts pagination focuses the visible results and preserves search", async ({
  page,
  request,
}) => {
  const state = await partsDesignFixture(request, page);
  state.paged = true;
  await page.goto("/parts");
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("stitch-fixture");
  await expect(page.locator(".shop-product-card")).toHaveCount(2);
  const pages = page.getByRole("navigation", { name: "Shop pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Explore automotive products", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".shop-product-card").first()).toContainText("part 3");
  await expect(page).toHaveURL(/search=stitch-fixture/);
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".shop-product-card").first()).toContainText("part 1");
  expect(state.unexpectedWrites).toEqual([]);
});

test("Parts loading, empty and failed reads remain distinct and recover the query", async ({
  page,
  request,
}) => {
  const state = await partsDesignFixture(request, page);
  await page.goto("/parts");
  state.delay = 500;
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("stitch-fixture");
  await expect(page.locator("#product-results")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".shop-product-card")).toHaveCount(4);
  state.delay = 0;
  for (const status of [503, 429]) {
    state.status = status;
    await page
      .getByLabel("Sort by", { exact: true })
      .selectOption(status === 503 ? "price_asc" : "price_desc");
    await expect(
      page.getByRole("heading", { name: "Products could not be loaded.", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No matching products", exact: true }),
    ).toHaveCount(0);
    state.status = 200;
    await page.getByRole("button", { name: "Retry products", exact: true }).click();
    await expect(page.locator(".shop-product-card")).toHaveCount(4);
  }
  state.networkFailure = true;
  await page.getByLabel("Sort by", { exact: true }).selectOption("name");
  await expect(
    page.getByRole("heading", { name: "Products could not be loaded.", exact: true }),
  ).toBeVisible();
  state.networkFailure = false;
  await page.getByRole("button", { name: "Retry products", exact: true }).click();
  await expect(page.locator(".shop-product-card")).toHaveCount(4);
  state.empty = true;
  await page.getByLabel("Sort by", { exact: true }).selectOption("newest");
  await expect(
    page.getByRole("heading", { name: "No matching products", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search products", exact: true }),
  ).toHaveValue("stitch-fixture");
  expect(state.unexpectedWrites).toEqual([]);
});

test("Parts preserve zero prices, missing photos and long facts with doubled text", async ({
  page,
  request,
}) => {
  const state = await partsDesignFixture(request, page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/*", (r) =>
    r.request().resourceType() === "image" ? r.abort() : r.fallback(),
  );
  await page.goto("/parts");
  state.records = [
    {
      ...state.records[0],
      name: "Synthetic stitch-fixture " + "LongProductName".repeat(12),
      priceKobo: "0",
      manufacturerPartNumber: "LONG-PART-NUMBER-".repeat(12),
      images: [],
    },
  ];
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("stitch-fixture");
  await expect(page.locator(".shop-product-card")).toHaveCount(1);
  await expect(page.locator(".shop-product-card .product-copy > strong")).toHaveText(
    "₦0",
  );
  await expect(
    page.locator(".shop-product-card").getByText("Image unavailable", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const sizes = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main h1,main h2,main h3,main p,main a,main button,main label",
      ),
    ).map((el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
    for (const [el, size] of sizes) {
      el.style.fontSize = `${size * 2}px`;
      el.style.lineHeight = "1.5";
    }
  });
  await noOverflow(page);
  expect(state.unexpectedWrites).toEqual([]);
});

test("Parts category and unavailable vehicle choices keep a truthful help route", async ({
  page,
  request,
}) => {
  const state = await partsDesignFixture(request, page);
  await page.goto(`/parts?categoryId=${partsDesignCategory}`);
  await expect(page.locator(".product-subcategory")).toBeVisible();
  await chooseCategory(page, true);
  await expect(page).toHaveURL(new RegExp(`categoryId=${partsDesignChild}`));
  await expect(
    page.getByRole("heading", { name: "No products in this category", exact: true }),
  ).toBeVisible();
  await page.goto("/parts?search=stitch-fixture");
  await page.locator(".parts-intent label").filter({ hasText: "By vehicle" }).click();
  await expect(page.locator(".parts-finder-unavailable")).toContainText(
    "Vehicle choices are not available",
  );
  const help = page
    .locator(".parts-finder-unavailable")
    .getByRole("link", { name: "Ask our team to check", exact: true });
  expect(await help.getAttribute("href")).toContain("/contact?parts=1");
  expect(await help.getAttribute("href")).toContain("part_search=stitch-fixture");
  expect(state.unexpectedWrites).toEqual([]);
});

test.describe("Parts native gallery", () => {
  test.use({ hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  test("photo controls update in place on a narrow phone", async ({ page, request }) => {
    const state = await partsDesignFixture(request, page);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/parts/${partsDesignId}`);
    const controls = page.locator(".pd-gallery > .pd-gallery-controls");
    await controls.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    const next = await controls
      .getByRole("button", { name: "Next photo", exact: true })
      .boundingBox();
    await page.touchscreen.tap(next!.x + next!.width / 2, next!.y + next!.height / 2);
    await expect(controls.getByText("Photo 2 of 2", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      for (let frame = 0; frame < 3; frame++)
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    expect(await page.evaluate(() => scrollY)).toBe(before);
    const previous = await controls
      .getByRole("button", { name: "Previous photo", exact: true })
      .boundingBox();
    await page.touchscreen.tap(
      previous!.x + previous!.width / 2,
      previous!.y + previous!.height / 2,
    );
    await expect(controls.getByText("Photo 1 of 2", { exact: true })).toBeVisible();
    await noOverflow(page);
    expect(state.unexpectedWrites).toEqual([]);
  });
});
