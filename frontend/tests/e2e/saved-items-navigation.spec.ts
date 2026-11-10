import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { savedFixture, savedVehicles, id } from "../fixtures/saved-items";
import { listing } from "../fixtures/public-account-actions";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

async function setup(page: Page, request: APIRequestContext) {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Saved navigation requires the isolated public listing fixture");
  const response = await request.post(origin + "/__capabilities", {
    data: {
      mode: "browse_enquiries",
      checkoutApproved: false,
      bookingRequestsEnabled: false,
      productPurchasesEnabled: false,
      searchUnavailable: false,
    },
  });
  expect(response.ok()).toBe(true);
  const state = await savedFixture(page);
  state.vehicles = [
    {
      id: id(301),
      vehicleListing: {
        ...listing,
        vehicle: {
          ...listing.vehicle,
          images: savedVehicles[0].vehicleListing.vehicle.images,
        },
      },
    },
  ];
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: publicCapabilitiesFixture("browse_enquiries"),
        meta: { requestId: "saved-navigation" },
      },
    }),
  );
  return state;
}

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`saved navigation ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      hasTouch: width <= 768,
    });
    test("vehicle collection survives detail, Back, Forward and reload", async ({
      page,
      request,
    }, info) => {
      const state = await setup(page, request);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/dashboard/saved?source=shortlist&collection=vehicles");
      const vehicles = page.getByRole("tab", { name: "Saved vehicles", exact: true });
      const parts = page.getByRole("tab", { name: "Favourite products", exact: true });
      await expect(vehicles).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".saved-card")).toContainText(listing.title);
      expect(state.reads.some((read) => read.startsWith("/customers/favourites"))).toBe(
        false,
      );
      const open = page.getByRole("link", { name: "View vehicle", exact: true });
      await open.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/vehicles/${listing.id}$`));
      await expect(
        page.getByRole("heading", { name: "2020 Test Model", level: 1 }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .getByRole("region", { name: "2020 Test Model photos", exact: true })
            .locator("img")
            .first()
            .evaluate(
              (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
            ),
        )
        .toBe(true);
      await page.goBack();
      await expect(vehicles).toHaveAttribute("aria-selected", "true");
      await page.goForward();
      await expect(
        page.getByRole("heading", { name: "2020 Test Model", level: 1 }),
      ).toBeVisible();
      await page.goBack();
      await expect(vehicles).toHaveAttribute("aria-selected", "true");
      await page.reload();
      await expect(vehicles).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".saved-card")).toContainText(listing.title);
      expect(new URL(page.url()).searchParams.get("source")).toBe("shortlist");
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("saved-vehicle-return.png"),
        fullPage: true,
      });

      const historyLength = await page.evaluate(() => history.length);
      await vehicles.focus();
      await page.keyboard.press("Home");
      await expect(parts).toBeFocused();
      await expect(parts).toHaveAttribute("aria-selected", "true");
      expect(new URL(page.url()).searchParams.has("collection")).toBe(false);
      await page.keyboard.press("End");
      await expect(vehicles).toBeFocused();
      await expect(vehicles).toHaveAttribute("aria-selected", "true");
      expect(new URL(page.url()).searchParams.get("collection")).toBe("vehicles");
      expect(await page.evaluate(() => history.length)).toBe(historyLength);
      expect(state.writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

for (const query of [
  "collection=parts",
  "collection=orders",
  "collection=vehicles&collection=parts",
]) {
  test(`unsupported or ambiguous collection has a safe product default: ${query}`, async ({
    page,
    request,
  }) => {
    const state = await setup(page, request);
    await page.goto(`/dashboard/saved?${query}`);
    await expect(
      page.getByRole("tab", { name: "Favourite products", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: "Engine oil filter", exact: true }),
    ).toBeVisible();
    expect(state.reads.some((read) => read.startsWith("/customers/saved-vehicles"))).toBe(
      false,
    );
    expect(state.writes).toEqual([]);
  });
}

for (const outcome of ["remove", "cancel"] as const)
  test(`an open removal review stays bound to its collection through a URL change (${outcome})`, async ({
    page,
    request,
  }, info) => {
    const state = await setup(page, request);
    await page.goto("/dashboard/saved?collection=vehicles");
    await page
      .getByRole("button", { name: `Remove ${listing.title} from saved vehicles` })
      .click();
    await page.evaluate(() => window.history.replaceState(null, "", "/dashboard/saved"));
    await expect(page.getByRole("dialog")).toContainText("Saved vehicles");
    await expect(
      page.getByRole("tab", { name: "Saved vehicles", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    if (outcome === "remove")
      await page.getByRole("button", { name: "Remove item", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.writes.map((write) => write.path)).toEqual(
      outcome === "remove" ? [`/customers/saved-vehicles/${listing.id}`] : [],
    );
    await expect(
      page.getByRole("tab", { name: "Favourite products", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tab", { name: "Favourite products", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath(`saved-review-${outcome}-restored-focus.png`),
      fullPage: true,
    });
  });

test("cancelling a removal after a URL change focuses the newly selected collection", async ({
  page,
  request,
}) => {
  const state = await setup(page, request);
  await page.goto("/dashboard/saved");
  await page
    .getByRole("button", { name: "Remove Engine oil filter from favourite products" })
    .click();
  await page.evaluate(() =>
    window.history.replaceState(null, "", "/dashboard/saved?collection=vehicles"),
  );
  await expect(page.getByRole("dialog")).toContainText("Favourite products");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const selected = page.getByRole("tab", { name: "Saved vehicles", exact: true });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(selected).toBeFocused();
  await expect(
    page.getByRole("heading", { name: listing.title, exact: true }),
  ).toBeVisible();
  await expect(selected).toBeFocused();
  expect(state.writes).toEqual([]);
});

test("saving a vehicle opens its vehicle collection from the receipt", async ({
  page,
  request,
}) => {
  const state = await setup(page, request);
  await page.route(`**/api/v1/customers/saved-vehicles/${listing.id}`, async (route) => {
    const write = route.request();
    expect(write.method()).toBe("PUT");
    state.writes.push({
      path: new URL(write.url()).pathname.replace("/api/v1", ""),
      csrf: write.headers()["x-csrf-token"],
      body: write.postDataJSON(),
    });
    await route.fulfill({
      json: {
        success: true,
        data: { vehicleListingId: listing.id },
        meta: { requestId: "saved-navigation-write" },
      },
    });
  });
  await page.goto(`/vehicles/${listing.id}`);
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  const receipt = page.getByRole("link", { name: "View saved vehicles", exact: true });
  await expect(receipt).toHaveAttribute("href", "/dashboard/saved?collection=vehicles");
  await receipt.click();
  await expect(
    page.getByRole("tab", { name: "Saved vehicles", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".saved-card")).toContainText(listing.title);
  expect(state.writes).toEqual([
    { path: `/customers/saved-vehicles/${listing.id}`, csrf: "s".repeat(64), body: {} },
  ]);
});
