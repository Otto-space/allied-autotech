import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";
import { demoModels, demoProducts } from "../fixtures/discovery-demo.mjs";

type Mode = "populated" | "empty" | "error" | "no-fitment";
let server: Server;
let state: { mode: Mode; delay: number; staleMakes: boolean; requests: URL[] };
const success = (data: unknown) => ({
  success: true,
  data,
  message: "Isolated fictional discovery fixture",
  meta: { requestId: "discovery-ui-fixture" },
});
test.beforeAll(async () => {
  await mkdir(path.join(os.tmpdir(), "allied-home-discovery-20261025"), {
    recursive: true,
  });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url ?? "/", "http://127.0.0.1:5021");
    if (req.method !== "GET" || state.mode === "error") {
      res.writeHead(503);
      res.end(JSON.stringify({ success: false, error: { code: "FIXTURE_UNAVAILABLE" } }));
    } else res.end(JSON.stringify(success(discoveryResponse(url, state.mode))));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(5021, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test.beforeEach(() => {
  state = { mode: "populated", delay: 0, staleMakes: false, requests: [] };
});
async function fixture(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push(url);
    if (request.method() !== "GET")
      throw new Error("This suite never submits an operational request.");
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (state.delay && url.pathname.endsWith("/discovery"))
      await new Promise((resolve) => setTimeout(resolve, state.delay));
    if (
      state.staleMakes &&
      url.pathname.endsWith("/fitment/makes") &&
      url.searchParams.get("search") === "Toy"
    )
      await new Promise((resolve) => setTimeout(resolve, 1200));
    if (state.mode === "error")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    return route
      .fulfill({ json: success(discoveryResponse(url, state.mode)) })
      .catch(() => {});
  });
}
async function healthy(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("nextjs-portal")).not.toContainText(
    /Build Error|Runtime Error/,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  if (width === 390 || width === 1440) {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({
      path: path.join(
        os.tmpdir(),
        "allied-home-discovery-20261025",
        `after-${new URL(page.url()).pathname.slice(1)}-${width}.png`,
      ),
      fullPage: true,
    });
  }
}
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`populated Parts and Vehicles use genuine card contracts at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/parts");
    await expect(page).toHaveTitle(/Auto Parts/);
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
    await expect(page.locator(".shop-product-card").first()).toContainText(
      "Fitment unknown",
    );
    await expect(
      page.getByRole("button", { name: "Find matching parts", exact: true }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".shop-product-card")).toHaveCount(8);
    await page.reload();
    await expect(page.locator(".shop-product-card")).toHaveCount(8);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
    await healthy(page, width);
    await page.goto("/vehicles");
    await expect(page).toHaveTitle(/Browse vehicles/);
    await expect(page.locator(".vehicle-card")).toHaveCount(12);
    await expect(
      page.getByRole("navigation", { name: "Vehicle listing pages" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByLabel("Minimum price (NGN)")).toBeVisible();
    await expect(page.getByLabel("Year from")).toBeVisible();
    await expect(page.getByLabel("Transmission", { exact: true })).not.toBeVisible();
    await expect(page.getByLabel("Featured listings")).toHaveCount(0);
    await expect(page.getByLabel("Year", { exact: true })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Foreign used", exact: true }).check();
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.locator(".vehicle-card")).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Remove Condition: Foreign used", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Remove Condition: Foreign used", exact: true })
      .click();
    await expect(page.locator(".vehicle-card")).toHaveCount(12);
    await healthy(page, width);
    expect(errors).toEqual([]);
  });
  test(`customer-facing demo is labelled, populated and read-only at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(request.url());
    });
    await page.goto("/demo");
    await expect(page).toHaveTitle(/Demo catalogue/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page.getByRole("complementary", { name: "Demo data notice" }),
    ).toContainText("Fictional examples");
    await expect(page.locator(".shop-product-card")).toHaveCount(20);
    await page.locator(".shop-product-card a").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Fictional sample. Not for sale.");
    await expect(dialog.getByRole("button")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".shop-product-card a").first()).toBeFocused();
    await page.getByRole("button", { name: "12 vehicles", exact: true }).click();
    await expect(page.locator(".vehicle-card")).toHaveCount(12);
    await page.getByLabel("Demo condition").selectOption("LOCALLY_USED");
    await expect(page.locator(".vehicle-card")).toHaveCount(3);
    await page.getByRole("button", { name: "Clear demo filters" }).click();
    await expect(page.locator(".vehicle-card")).toHaveCount(12);
    await healthy(page, width);
    await page.getByRole("button", { name: "4 services", exact: true }).click();
    await expect(page.locator(".demo-services article")).toHaveCount(4);
    expect(writes).toEqual([]);
  });
}
test("global emptiness, filtered emptiness, loading and failures are distinct", async ({
  page,
}) => {
  await fixture(page);
  state.mode = "empty";
  await page.goto("/parts?search=brake");
  await expect(
    page.getByRole("heading", { name: "No products are published yet" }),
  ).toBeVisible();
  await expect(page.getByText("Try a broader search or clear your filters.")).toHaveCount(
    0,
  );
  await expect(page.getByRole("navigation", { name: "Shop pages" })).toHaveCount(0);
  state.mode = "populated";
  await page.goto("/parts?search=no-such-demo-item");
  await expect(page.getByRole("heading", { name: "No matching products" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".shop-product-card")).toHaveCount(12);
  state.delay = 1200;
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("filter");
  await expect(page.locator(".product-results")).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("heading", { name: "No matching products" }),
  ).not.toBeVisible();
  await expect(page.locator(".shop-product-card")).toHaveCount(4);
  state.delay = 0;
  state.mode = "error";
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("brake");
  await expect(page.getByRole("button", { name: "Retry products" })).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search products", exact: true }),
  ).toHaveValue("brake");
  await expect(
    page.getByRole("heading", { name: "No products are published yet" }),
  ).not.toBeVisible();
  state.mode = "populated";
  await page.getByRole("button", { name: "Retry products" }).click();
  await expect(page.locator(".shop-product-card")).toHaveCount(5);
});
test("missing fitment data offers help rather than an impossible vehicle form", async ({
  page,
}) => {
  await fixture(page);
  state.mode = "no-fitment";
  await page.goto("/parts?search=filter");
  await page.getByRole("button", { name: "Find parts for my car", exact: true }).click();
  await expect(
    page.getByText("Vehicle choices are not available in our parts finder yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Find matching parts", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Ask our team to check", exact: true }),
  ).toHaveAttribute("href", /part_search=filter/);
});
test("dependent selections, unselected text, grouped details and newest suggestions retain their meaning", async ({
  page,
}) => {
  await fixture(page);
  state.staleMakes = true;
  await page.goto("/parts");
  await page.getByRole("button", { name: "Find parts for my car", exact: true }).click();
  const make = page.getByRole("combobox", { name: "Vehicle make", exact: true });
  const oldRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/fitment/makes?") && request.url().includes("search=Toy"),
  );
  await make.fill("Toy");
  await oldRequest;
  await make.fill("Hon");
  await expect(page.getByRole("option", { name: "Honda", exact: true })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(
    page.getByRole("option", { name: "Toyota", exact: true }),
  ).not.toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose your vehicle make and model" }),
  ).toBeVisible();
  await make.fill("Toy");
  await page.getByRole("option", { name: "Toyota", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle model", exact: true }).click();
  await page.getByRole("option", { name: "Corolla", exact: true }).click();
  await page.getByLabel("Model year", { exact: true }).selectOption("2018");
  await page.getByText("All technical details", { exact: false }).click();
  await expect(page.getByLabel("Engine code", { exact: true })).not.toBeVisible();
  await page.getByText("Engine and vehicle configuration", { exact: true }).click();
  await page.getByLabel("Engine code", { exact: true }).fill("DEMO-ENGINE");
  await page.getByRole("button", { name: "I know the part", exact: true }).click();
  await page.getByRole("button", { name: "Find parts for my car", exact: true }).click();
  await expect(page.getByLabel("Engine code", { exact: true })).toHaveValue(
    "DEMO-ENGINE",
  );
  await page.getByRole("button", { name: "Find matching parts", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`vehicleModelId=${demoModels[0].id}`));
  await expect(page.locator(".shop-product-card").first()).toContainText(
    "Fitment unknown",
  );
  await make.fill("Hon");
  await page.getByRole("option", { name: "Honda", exact: true }).click();
  await expect(page.getByLabel("Model year", { exact: true })).toBeDisabled();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Choose the matching model and year again" }),
  ).toBeVisible();
});
test("generic and selected Product enquiries preserve editable drafts without sending", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/contact?parts=1");
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("PRODUCT");
  await expect(
    page.getByText("Add the part name or number and any vehicle details you know below."),
  ).toBeVisible();
  await expect(
    page.getByText("Your available vehicle or part details are included below.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Handling branch", { exact: true })).toHaveValue(
    "DEMO workshop — not a real branch",
  );
  await page
    .getByLabel("Your message", { exact: true })
    .fill("My edited replacement-part request, preserved while I review it.");
  await page.getByLabel("Enquiry type", { exact: true }).selectOption("GENERAL");
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "My edited replacement-part request, preserved while I review it.",
  );
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("GENERAL");
  await page.goto(`/contact?parts=1&part_productId=${demoProducts[0].id}`);
  await expect(
    page.getByText("Your available vehicle or part details are included below.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    /Requested product: DEMO Air filter/,
  );
  await page
    .getByLabel("Your message", { exact: true })
    .fill(
      "An intentionally edited selected-product request that must survive a refresh of public information.",
    );
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    /intentionally edited/,
  );
});
