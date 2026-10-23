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

for (const width of [390, 1440]) {
  test(`customers save, reload and remove both collections without transactions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const saved = { product: false, vehicle: false };
    const writes: string[] = [];
    const userId = "a9000000-0000-4000-8000-000000000091";
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
      const reply = (data: unknown) =>
        route.fulfill({
          json: {
            success: true,
            message: "Isolated saving fixture",
            data,
            meta: { requestId: "saving-test" },
          },
        });
      if (p === "/auth/session")
        return reply({
          id: userId,
          user: { id: userId, email: "saving@example.test", role: "CUSTOMER" },
          mfaRequired: false,
          mfaVerifiedAt: null,
          expiresAt: "2099-01-01T00:00:00Z",
          idleExpiresAt: "2099-01-01T00:00:00Z",
        });
      if (p === "/auth/csrf") return reply({ csrfToken: "s".repeat(64) });
      if (p.startsWith("/public/")) return reply(publicRecord(p));
      if (["PUT", "DELETE", "POST", "PATCH"].includes(req.method())) {
        expect(req.headers()["x-csrf-token"]).toBe("s".repeat(64));
        expect([
          `/customers/favourites/${product.id}`,
          `/customers/saved-vehicles/${listing.id}`,
        ]).toContain(p);
        writes.push(`${req.method()} ${p}`);
        if (p.includes("favourites")) {
          saved.product = req.method() === "PUT";
          return reply({ product });
        }
        saved.vehicle = req.method() === "PUT";
        return reply({ vehicleListing: listing });
      }
      if (p === "/customers/favourites")
        return reply({ items: saved.product ? [{ id: product.id, product }] : [] });
      if (p === "/customers/saved-vehicles/page")
        return reply({
          items: saved.vehicle ? [{ id: listing.id, vehicleListing: listing }] : [],
        });
      if (p.includes("notifications")) return reply({ items: [], unreadCount: 0 });
      return reply({ items: [] });
    });
    for (const kind of ["product", "vehicle"] as const) {
      await page.goto(
        kind === "product" ? `/parts/${product.id}` : `/vehicles/${listing.id}`,
      );
      const save = page.getByRole("button", {
        name: kind === "product" ? "Save to favourites" : "Save vehicle",
        exact: true,
      });
      await expect(save).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /cart|reserve|inspection|Enquire about this vehicle/i,
        }),
      ).toHaveCount(0);
      await save.click();
      await expect(
        page
          .getByText(
            kind === "product"
              ? "Product saved to your favourites."
              : "This vehicle is saved to your account.",
            { exact: true },
          )
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: join(tmpdir(), `allied-saving-${kind}-${width}.png`),
        fullPage: true,
      });
    }
    await page.goto("/dashboard/saved");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Remove ${product.name} from favourites`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove item", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Saved vehicles" }).click();
    await expect(
      page.getByRole("heading", { name: listing.title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Remove ${listing.title} from saved vehicles`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove item", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: listing.title, exact: true }),
    ).toHaveCount(0);
    expect(writes).toHaveLength(4);
    expect(errors).toEqual([]);
  });
}
