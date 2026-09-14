import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { Inventory, InventoryReservation } from "@/lib/api/inventory-schemas";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branch = {
  id: id(1),
  code: "STOCK-TEST",
  name: "Isolated stock branch",
  isActive: true,
};
const product = {
  id: id(2),
  name: "Isolated stock part",
  sku: "STOCK-001",
  priceKobo: "10050",
  currency: "NGN" as const,
  isActive: true,
  category: { id: id(3), name: "Test category", isActive: true },
};
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated test",
      data,
      meta: { requestId: "inventory-test" },
    },
  });
async function fixture(
  page: Page,
  handler: (route: Route, path: string) => Promise<boolean | void>,
  role = "STAFF",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(4),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-13T09:00:00Z",
        user: { id: id(5), email: "stock@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-test-token-".repeat(3) });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
const inventory = (): Inventory => ({
  id: id(6),
  quantity: 10,
  reserved: 2,
  available: 8,
  reorderLevel: 5,
  version: 0,
  updatedAt: "2026-09-13T09:00:00Z",
  branch,
  product,
});
const balances = (page: Page, label: string) =>
  page
    .locator(".totals dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("+ dd");
test("uncertain stock movement preserves body and idempotency key without optimistic balances", async ({
  page,
}) => {
  const stock = inventory();
  const attempts: { body: unknown; key: string | undefined }[] = [];
  await fixture(page, async (route, path) => {
    if (path === `/staff/inventory/${stock.id}`) {
      await reply(route, stock);
      return true;
    }
    if (path.endsWith("/history") || path.endsWith("/reservations")) {
      await reply(route, { items: [] });
      return true;
    }
    if (path === `/staff/inventory/${stock.id}/movements`) {
      attempts.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      if (attempts.length === 1) {
        stock.quantity = 13;
        stock.available = 11;
        stock.version = 1;
        await route.abort("failed");
      } else await reply(route, { inventory: stock, transaction: {}, replayed: true });
      return true;
    }
  });
  await page.goto(`/admin/inventory/${stock.id}`, { waitUntil: "domcontentloaded" });
  await expect(balances(page, "Available")).toHaveText("8");
  await page.getByLabel("Units moved").fill("3");
  await page.getByLabel("Note (optional)", { exact: true }).fill("Isolated receipt");
  await page.getByRole("button", { name: "Review stock movement" }).click();
  expect(attempts).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Retry same request" }),
  ).toBeEnabled();
  await expect(balances(page, "Available")).toHaveText("8");
  expect(attempts).toHaveLength(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(balances(page, "Available")).toHaveText("11");
  await expect(
    page.getByRole("button", { name: "Review stock movement" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Resolve pending stock change" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByText(
      "Inventory change recorded. Review the refreshed balances and history.",
    ),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/^[A-Za-z0-9-]{16,120}$/);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0].body).toEqual({
    type: "STOCK_IN",
    quantity: 3,
    note: "Isolated receipt",
  });
  await expect(page.getByRole("button", { name: "Review stock movement" })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page
    .locator("#inventory-movement")
    .screenshot({ path: path.join(os.tmpdir(), "allied-inventory-movement-mobile.png") });
});
test("stock reservation, release and reserved sale use the actual quantity and separate stock from payment", async ({
  page,
}) => {
  const stock = inventory();
  const localExpiry = new Date(Date.now() + 86400000 + 3600000)
    .toISOString()
    .slice(0, 16);
  const expiresAt = `${localExpiry}:00+01:00`;
  const reservation = (n: number, quantity: number): InventoryReservation => ({
    id: id(n),
    quantity,
    status: "ACTIVE",
    expiresAt,
    releasedAt: null,
    consumedAt: null,
    expiredAt: null,
    referenceType: null,
    referenceId: null,
    customer: null,
    createdAt: "2026-09-13T09:00:00Z",
  });
  const reservations = [reservation(7, 2)];
  const keys: string[] = [];
  const history: Record<string, unknown>[] = [];
  await fixture(page, async (route, path) => {
    if (path === `/staff/inventory/${stock.id}`) {
      await reply(route, stock);
      return true;
    }
    if (path.endsWith("/history")) {
      const type = new URL(route.request().url()).searchParams.get("type");
      await reply(route, {
        items: history.filter((item) => !type || item.type === type),
      });
      return true;
    }
    if (path.endsWith("/reservations") && route.request().method() === "GET") {
      const status = new URL(route.request().url()).searchParams.get("status");
      await reply(route, {
        items: reservations.filter((item) => !status || item.status === status),
      });
      return true;
    }
    if (
      route.request().method() === "POST" &&
      path.startsWith(`/staff/inventory/${stock.id}/`)
    ) {
      const before = { quantity: stock.quantity, reserved: stock.reserved };
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      if (path.endsWith("/reservations")) {
        expect(route.request().postDataJSON()).toEqual({ quantity: 3, expiresAt });
        reservations.push(reservation(8, 3));
        stock.reserved = 5;
        stock.available = 5;
      } else if (path.endsWith(`/reservations/${id(8)}/release`)) {
        expect(route.request().postDataJSON()).toEqual({ note: "Test hold ended" });
        reservations[1].status = "RELEASED";
        stock.reserved = 2;
        stock.available = 8;
      } else {
        expect(path).toBe(`/staff/inventory/${stock.id}/movements`);
        expect(route.request().postDataJSON()).toEqual({
          type: "SALE",
          quantity: 2,
          reservationId: id(7),
        });
        reservations[0].status = "CONSUMED";
        stock.quantity = 8;
        stock.reserved = 0;
        stock.available = 8;
      }
      stock.version++;
      history.push({
        id: id(20 + stock.version),
        type: path.endsWith("/reservations")
          ? "RESERVATION"
          : path.endsWith("/release")
            ? "RESERVATION_RELEASE"
            : "SALE",
        quantityDelta: stock.quantity - before.quantity,
        reservedDelta: stock.reserved - before.reserved,
        quantityBefore: before.quantity,
        quantityAfter: stock.quantity,
        reservedBefore: before.reserved,
        reservedAfter: stock.reserved,
        referenceType: null,
        referenceId: null,
        note: null,
        createdAt: new Date().toISOString(),
        performedBy: { id: id(5), role: "STAFF" },
      });
      await reply(route, { inventory: stock, replayed: false });
      return true;
    }
  });
  await page.goto(`/admin/inventory/${stock.id}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Units to reserve").fill("3");
  await page.getByLabel("Reservation expiry (Lagos time)").fill(localExpiry);
  await page.getByRole("button", { name: "Review stock reservation" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(balances(page, "Reserved")).toHaveText("5");
  const hold = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Reservation 00000008" }) });
  await hold.getByLabel("Release note (optional)").fill("Test hold ended");
  await hold.getByRole("button", { name: "Review release" }).click();
  await expect(
    page.getByRole("dialog").getByText(/does not cancel an order or issue a refund/),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(balances(page, "Reserved")).toHaveText("2");
  await page.getByRole("button", { name: "Record reserved sale" }).click();
  await expect(page.getByLabel("Units moved")).toHaveValue("2");
  await expect(page.getByLabel("Units moved")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Review stock movement" }).click();
  await expect(
    page.getByRole("dialog").getByText(/does not create an order, invoice or payment/),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(balances(page, "On hand")).toHaveText("8");
  await expect(balances(page, "Reserved")).toHaveText("0");
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(3);
  const historyRegion = page.getByRole("region", {
    name: "Stock movement history",
    exact: true,
  });
  await expect(historyRegion.getByRole("row")).toHaveCount(4);
  await page.getByLabel("History movement type").selectOption("SALE");
  await expect(historyRegion.getByRole("row")).toHaveCount(2);
  await page.getByLabel("Reservation status", { exact: true }).selectOption("CONSUMED");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Reservation 00000007" })).toBeVisible();
});

test("administrator creates an empty stock record and updates its versioned reorder level", async ({
  page,
}) => {
  const stock = {
    ...inventory(),
    quantity: 0,
    reserved: 0,
    available: 0,
    reorderLevel: 7,
  };
  let created = false;
  let writes = 0;
  await fixture(
    page,
    async (route, path) => {
      if (path === "/public/branches") {
        await reply(route, { items: [branch] });
        return true;
      }
      if (path === "/public/catalog/products") {
        await reply(route, {
          items: [
            {
              ...product,
              slug: "isolated-stock-part",
              description: null,
              brand: null,
              manufacturerPartNumber: null,
              compareAtPriceKobo: null,
              images: [],
              compatibilities: [],
              availability: [],
              category: { ...product.category, slug: "test-category", description: null },
            },
          ],
        });
        return true;
      }
      if (path === "/staff/inventory") {
        await reply(route, { items: created ? [stock] : [] });
        return true;
      }
      if (path === "/admin/inventory") {
        expect(route.request().postDataJSON()).toEqual({
          branchId: branch.id,
          productId: product.id,
          reorderLevel: 7,
        });
        created = true;
        writes++;
        await reply(route, stock);
        return true;
      }
      if (path === `/staff/inventory/${stock.id}`) {
        if (route.request().method() === "PATCH") {
          expect(route.request().postDataJSON()).toEqual({
            reorderLevel: 3,
            expectedVersion: 0,
          });
          stock.reorderLevel = 3;
          stock.version = 1;
          writes++;
        }
        await reply(route, stock);
        return true;
      }
      if (path.endsWith("/history") || path.endsWith("/reservations")) {
        await reply(route, { items: [] });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Inventory branch").selectOption(branch.id);
  await page.getByLabel("Inventory part").selectOption(product.id);
  await page.getByLabel("Initial reorder level").fill("7");
  await page.getByRole("button", { name: "Review inventory record" }).click();
  expect(writes).toBe(0);
  await expect(
    page.getByRole("dialog").getByText(/creates an empty stock record/),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/inventory/${stock.id}$`));
  await expect(balances(page, "On hand")).toHaveText("0");
  await page.getByLabel("Low-stock threshold").fill("3");
  await page.getByRole("button", { name: "Review reorder level" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(balances(page, "Reorder level")).toHaveText("3");
  expect(writes).toBe(2);
});

test("low-stock filtering, history failures and rejected movements preserve honest states and draft input", async ({
  page,
}) => {
  const stock = inventory();
  let historyRecovered = false;
  let writes = 0;
  const filters: URLSearchParams[] = [];
  await fixture(page, async (route, path) => {
    if (path === "/public/branches") {
      await reply(route, { items: [branch] });
      return true;
    }
    if (path === "/public/catalog/products") {
      await reply(route, { items: [product] });
      return true;
    }
    if (path === "/staff/inventory") {
      filters.push(new URL(route.request().url()).searchParams);
      await reply(route, {
        items:
          new URL(route.request().url()).searchParams.get("lowStock") === "true"
            ? []
            : [stock],
      });
      return true;
    }
    if (path === `/staff/inventory/${stock.id}`) {
      await reply(route, stock);
      return true;
    }
    if (path.endsWith("/reservations")) {
      await reply(route, { items: [] });
      return true;
    }
    if (path.endsWith("/history")) {
      if (historyRecovered) await reply(route, { items: [] });
      else
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return true;
    }
    if (path.endsWith("/movements")) {
      writes++;
      await route.fulfill({
        status: 409,
        json: {
          success: false,
          message: "Private warehouse exception",
          error: { code: "INSUFFICIENT_STOCK" },
        },
      });
      return true;
    }
  });
  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Add a branch inventory record" }),
  ).toHaveCount(0);
  await page.getByLabel("Show only low-stock records").check();
  await expect(
    page.getByRole("heading", { name: "No low-stock records on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all stock" }).click();
  await page.getByRole("button", { name: "Filter by branch or part" }).click();
  await page.getByLabel("Active branch filter").selectOption(branch.id);
  await page.getByLabel("Active catalogue part filter").selectOption(product.id);
  await expect
    .poll(() =>
      filters.some(
        (query) =>
          query.get("branchId") === branch.id && query.get("productId") === product.id,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Clear inventory filters" }).click();
  await expect(page.getByLabel("Active branch filter")).toHaveValue("");
  await expect(page.getByLabel("Active catalogue part filter")).toHaveValue("");
  await page.getByRole("link", { name: product.name, exact: true }).click();
  await expect(page.getByText("No movements match this page and filter.")).toHaveCount(0);
  await page.getByLabel("Movement type", { exact: true }).selectOption("DAMAGE");
  await page.getByLabel("Units moved").fill("100");
  await page.getByLabel("Note (optional)", { exact: true }).fill("Counted damaged units");
  await page.getByRole("button", { name: "Review stock movement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByText(/not enough available stock/),
  ).toBeVisible();
  await expect(page.getByText("Private warehouse exception")).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Units moved")).toHaveValue("100");
  await expect(page.getByLabel("Note (optional)", { exact: true })).toHaveValue(
    "Counted damaged units",
  );
  await expect(balances(page, "Available")).toHaveText("8");
  expect(writes).toBe(1);
  historyRecovered = true;
  await page.getByRole("button", { name: "Refresh stock history" }).click();
  await expect(page.getByText("No movements match this page and filter.")).toBeVisible();
});
