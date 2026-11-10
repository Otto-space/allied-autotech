import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { branch as testBranch } from "../fixtures/public-account-actions";
import {
  servicesDesignFixture,
  serviceDesignGroup,
  serviceDesignId,
} from "../fixtures/services-design";

test.skip(
  !process.env.CAPABILITY_TEST_CONTROL_ORIGIN,
  "Requires the isolated production-build Services fixture",
);

test.afterEach(async ({ request }) => {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (!origin) return;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Services cleanup requires the isolated loopback fixture");
  // Do not leak the restricted catalogue scenario into the next project's auth tests.
  const restored = await request.post(`${origin}/__capabilities`, {
    data: { mode: "full", fail: false },
  });
  expect(restored.ok()).toBe(true);
});

async function choosePricing(page: Page, name: string) {
  const radio = page.getByRole("radio", { name, exact: true });
  await page.locator(".services-pricing label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
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
  test(`Services discovery, detail and return at ${width}x${height}`, async ({
    page,
    request,
  }, info) => {
    const state = await servicesDesignFixture(request, page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/services");
    expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
    await expect(page.locator("main h1")).toHaveText(
      "Find the service your vehicle needs",
    );
    await expect(page.locator(".services-row").first()).toBeVisible();
    const cardActions = await page
      .locator(".services-row-actions")
      .evaluateAll((actions) =>
        actions.map((action) => {
          const price = action
            .querySelector(".services-row-price")!
            .getBoundingClientRect();
          const link = action
            .querySelector(".services-view-link")!
            .getBoundingClientRect();
          return {
            priceBottom: price.bottom,
            linkTop: link.top,
            linkHeight: link.height,
          };
        }),
      );
    for (const action of cardActions) {
      expect(action.linkTop).toBeGreaterThanOrEqual(action.priceBottom);
      expect(action.linkHeight).toBeGreaterThanOrEqual(44);
      expect(action.linkHeight).toBeLessThan(96);
    }
    if (width <= 430) {
      await expect(page.getByLabel("Search services", { exact: true })).toBeInViewport({
        ratio: 1,
      });
    }
    await page
      .getByRole("link", { name: "Browse services", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Search services", { exact: true })).toBeInViewport();
    await page
      .getByLabel("Service category", { exact: true })
      .selectOption(serviceDesignGroup);
    await expect(page.getByLabel("Service category", { exact: true })).toHaveValue(
      serviceDesignGroup,
    );
    const context = page.locator(".service-group-context");
    await expect(context).toBeVisible();
    expect((await context.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await page.locator(".catalogue-banner").boundingBox())!.y +
        (await page.locator(".catalogue-banner").boundingBox())!.height,
    );
    await page.getByLabel("Search services", { exact: true }).fill("wheel");
    await page
      .locator(".services-discovery-controls")
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove service search" }),
    ).toContainText("wheel");
    await page.getByLabel("Sort services", { exact: true }).selectOption("duration_asc");
    await expect(page.getByLabel("Sort services", { exact: true })).toHaveValue(
      "duration_asc",
    );
    await page
      .locator(".services-pricing label")
      .filter({ hasText: /^Fixed price$/ })
      .click();
    await expect(
      page.getByRole("radio", { name: "Fixed price", exact: true }),
    ).toBeChecked();
    await expect(page.locator(".services-row")).toHaveCount(2);
    const query = new URL(page.url()).searchParams.toString();
    expect(new URL(page.url()).searchParams.get("search")).toBe("wheel");
    expect(new URL(page.url()).searchParams.get("categoryId")).toBe(serviceDesignGroup);
    expect(new URL(page.url()).searchParams.get("sort")).toBe("duration_asc");
    expect(new URL(page.url()).searchParams.get("pricingType")).toBe("FIXED");
    await page
      .getByRole("link", { name: "View Synthetic wheel service 1", exact: true })
      .click();
    await expect(page.locator("main h1")).toHaveText("Synthetic wheel service 1");
    await page.getByRole("link", { name: "Send an enquiry", exact: true }).click();
    await expect(page.locator(".sd-form-title")).toBeFocused();
    await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Choose an appointment", exact: true }),
    ).toHaveCount(0);
    if ([1440, 390].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .include("footer")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`service-detail-${width}.png`),
        fullPage: true,
      });
    }
    await page.goBack();
    expect(new URL(page.url()).searchParams.toString()).toBe(query);
    await page.reload();
    await expect(page.getByLabel("Search services", { exact: true })).toHaveValue(
      "wheel",
    );
    await expect(page.getByLabel("Service category", { exact: true })).toHaveValue(
      serviceDesignGroup,
    );
    await expect(page.getByLabel("Sort services", { exact: true })).toHaveValue(
      "duration_asc",
    );
    await expect(
      page.getByRole("radio", { name: "Fixed price", exact: true }),
    ).toBeChecked();
    await expect(page.locator(".services-row")).toHaveCount(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    if ([1440, 390].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .include("footer")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`services-${width}.png`),
        fullPage: true,
      });
    }
    await page.goto("/services/request");
    await expect(
      page.getByRole("heading", { name: "Contact the workshop", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Describe your concern", exact: true }),
    ).toHaveAttribute("href", "/contact#enquiry");
    expect(state.writes).toEqual([]);
    expect(state.unexpectedWrites).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("Services pagination keeps its filters and reveals the focused results heading", async ({
  page,
  request,
}) => {
  const state = await servicesDesignFixture(request, page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/services");
  state.paged = true;
  await choosePricing(page, "Fixed price");
  await expect(page.locator(".services-row")).toHaveCount(1);
  const pages = page.getByRole("navigation", { name: "Service pages", exact: true });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pages).toContainText("Page 2");
  const heading = page.getByRole("heading", { name: "Find your service", exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page.locator(".services-row h3")).toHaveText("Synthetic wheel service 2");
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(pages).toContainText("Page 1");
  await expect(
    page.getByRole("radio", { name: "Fixed price", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".services-row h3")).toHaveText("Synthetic wheel service 1");
  expect(state.unexpectedWrites).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("Services distinguish loading, empty, failure, zero price and quotation states", async ({
  page,
  request,
}) => {
  const state = await servicesDesignFixture(request, page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/services");
  state.delay = 700;
  await choosePricing(page, "Fixed price");
  await expect(page.getByText("Loading services…", { exact: true })).toBeVisible();
  await expect(page.locator(".services-row")).toHaveCount(2);
  state.delay = 0;
  state.empty = true;
  await choosePricing(page, "Quotation required");
  await expect(
    page.getByRole("heading", { name: "No matching service options", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".services-row")).toHaveCount(0);
  state.empty = false;
  for (const failure of [503, 429, "network"] as const) {
    state.status = typeof failure === "number" ? failure : 200;
    state.networkFailure = failure === "network";
    await choosePricing(page, "Fixed price");
    await expect(
      page.getByRole("heading", { name: "Services are unavailable", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".services-row")).toHaveCount(0);
    state.status = 200;
    state.networkFailure = false;
    await page.getByRole("button", { name: "Retry services", exact: true }).click();
    await expect(page.locator(".services-row")).toHaveCount(2);
    await choosePricing(page, "All services");
    await expect(page.locator(".services-row")).toHaveCount(2);
  }
  state.records = [
    {
      ...state.records[0],
      priceKobo: "0",
      durationMinutes: null,
      name: "Synthetic zero-price service",
    },
    {
      ...state.records[1],
      pricingType: "QUOTE_REQUIRED",
      priceKobo: null,
      name: "Synthetic quotation service",
    },
  ];
  await choosePricing(page, "Fixed price");
  await expect(page.locator(".services-row-price strong")).toHaveText("₦0");
  await expect(page.locator(".services-row-copy .muted")).toHaveCount(0);
  await choosePricing(page, "Quotation required");
  await expect(page.locator(".services-row-price strong")).toHaveText(
    "Quotation required",
  );
  await expect(page.locator(".services-row-price")).not.toContainText("₦");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(state.writes).toEqual([]);
  expect(state.unexpectedWrites).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Service enquiry review and isolated receipt at ${width}px`, async ({
    page,
    request,
  }) => {
    const state = await servicesDesignFixture(request, page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/services/${serviceDesignId}`);
    await page.getByRole("link", { name: "Send an enquiry", exact: true }).click();
    await page
      .getByLabel("Your name", { exact: true })
      .fill("Synthetic Services Customer");
    await page.getByLabel("Email address", { exact: true }).fill("services@example.test");
    await page.getByLabel("Subject", { exact: true }).fill("Synthetic service question");
    await page
      .getByLabel("Your message", { exact: true })
      .fill("Please discuss this service for my synthetic vehicle.");
    // The existing contact picker automatically selects its sole branch.
    await expect(page.getByLabel("Handling branch", { exact: true })).toHaveText(
      testBranch.name,
    );
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    const review = page.getByRole("dialog");
    await expect(review).toContainText("Synthetic service question");
    await expect(review).toContainText("Synthetic wheel service 1");
    expect(await review.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    expect(state.writes).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(review).toHaveCount(0);
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      "Please discuss this service for my synthetic vehicle.",
    );
    await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
    await review.getByRole("button", { name: "Send enquiry", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Enquiry received", exact: true }),
    ).toBeFocused();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toMatchObject({
      serviceId: serviceDesignId,
      branchId: testBranch.id,
      name: "Synthetic Services Customer",
      email: "services@example.test",
      subject: "Synthetic service question",
      message: "Please discuss this service for my synthetic vehicle.",
    });
    expect(state.unexpectedWrites).toEqual([]);
  });
}

test("Services retain long facts and usable links when images fail and text doubles", async ({
  page,
  request,
}) => {
  const state = await servicesDesignFixture(request, page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/*", (route) =>
    route.request().resourceType() === "image" ? route.abort() : route.fallback(),
  );
  await page.goto("/services");
  state.records = [
    {
      ...state.records[0],
      name: "SyntheticServiceName".repeat(12),
      shortDescription: "A synthetic detailed service description. ".repeat(30),
      priceKobo: "9999999999999999",
      image: {
        id: "a9000000-0000-4000-8000-000000000071",
        url: "/api/v1/public/media/images/a9000000-0000-4000-8000-000000000071",
        width: 1600,
        height: 1000,
        altText: "Synthetic service photograph",
      },
    },
  ];
  await choosePricing(page, "Fixed price");
  await expect(page.locator(".services-row")).toHaveCount(1);
  await expect(page.locator(".services-row h3")).toHaveText(state.records[0].name);
  await expect(
    page.getByRole("img", { name: "Service image unavailable", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const text = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main h1,main h2,main h3,main p,main a,main button,main label > span",
      ),
    ).map((el) => [el, parseFloat(getComputedStyle(el).fontSize)] as const);
    for (const [el, size] of text) {
      el.style.fontSize = `${size * 2}px`;
      el.style.lineHeight = "1.5";
    }
  });
  for (const selector of [
    ".catalogue-banner",
    ".services-discovery-panel",
    ".services-results",
    ".service-groups",
    ".services-contact",
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await expect(page.locator(".services-view-link")).toHaveAttribute(
    "href",
    `/services/${serviceDesignId}`,
  );
  expect(state.writes).toEqual([]);
  expect(state.unexpectedWrites).toEqual([]);
});
