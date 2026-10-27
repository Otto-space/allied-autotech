import { type Page, expect } from "@playwright/test";
import { productSchema, type Product } from "../../lib/api/commerce-schemas";
import path from "node:path";
import { id } from "./public-account-actions";
export async function drawerProduct(): Promise<Product> {
  const base = process.env.DRAWER_API_ORIGIN ?? "http://localhost:5012";
  if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(base))
    throw new Error("Drawer QA requires an isolated local API");
  const response = await fetch(`${base}/api/v1/public/catalog/products?limit=20`);
  expect(response.status).toBe(200);
  const products = productSchema.array().parse((await response.json()).data.items);
  const available = products.find((product) =>
    product.availability.some((branch) => branch.inStock),
  );
  if (!available)
    throw new Error("Drawer fixture requires an available synthetic product");
  return available;
}
export async function drawerFixture(page: Page, product: Product) {
  const state = {
    role: "CUSTOMER",
    signedIn: true,
    delay: false,
    release: undefined as (() => void) | undefined,
    fail: false,
    status: 200,
    corrupt: "",
    writes: [] as { path: string; body: unknown; csrf?: string }[],
    items: 2,
    large: false,
    photos: false,
  };
  const envelope = (data: unknown) => ({
    success: true,
    data,
    message: "Isolated response",
    meta: { requestId: "drawer-qa" },
  });
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill({
      status: state.signedIn ? 200 : 401,
      json: state.signedIn
        ? envelope({
            id: id(90),
            user: { id: id(91), email: "drawer@example.test", role: state.role },
            mfaRequired: false,
            mfaVerifiedAt: null,
            expiresAt: "2099-01-01T00:00:00Z",
            idleExpiresAt: "2099-01-01T00:00:00Z",
          })
        : { success: false, error: { code: "UNAUTHORIZED" }, meta: { requestId: "qa" } },
    }),
  );
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({ json: envelope({ csrfToken: "s".repeat(64) }) }),
  );
  await page.route("**/api/v1/public/catalog/products/images/*", (r) =>
    r.fulfill({
      path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/customers/**", async (r) => {
    const req = r.request(),
      p = new URL(req.url()).pathname;
    if (req.method() !== "PUT")
      return r.fulfill({ json: envelope({ items: [], subtotalKobo: "0" }) });
    state.writes.push({
      path: p,
      body: req.postDataJSON(),
      csrf: req.headers()["x-csrf-token"],
    });
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.fail) return r.abort();
    if (state.status !== 200)
      return r.fulfill({
        status: state.status,
        json: {
          success: false,
          error: { code: "CONFLICT", message: "Please review your quantity." },
          meta: { requestId: "qa" },
        },
      });
    if (p.includes("/favourites/")) return r.fulfill({ json: envelope({ product }) });
    const quantity = req.postDataJSON().quantity;
    const items = Array.from({ length: state.items }, (_, i) => {
      const price = state.large ? "9007199254740993" : product.priceKobo;
      const n = i === 0 ? quantity : 1;
      return {
        id: id(500 + i),
        product: {
          ...product,
          id: i === 0 ? product.id : id(600 + i),
          name: i === 0 ? product.name : `Saved cart part ${i + 1}`,
          priceKobo: price,
          images: state.photos
            ? [
                {
                  id: id(800 + i),
                  url: `/api/v1/public/catalog/products/images/${id(800 + i)}`,
                  altText: null,
                  isPrimary: true,
                },
              ]
            : [],
        },
        quantity: n,
        unitPriceKobo: price,
        lineSubtotalKobo: (BigInt(price) * BigInt(n)).toString(),
      };
    });
    const data = {
      items,
      subtotalKobo: items
        .reduce((sum, item) => sum + BigInt(item.lineSubtotalKobo), BigInt(0))
        .toString(),
    };
    if (state.corrupt === "subtotal") data.subtotalKobo = "1";
    if (state.corrupt === "line") items[0].lineSubtotalKobo = "1";
    if (state.corrupt === "quantity") items[0].quantity = quantity + 1;
    if (state.corrupt === "target") items[0].product.id = id(999);
    if (state.corrupt === "duplicate") items.push(items[0]);
    return r.fulfill({ json: envelope(data) });
  });
  return state;
}
export async function openDrawer(page: Page, product: Product, quantity = "2") {
  await page.goto("/parts/" + product.id);
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
  await page.getByRole("button", { name: "Save quantity to cart" }).click();
  await expect(page.getByRole("dialog", { name: "Cart updated" })).toBeVisible();
}
