import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import {
  product,
  listing,
  service,
  branch,
  publicRecord,
} from "../fixtures/public-account-actions";

test.skip(
  process.env.RUN_PUBLIC_LAUNCH_TESTS !== "true",
  "Requires the isolated browse/enquiries build and SSR fixture",
);
let server: Server;
const calls: string[] = [];
const signedProxy = process.env.RUN_SIGNED_PROXY_TESTS === "true";
test.use({
  extraHTTPHeaders: signedProxy ? { "x-vercel-forwarded-for": "198.51.100.23" } : {},
});
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1:5021");
    if (signedProxy) {
      const ip = req.headers["x-allied-client-ip"],
        time = req.headers["x-allied-client-time"];
      const expected = createHmac("sha256", Buffer.alloc(32, 31))
        .update(`allied-client-v1\n${req.method}\n${url.pathname}\n${ip}\n${time}`)
        .digest("hex");
      if (
        ip !== "198.51.100.23" ||
        Math.abs(Date.now() / 1000 - Number(time)) > 60 ||
        req.headers["x-allied-client-proof"] !== expected
      ) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: { code: "FORBIDDEN" } }));
        return;
      }
    }
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push(path);
    if (path === "/auth/session") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }));
      return;
    }
    let data: unknown = publicRecord(path);
    if (path === "/public/services" || path === "/public/services/discovery")
      data = { items: [service], totalMatches: 1 };
    if (path === "/public/catalog/products") data = { items: [product] };
    if (path === "/public/vehicles") data = { items: [listing] };
    if (path === "/public/branches") data = { items: [branch] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "Isolated launch fixture",
        data,
        meta: { requestId: "launch-test" },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(5021, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("public homepage offers services without a cart shortcut", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Cart", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore services", exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Book a Service", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: join(tmpdir(), "allied-public-launch-home-desktop.png"),
  });
  if (signedProxy) {
    const response = await page.request.get("/api/v1/public/services");
    expect(response.status()).toBe(200);
    expect(
      Object.keys(response.headers()).some(
        (name) =>
          name.startsWith("x-allied-client") || name.startsWith("x-middleware-request"),
      ),
    ).toBe(false);
    expect(JSON.stringify(response.headers())).not.toContain(
      Buffer.alloc(32, 31).toString("base64"),
    );
  }
});
test("product details offer enquiries and explain collection without checkout", async ({
  page,
}) => {
  await page.goto(`/parts/${product.id}`);
  await expect(
    page.getByRole("heading", { name: product.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Send an enquiry", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Discuss collection or delivery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Review collection or available delivery options at checkout.", {
      exact: true,
    }),
  ).toHaveCount(0);
});
test("vehicle details retain their facts while requests are enquiry-only", async ({
  page,
}) => {
  await page.goto(`/vehicles/${listing.id}`);
  await expect(
    page.getByRole("heading", { name: listing.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Send an enquiry", exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /reserve|inspection/i })).toHaveCount(0);
});
test("fixed services use the enquiry form and never load appointment slots", async ({
  page,
}) => {
  const before = calls.length;
  await page.goto(`/services/${service.id}`);
  await expect(
    page.getByRole("heading", { name: service.name, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Tell us what you need.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /send booking|confirm booking/i }),
  ).toHaveCount(0);
  expect(calls.slice(before).some((p) => p.includes("/slots"))).toBe(false);
});
test("direct checkout pages redirect to customer care", async ({ page }) => {
  await page.goto("/dashboard/cart");
  await expect(page).toHaveURL(/\/contact#enquiry$/);
  await expect(
    page.getByRole("heading", { name: /talk about your vehicle/ }),
  ).toBeVisible();
});
test("mobile enquiries remain visible without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/parts/${product.id}`);
  const link = page.getByRole("link", { name: "Send an enquiry", exact: true }).first();
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), "allied-public-launch-product-mobile.png"),
  });
  await link.click();
  await expect(page).toHaveURL(/\/contact#enquiry$/);
  const hours = page.getByText("Monday–Saturday, 8am–6pm (Nigeria time)", {
    exact: true,
  });
  await expect(hours).toBeVisible();
  await expect(
    page.getByText(/We aim to acknowledge enquiries within 30 minutes/),
  ).toBeVisible();
  await hours.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(tmpdir(), "allied-public-launch-contact-mobile.png"),
  });
  expect(errors).toEqual([]);
});
