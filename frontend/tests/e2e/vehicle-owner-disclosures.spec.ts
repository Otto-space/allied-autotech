import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

test.skip(
  process.env.RUN_OWNER_VEHICLE_TESTS !== "true",
  "Requires the private owner-photo SSR fixture and matching local preview",
);
test.setTimeout(120000);
const port = 5028;
const id = (n: number) => `fe000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const root = process.env.BMW_PREPARED_MEDIA_DIR ?? "";
const files = [
  "01-view-13.webp",
  "02-view-10.webp",
  "03-view-4.webp",
  "04-view-9.webp",
  "05-view-12.webp",
  "06-view-1.webp",
  "07-view-5.webp",
];
const alts = [
  "Front three-quarter exterior",
  "Rear three-quarter view",
  "Front cabin from driver doorway",
  "Rear-seat view",
  "Dashboard and front cabin",
  "Dashboard warning and odometer close-up",
  "Engine bay with bonnet open",
];
const record = {
  id: id(1),
  title: "2007 BMW 120i — private QA example",
  slug: "private-bmw-qa",
  priceKobo: "10000",
  currency: "NGN",
  description:
    "Private synthetic preview. The price and branch are test fixtures, not owner-supplied facts.",
  branch: {
    id: id(2),
    code: "QA",
    name: "Synthetic QA branch",
    city: "Port Harcourt",
    state: "Rivers",
  },
  vehicle: {
    id: id(3),
    make: "BMW",
    model: "120i",
    trim: null,
    year: 2007,
    mileageKm: null,
    transmission: null,
    fuelType: null,
    condition: "USED",
    bodyType: "HATCHBACK",
    color: null,
    engineCapacityCc: 2000,
    engineCode: "N46",
    cylinders: 4,
    driveType: "RWD",
    doors: 5,
    seats: null,
    ownerReportedCondition:
      "The owner describes the engine, transmission, interior and exterior as being in excellent condition.",
    ownerReportedIssues:
      "AC not working. Owner reports a leak. Diagnosis and repair required.",
    images: files.map((_, n) => ({
      id: id(20 + n),
      url: `/api/v1/public/vehicles/images/${id(20 + n)}`,
      altText: alts[n],
      isPrimary: n === 0,
    })),
    conditionReports: [],
  },
};
const ok = (data: unknown) =>
  JSON.stringify({
    success: true,
    message: "Private synthetic QA",
    data,
    meta: { requestId: "private-vehicle-fixture" },
  });
let server: Server,
  mode: "normal" | "empty" | "down" | "image-down" = "normal";
test.beforeAll(async () => {
  if (!root)
    throw Error("Set BMW_PREPARED_MEDIA_DIR to the private reviewed derivatives");
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    const image = record.vehicle.images.findIndex((image) => url.pathname === image.url);
    if (image !== -1) {
      if (mode === "image-down") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "image/webp", "Cache-Control": "no-store" });
      res.end(readFileSync(path.join(root, files[image])));
      return;
    }
    if (url.pathname === "/api/v1/auth/session") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }));
      return;
    }
    if (mode === "down" && url.pathname.includes("/public/vehicles")) {
      res.writeHead(503);
      res.end();
      return;
    }
    const data =
      url.pathname === `/api/v1/public/vehicles/${id(1)}`
        ? record
        : url.pathname === "/api/v1/public/vehicles/discovery"
          ? {
              items: mode === "empty" ? [] : [record],
              totalMatches: mode === "empty" ? 0 : 1,
            }
          : url.pathname === "/api/v1/public/vehicles"
            ? { items: mode === "empty" ? [] : [record] }
            : { items: [] };
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(ok(data));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(() => {
  mode = "normal";
});

for (const width of [320, 390, 768, 1440])
  test(`owner fault, real views and unknowns remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/vehicles", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".vehicle-owner-issue-preview")).toContainText(
      "AC not working",
    );
    await expect(page.locator(".vehicle-card img")).toHaveAttribute("alt", alts[0]);
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByLabel("Location (city or state)").fill("Port Harcourt");
    await page.getByRole("button", { name: /Apply filters/ }).click();
    await expect(page).toHaveURL(/location=Port\+Harcourt/);
    await expect(page.locator(".vehicle-results")).toHaveAttribute("aria-busy", "false");
    await page.locator(".vehicle-card a").click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${id(1)}`), { timeout: 45000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("2007 BMW 120i");
    const summary = page.locator(".vd-summary");
    await expect(summary).toContainText("AC not working");
    await expect(summary).toContainText(
      "Owner reports a leak. Diagnosis and repair required.",
    );
    await expect(summary).toContainText("Not listed");
    await expect(page.getByText("N46", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /enquir/i }).first()).toHaveAttribute(
      "href",
      new RegExp(`vehicle_listingId=${id(1)}`),
    );
    await page.getByRole("button", { name: "Next photo", exact: true }).first().click();
    await expect(page.locator(".vd-gallery img").first()).toHaveAttribute("alt", alts[1]);
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      )
      .toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`owner-disclosure-${width}.png`),
      fullPage: true,
    });
  });

test("empty catalogue and unavailable photos retain recovery and fault information", async ({
  page,
}) => {
  mode = "empty";
  await page.goto("/vehicles", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "No vehicles are published yet" }),
  ).toBeVisible();
  mode = "image-down";
  await page.goto(`/vehicles/${id(1)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("This photo is unavailable").first()).toBeVisible();
  await expect(page.locator(".vd-summary")).toContainText("AC not working");
  await expect(
    page.locator(".vd-summary a[href*='vehicle_listingId=']").first(),
  ).toBeVisible();
});

test("any used condition includes all recorded origins and can be refined", async ({
  page,
}) => {
  await page.goto("/vehicles", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("checkbox", { name: /^Any used vehicle/ }).check();
  await page.getByRole("checkbox", { name: "Foreign used", exact: true }).uncheck();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conditions"))
    .toBe("USED,LOCALLY_USED");
  await expect(page.locator(".vehicle-owner-issue-preview")).toContainText(
    "AC not working",
  );
});

test("home preview follows real eligible API data and retains owner fault disclosure", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-vehicle-card")).toContainText("AC not working");
  await expect(page.locator(".home-vehicle-card a").first()).toHaveAttribute(
    "href",
    `/vehicles/${id(1)}`,
  );
  mode = "empty";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-vehicle-card")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Discuss a vehicle", exact: true }),
  ).toBeVisible();
});
