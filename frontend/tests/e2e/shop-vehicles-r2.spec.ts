import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";
import { demoId } from "../fixtures/discovery-demo.mjs";

// Rendering/interaction fixtures only. PostgreSQL integration tests establish
// actual search, validation, routing, persistence and permission behaviour.
let server: Server;
let mode: "populated" | "empty" | "error" | "no-fitment" = "populated";
let posted: Record<string, unknown>[] = [];
const success = (data: unknown) => ({
  success: true,
  data,
  message: "Isolated UI fixture",
  meta: { requestId: "shop-r2-ui" },
});
test.beforeAll(async () => {
  await mkdir(path.join(os.tmpdir(), "allied-shop-vehicles-r2"), { recursive: true });
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        success(
          discoveryResponse(new URL(req.url ?? "/", "http://127.0.0.1:5021"), mode),
        ),
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(5021, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(async ({ page }) => {
  mode = "populated";
  posted = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (req.method() === "POST") {
      expect(url.pathname).toBe("/api/v1/public/support/enquiries");
      posted.push(req.postDataJSON());
      return route.fulfill({ status: 201, json: success({ id: demoId(900) }) });
    }
    if (mode === "error")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
      });
    const data = discoveryResponse(url, mode);
    return route.fulfill(
      data
        ? { json: success(data) }
        : { status: 404, json: { success: false, error: { code: "NOT_FOUND" } } },
    );
  });
});
async function contactDetails(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("Synthetic Test Customer");
  await page.getByLabel("Email address", { exact: true }).fill("synthetic@example.test");
  await expect(
    page.getByText("Your request goes to this workshop. No branch selection is needed.", {
      exact: true,
    }),
  ).toBeVisible();
}
async function healthy(page: Page, name: string, width: number) {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator("main h1")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-shop-vehicles-r2", `${name}-${width}.png`),
    fullPage: true,
  });
}
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`Shop and Vehicles render and operate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/parts");
    await expect(
      page.getByRole("heading", {
        name: "Auto Parts & Automotive Essentials",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Search all products", exact: true }),
    ).toBeChecked();
    await expect(page.locator(".shop-product-card")).toHaveCount(12);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByLabel("Product family", { exact: true }).selectOption("ENGINE_OIL");
    await expect(
      page.getByLabel("Recorded viscosity grade", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Part condition", { exact: true })).not.toBeVisible();
    await page
      .getByLabel("Recorded viscosity grade", { exact: true })
      .selectOption("5W-30");
    await page.getByLabel("Pack volume", { exact: true }).selectOption("1000");
    await page.getByLabel("Minimum price (NGN)", { exact: true }).fill("10000");
    await page.getByLabel("Maximum price (NGN)", { exact: true }).fill("50000");
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(/family=ENGINE_OIL/);
    await expect(page.getByRole("button", { name: /Remove .*5W-30/ })).toBeVisible();
    await healthy(page, "shop", width);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page
      .getByLabel("Product family", { exact: true })
      .selectOption("REPLACEMENT_PART");
    await expect(
      page.getByLabel("Recorded viscosity grade", { exact: true }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).not.toHaveURL(/oilViscosityGrade|packVolumeMl/);
    await page.goto(
      "/vehicles?search=Toyota+Corolla&conditions=FOREIGN_USED&maxPriceKobo=1500000000",
    );
    await expect(page.locator(".vehicle-card")).toHaveCount(1);
    await healthy(page, "vehicles", width);
    expect(errors).toEqual([]);
  });
}
test("oil preferences retain both budgets through review and the submission contract", async ({
  page,
}) => {
  await page.goto(
    "/contact?parts=1&part_search=engine+oil&part_family=ENGINE_OIL&part_oilViscosityGrade=5W-30&part_packVolumeMl=1000&part_minPriceKobo=1000000&part_maxPriceKobo=5000000#enquiry",
  );
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("PRODUCT");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Product enquiry: engine oil",
  );
  const message = page.locator("#support-opening");
  await expect(message).toHaveValue(/Minimum budget:.*10,000/);
  await expect(message).toHaveValue(/Maximum budget:.*50,000/);
  await contactDetails(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send this enquiry?", exact: true });
  await expect(dialog).toContainText("5W-30");
  await expect(dialog).toContainText("50,000");
  await expect(
    dialog.getByRole("button", { name: "Go back", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ type: "PRODUCT", branchId: demoId(1) });
  expect(posted[0].message).toMatch(/Minimum budget:.*10,000/);
  expect(posted[0].message).toMatch(/Maximum budget:.*50,000/);
});
test("Vehicle requirements preserve Corolla, condition and budget through review and submission", async ({
  page,
}) => {
  await page.goto(
    "/contact?vehicle=1&vehicle_search=Toyota+Corolla&vehicle_conditions=FOREIGN_USED&vehicle_maxPriceKobo=1500000000#enquiry",
  );
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("VEHICLE");
  await expect(page.getByRole("radio", { name: /requirements/i })).toBeChecked();
  await expect(page.locator("#support-opening")).toHaveValue(/Foreign used/);
  await expect(page.locator("#support-opening")).toHaveValue(/15,000,000/);
  await contactDetails(page);
  await page.getByRole("button", { name: "Review enquiry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Toyota Corolla");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received", exact: true }),
  ).toBeVisible();
  expect(posted[0]).toMatchObject({
    type: "VEHICLE",
    vehicleEnquiryIntent: "REQUIREMENTS",
    branchId: demoId(1),
  });
  expect(posted[0]).not.toHaveProperty("vehicleListingId");
});
test("both draft choices preserve separate edited drafts across reload, resume and equivalent URLs", async ({
  page,
}) => {
  await page.goto("/contact?parts=1&part_search=engine+oil#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Edited oil draft");
  await page.locator("#support-opening").fill("Keep this exact oil message separately.");
  await page.goto("/contact?vehicle=1&vehicle_search=Toyota+Corolla#enquiry");
  await expect(
    page.getByRole("heading", { name: "You have an unsent enquiry", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep current draft", exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await page.reload();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await expect(
    page.getByRole("button", { name: "Keep current draft", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Start pending enquiry", exact: true }).click();
  await expect(page.getByLabel("Enquiry type", { exact: true })).toHaveValue("VEHICLE");
  await page.getByLabel("Subject", { exact: true }).fill("Edited Corolla draft");
  await page.getByRole("button", { name: /Resume Product enquiry: engine oil/ }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited oil draft",
  );
  await expect(page.locator("#support-opening")).toHaveValue(
    "Keep this exact oil message separately.",
  );
  await page
    .getByRole("button", { name: /Resume Vehicle enquiry: Toyota Corolla/ })
    .click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited Corolla draft",
  );
  await page.goto("/contact?vehicle_search=Toyota+Corolla&vehicle=1#enquiry");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Edited Corolla draft",
  );
  expect(posted).toHaveLength(0);
});
test("starting the different enquiry keeps the current draft, and unavailable listings never become requirements", async ({
  page,
}) => {
  await page.goto("/contact?parts=1&part_search=brake+pads#enquiry");
  await page.getByLabel("Subject", { exact: true }).fill("Preserved brake draft");
  await page.goto("/contact?vehicle=1&vehicle_search=Honda#enquiry");
  await page.getByRole("button", { name: "Start this enquiry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Resume Product enquiry: brake pads/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Resume Product enquiry: brake pads/ }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Preserved brake draft",
  );
  await page.goto("/contact?vehicle=1&vehicle_listingId=invalid#enquiry");
  await page.getByRole("button", { name: "Start this enquiry", exact: true }).click();
  await expect(page.getByText(/This listing could not be verified/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review enquiry", exact: true }),
  ).not.toBeVisible();
});
