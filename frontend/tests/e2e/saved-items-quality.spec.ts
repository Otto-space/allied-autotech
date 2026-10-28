import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { savedFixture, id, savedParts, savedVehicles } from "../fixtures/saved-items";
const visit = async (page: Page) => {
  await page.goto("/dashboard/saved");
  await expect(
    page.getByRole("heading", { name: "Saved items", exact: true }),
  ).toBeVisible();
};
const switchVehicles = async (page: Page) => {
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await expect(
    page.getByRole("heading", { name: "Toyota Highlander", exact: true }),
  ).toBeVisible();
};
const manySavedVehicles = () =>
  Array.from({ length: 13 }, (_, i) => ({
    ...structuredClone(savedVehicles[0]),
    id: id(800 + i),
    vehicleListing: {
      ...structuredClone(savedVehicles[0].vehicleListing),
      id: id(900 + i),
      title: `Saved vehicle ${i + 1}`,
    },
  }));
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  for (const vehicles of [false, true])
    test(`${vehicles ? "vehicles" : "parts"} is readable at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 900 });
      await savedFixture(page);
      await visit(page);
      if (vehicles) await switchVehicles(page);
      else
        await expect(
          page.getByRole("heading", { name: "Engine oil filter" }),
        ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      for (const control of await page
        .locator(".saved-page .button,.saved-tabs button")
        .all()) {
        const box = await control.boundingBox();
        if (box) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page
          .locator(".saved-card .product-media")
          .first()
          .evaluate((node) => node.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(261);
      const removeIcon = await page.locator(".saved-remove svg").first().boundingBox();
      expect(removeIcon?.width).toBeGreaterThanOrEqual(18);
      expect(errors).toEqual([]);
    });
for (const width of [390, 768, 1440])
  test(`collections and removal dialog pass accessibility at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await savedFixture(page);
    await visit(page);
    await expect(page.getByRole("heading", { name: "Engine oil filter" })).toBeVisible();
    const scan = async () =>
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await scan();
    await switchVehicles(page);
    await scan();
    await page
      .getByRole("button", { name: "Remove Toyota Highlander from saved vehicles" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await scan();
  });
test("tabs use arrow, Home and End keys without reading privileged collections", async ({
  page,
}) => {
  const state = await savedFixture(page);
  await visit(page);
  const parts = page.getByRole("tab", { name: "Favourite products" });
  await parts.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Saved vehicles" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Toyota Highlander" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(parts).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Saved vehicles" })).toBeFocused();
  expect(state.writes).toEqual([]);
});
for (const vehicles of [false, true])
  test(`reviewed removal uses ${vehicles ? "listing" : "product"} id and CSRF`, async ({
    page,
  }) => {
    const state = await savedFixture(page);
    await visit(page);
    if (vehicles) await switchVehicles(page);
    const name = vehicles ? "Toyota Highlander" : "Engine oil filter";
    const opener = page.getByRole("button", {
      name: `Remove ${name} from ${vehicles ? "saved vehicles" : "favourites"}`,
    });
    await opener.click();
    expect(state.writes).toEqual([]);
    await expect(page.getByRole("dialog")).toContainText(name);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(opener).toBeFocused();
    await opener.click();
    await page.getByRole("button", { name: "Remove item", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
    expect(state.writes).toEqual([
      {
        path: `/customers/${vehicles ? "saved-vehicles" : "favourites"}/${id(vehicles ? 401 : 201)}`,
        csrf: "s".repeat(64),
        body: {},
      },
    ]);
    await expect(
      page.getByRole("heading", {
        name: vehicles ? "Saved vehicles" : "Favourite products",
        exact: true,
      }),
    ).toBeFocused();
  });
for (const vehicles of [false, true])
  test(`${vehicles ? "vehicle" : "part"} read errors are not empty lists`, async ({
    page,
  }) => {
    const state = await savedFixture(page);
    state.partError = !vehicles;
    state.vehicleError = vehicles;
    await visit(page);
    if (vehicles) await page.getByRole("tab", { name: "Saved vehicles" }).click();
    await expect(page.locator('.saved-page [role="alert"]')).toBeVisible();
    await expect(page.locator(".saved-empty")).toHaveCount(0);
    state.partError = false;
    state.vehicleError = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: vehicles ? "Toyota Highlander" : "Engine oil filter",
        exact: true,
      }),
    ).toBeVisible();
  });
test("empty collections provide real discovery links", async ({ page }) => {
  const state = await savedFixture(page);
  state.parts = [];
  state.vehicles = [];
  await visit(page);
  await expect(
    page.getByRole("heading", { name: "Your shortlist starts here" }),
  ).toBeVisible();
  await expect(page.locator(".saved-empty a")).toHaveAttribute("href", "/parts");
  await expect(page.getByRole("link", { name: "Browse Shop", exact: true })).toHaveCount(
    1,
  );
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await expect(
    page.getByRole("heading", { name: "No available saved vehicles" }),
  ).toBeVisible();
  await expect(page.locator(".saved-empty a")).toHaveAttribute("href", "/vehicles");
  await expect(
    page.getByRole("link", { name: "Browse vehicles", exact: true }),
  ).toHaveCount(1);
});
test("failed refresh retains cards and disables removal until a successful read", async ({
  page,
}) => {
  const state = await savedFixture(page);
  await visit(page);
  await expect(page.getByRole("heading", { name: "Engine oil filter" })).toBeVisible();
  state.partError = true;
  await page.getByRole("button", { name: "Refresh favourite products" }).click();
  await expect(page.locator('.saved-page [role="alert"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Engine oil filter" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Engine oil filter from favourites" }),
  ).toBeDisabled();
  state.partError = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Engine oil filter from favourites" }),
  ).toBeEnabled();
});
test("uncertain removal requires a fresh collection read before another attempt", async ({
  page,
}) => {
  const state = await savedFixture(page);
  await visit(page);
  state.failDelete = true;
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourites" })
    .click();
  await page.getByRole("button", { name: "Remove item", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("outcome could not be confirmed");
  await expect(
    page.getByRole("button", { name: "Remove item", exact: true }),
  ).toBeDisabled();
  const reads = state.reads.length;
  await page.getByRole("button", { name: "Close & review record" }).click();
  await expect.poll(() => state.reads.length).toBeGreaterThan(reads);
  expect(state.writes).toHaveLength(1);
});
test("a rejected removal keeps the record and does not display success", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.rejectDelete = true;
  await visit(page);
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourites" })
    .click();
  await page.getByRole("button", { name: "Remove item", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.locator(".saved-page .notice.success")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove item", exact: true }),
  ).toBeDisabled();
});
test("session changes clear an open review and private records", async ({ page }) => {
  const state = await savedFixture(page);
  await visit(page);
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourites" })
    .click();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Engine oil filter" })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
test("late removal cannot announce success after a session change", async ({ page }) => {
  const state = await savedFixture(page);
  state.delayDelete = true;
  await visit(page);
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourites" })
    .click();
  await page.getByRole("button", { name: "Remove item", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  state.release?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/was removed from/)).toHaveCount(0);
});
test("parts pagination preserves its cursor when switching collections", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.nextCursor = id(103);
  await visit(page);
  await page
    .getByRole("navigation", { name: "Favourite products pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect
    .poll(() => state.reads.some((x) => x.includes(`cursor=${id(103)}`)))
    .toBe(true);
  await switchVehicles(page);
  await page.getByRole("tab", { name: "Favourite products" }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  state.nextCursor = undefined;
  state.parts = [];
  await page.getByRole("button", { name: "Refresh favourite products" }).click();
  await expect(
    page.getByRole("heading", { name: "No favourite products on this page" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
});
test("vehicles use bounded server pages, retain position across tabs and recover after removing the final item", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.vehicles = Array.from({ length: 13 }, (_, i) => ({
    ...structuredClone(savedVehicles[0]),
    id: id(800 + i),
    vehicleListing: {
      ...structuredClone(savedVehicles[0].vehicleListing),
      id: id(900 + i),
      title: `Saved vehicle ${i + 1}`,
    },
  }));
  await visit(page);
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await expect(page.locator(".saved-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Saved vehicle 13" })).toBeVisible();
  expect(state.reads.filter((p) => p.includes("saved-vehicles"))).toEqual([
    "/customers/saved-vehicles/page?limit=12",
    `/customers/saved-vehicles/page?limit=12&cursor=${id(811)}_${"a".repeat(64)}`,
  ]);
  await page.getByRole("tab", { name: "Favourite products" }).click();
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved vehicle 13" })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Saved vehicle 13 from saved vehicles" })
    .click();
  await page.getByRole("button", { name: "Remove item", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No saved vehicles on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(12);
});
test("an invalidated vehicle cursor can recover from the first page", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.vehicles = manySavedVehicles();
  await page.route("**/api/v1/customers/saved-vehicles/page?*", async (route) => {
    if (!new URL(route.request().url()).searchParams.has("cursor"))
      return route.fallback();
    return route.fulfill({
      status: 422,
      json: {
        success: false,
        message: "Invalid saved-vehicle cursor; return to the first page",
        error: { code: "VALIDATION_FAILED" },
      },
    });
  });
  await visit(page);
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator('.saved-page [role="alert"]')).toBeVisible();
  await expect(page.locator(".saved-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Return to first page" }).click();
  await expect(page.locator(".saved-card")).toHaveCount(12);
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
});

test("switching accounts drops the previous customer's vehicle page and cursor", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.vehicles = manySavedVehicles();
  await visit(page);
  await page.getByRole("tab", { name: "Saved vehicles" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved vehicle 13" })).toBeVisible();
  state.userId = id(92);
  state.vehicles = structuredClone(savedVehicles);
  state.reads.length = 0;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("heading", { name: "Saved vehicle 13" })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify session again" }).click();
  await switchVehicles(page);
  expect(state.reads.filter((p) => p.includes("saved-vehicles"))).toEqual([
    "/customers/saved-vehicles/page?limit=12",
  ]);
});

test("long item identity and large exact amounts remain readable at 320px", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.parts[0].product.name = "LongProductReference".repeat(12);
  state.parts[0].product.sku = "SKU".repeat(30);
  state.parts[0].product.priceKobo = "9007199254740993";
  await page.setViewportSize({ width: 320, height: 700 });
  await visit(page);
  await expect(page.locator(".saved-card").first()).toContainText(
    "90,071,992,547,409.93",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("image failures use the existing honest fallback", async ({ page }) => {
  const state = await savedFixture(page);
  state.brokenImages = true;
  await visit(page);
  await expect(page.getByText("Image unavailable", { exact: true })).toHaveCount(3);
});
test("duplicate records are rejected instead of rendering ambiguous controls", async ({
  page,
}) => {
  const state = await savedFixture(page);
  state.parts = [savedParts[0], savedParts[0]];
  await visit(page);
  await expect(page.locator('.saved-page [role="alert"]')).toBeVisible();
  await expect(page.locator(".saved-card")).toHaveCount(0);
});
test("short mobile removal dialog remains contained and keyboard accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await savedFixture(page);
  await visit(page);
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourites" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(
    true,
  );
  expect(
    await dialog.evaluate((node) => node.getBoundingClientRect().height <= innerHeight),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Remove Engine oil filter from favourites" }),
  ).toBeFocused();
});
test("non-customer accounts never read saved customer collections", async ({ page }) => {
  const state = await savedFixture(page);
  state.role = "ADMIN";
  await page.goto("/dashboard/saved");
  await expect(
    page.getByRole("heading", { name: "Saved items", exact: true }),
  ).toHaveCount(0);
  expect(state.reads).toEqual([]);
});
