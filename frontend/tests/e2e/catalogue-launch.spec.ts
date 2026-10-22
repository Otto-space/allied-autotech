import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  product,
  listing,
  service,
  branch,
  publicRecord,
} from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_CATALOGUE_TESTS !== "true",
  "Requires isolated catalogue build",
);
let server: Server;
const calls: string[] = [];
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1:5021").pathname.replace(
      /^\/api\/v1/,
      "",
    );
    calls.push(path);
    let data = publicRecord(path);
    if (path === "/public/services" || path === "/public/services/discovery")
      data = { items: [service], totalMatches: 1 };
    if (path === "/public/catalog/products") data = { items: [product] };
    if (path === "/public/vehicles") data = { items: [listing] };
    if (path === "/public/branches") data = { items: [branch] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ success: true, data, meta: { requestId: "catalogue-test" } }),
    );
  });
  await new Promise<void>((resolve) => server.listen(5021, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("catalogue details offer external contact without account requests or forms", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, title] of [
    [`/parts/${product.id}`, product.name],
    [`/vehicles/${listing.id}`, listing.title],
    [`/services/${service.id}`, service.name],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Enquire by email" }).first(),
    ).toHaveAttribute("href", /^mailto:support@alliedautotech.com/);
    await expect(page.locator("main form")).toHaveCount(0);
  }
  expect(calls.some((p) => p === "/auth/session" || p.includes("/slots"))).toBe(false);
  expect(errors).toEqual([]);
});

test("contact and privacy are readable on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact");
    await expect(page).toHaveTitle(/Contact/);
    await expect(
      page.getByRole("heading", { name: /talk about your vehicle/ }),
    ).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Call our team" })).toHaveAttribute(
      "href",
      "tel:+2348136075567",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `allied-catalogue-contact-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("main").getByRole("link", { name: "privacy notice" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacy notice", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `allied-catalogue-privacy-${width}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("direct customer links close while staff sign-in and help remain available", async ({
  page,
}) => {
  for (const path of [
    "/register",
    "/dashboard",
    "/dashboard/support",
    "/payments/complete",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/contact#enquiry$/);
  }
  await page.goto("/help/booking-a-service");
  await expect(page).toHaveURL(/\/help$/);
  await expect(
    page.getByRole("heading", { name: "Help, when you need it." }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('main a[href="/register"]')).toHaveCount(0);
});
