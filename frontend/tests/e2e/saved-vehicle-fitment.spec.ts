import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { garageFixture, garageId } from "../fixtures/customer-garage";

const make = { id: garageId(50), name: "Toyota", isActive: true };
const model = {
  id: garageId(51),
  makeId: make.id,
  name: "Corolla",
  yearFrom: 2013,
  yearTo: 2019,
  isActive: true,
  make,
};
const otherModel = {
  ...model,
  id: garageId(52),
  name: "Camry",
  yearFrom: 2016,
  yearTo: 2022,
};
const ok = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated saved-car fixture",
      meta: { requestId: "saved-car-test" },
      data,
    },
  });
async function fixture(page: Page) {
  const state = await garageFixture(page);
  Object.assign(state.records[0], {
    make: make.name,
    model: model.name,
    year: 2018,
    vehicleModelId: model.id,
    vehicleModel: model,
    nickname: null,
    isDefault: false,
    engineCode: "2ZR-FE",
    market: "Japan",
    updatedAt: "2026-10-23T12:00:00.000Z",
  });
  Object.assign(state.records[1], {
    make: make.name,
    model: otherModel.name,
    vehicleModelId: otherModel.id,
    vehicleModel: otherModel,
    nickname: "Synthetic second car",
    isDefault: false,
    updatedAt: "2026-10-23T12:00:00.000Z",
  });
  await page.route("**/api/v1/public/**", (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path.endsWith("/fitment/makes")) return ok(route, { items: [make] });
    if (path.endsWith("/fitment/models"))
      return ok(route, { items: [model, otherModel] });
    if (path.endsWith(`/fitment/models/${model.id}`)) return ok(route, model);
    if (path.endsWith(`/fitment/models/${otherModel.id}`)) return ok(route, otherModel);
    if (path.endsWith("/catalog/products/discovery"))
      return ok(route, {
        items: [],
        totalMatches: 0,
        ...(url.searchParams.has("vehicleModelId") ? { verifiedMatches: 0 } : {}),
      });
    return ok(route, { items: [] });
  });
  await page.route("**/customers/vehicles?**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("defaultOnly") === "true")
      return ok(route, { vehicles: state.records.filter((record) => record.isDefault) });
    return route.fallback();
  });
  return state;
}

for (const width of [1440, 390])
  test(`saved configuration, default and parts selection work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dashboard/vehicles");
    await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
    await page
      .getByLabel("Nickname (optional)", { exact: true })
      .fill("Synthetic daily driver");
    await page
      .getByRole("checkbox", {
        name: "Use as my default vehicle for parts searches",
        exact: true,
      })
      .check();
    await expect(
      page.getByRole("checkbox", {
        name: "Set up this vehicle for Shop searches",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByText("More details to help check a part (optional)", { exact: true })
      .click();
    await page.getByLabel("Engine code (optional)", { exact: true }).fill("2ZR-FE");
    expect(
      (await new AxeBuilder({ page }).include(".garage-dialog").analyze()).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Default vehicle", { exact: true })).toBeVisible();
    expect(state.writes[0]).toMatchObject({
      method: "PATCH",
      body: {
        nickname: "Synthetic daily driver",
        isDefault: true,
        vehicleModelId: model.id,
        engineCode: "2ZR-FE",
        expectedUpdatedAt: "2026-10-23T12:00:00.000Z",
      },
    });
    const find = page
      .getByRole("link", { name: "Find parts for this vehicle", exact: true })
      .first();
    const href = await find.getAttribute("href");
    expect(href).toContain(`vehicleModelId=${model.id}`);
    expect(href).not.toMatch(/vin|registration|nickname|customerId|daily.driver/i);
    await find.click();
    await expect(
      page.getByRole("heading", { name: "Find products for my vehicle", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Your vehicle configurations", { exact: true }),
    ).toHaveValue(garageId(1));
    await page
      .getByRole("button", { name: "Clear selected vehicle", exact: true })
      .click();
    await expect(page).toHaveURL(/\/parts$/);
    await page.getByRole("radio", { name: "Find Parts for My Car", exact: true }).check();
    await page.getByRole("button", { name: "Use this vehicle", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`vehicleModelId=${model.id}`));
    await expect(
      page.getByRole("combobox", { name: "Vehicle model", exact: true }),
    ).toHaveValue("Corolla");
    await page
      .getByLabel("Your vehicle configurations", { exact: true })
      .selectOption(garageId(2));
    await page.getByRole("button", { name: "Use this vehicle", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`vehicleModelId=${otherModel.id}`));
    await expect(
      page.getByRole("combobox", { name: "Vehicle model", exact: true }),
    ).toHaveValue("Camry");
    expect(new URL(page.url()).search).not.toMatch(
      /JTDBR|RIV|nickname|customerId|Synthetic/,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".parts-car-finder")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`saved-vehicle-${width}.png`) });
    expect(state.writes).toHaveLength(1);
    expect(errors).toEqual([]);
  });

test("default is available beyond page one and a failed fresh owned read never applies stale configuration", async ({
  page,
}) => {
  const state = await fixture(page);
  state.records[0].isDefault = true;
  await page.route("**/customers/vehicles?**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("defaultOnly") === "true") return route.fallback();
    return ok(route, { vehicles: [state.records[1]], nextCursor: garageId(2) });
  });
  await page.goto("/parts");
  await page.getByRole("radio", { name: "Find Parts for My Car", exact: true }).check();
  await expect(
    page.getByLabel("Your vehicle configurations", { exact: true }),
  ).toHaveValue(garageId(1));
  await page.route(`**/customers/vehicles/${garageId(1)}`, (route) =>
    route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    }),
  );
  await page.getByRole("button", { name: "Use this vehicle", exact: true }).click();
  await expect(page.getByText(/This saved vehicle could not be verified/)).toBeVisible();
  await expect(page).toHaveURL(/\/parts$/);
  expect(state.writes).toEqual([]);
});

test("an unlinked garage car can choose a real catalogue model without inventing unknown specifications", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Set up parts search", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Set up this vehicle for Shop searches", exact: true })
    .check();
  await page
    .getByRole("combobox", { name: "Make for Shop searches", exact: true })
    .click();
  await page.getByRole("option", { name: "Toyota", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Model for Shop searches", exact: true })
    .click();
  await page.getByRole("option", { name: "Corolla", exact: true }).click();
  await page.getByLabel("Year (required)", { exact: true }).fill("2018");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "PATCH",
    path: `/customers/vehicles/${garageId(3)}`,
    body: {
      make: "Toyota",
      model: "Corolla",
      year: 2018,
      vehicleModelId: model.id,
      engineCode: null,
      market: null,
      brakeSystem: null,
    },
  });
});

test("session changes discard owned vehicle choices and suppress a late preflight response", async ({
  page,
}) => {
  const state = await fixture(page);
  state.records[0].isDefault = true;
  let signedIn = true,
    release!: () => void;
  await page.route("**/auth/session", (route) =>
    signedIn
      ? route.fallback()
      : route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        }),
  );
  await page.goto("/parts");
  await page.getByRole("radio", { name: "Find Parts for My Car", exact: true }).check();
  await expect(
    page.getByLabel("Your vehicle configurations", { exact: true }),
  ).toHaveValue(garageId(1));
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(`**/customers/vehicles/${garageId(1)}`, async (route) => {
    started = true;
    await hold;
    await ok(route, state.records[0]);
  });
  await page.getByRole("button", { name: "Use this vehicle", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByLabel("Your vehicle configurations", { exact: true }),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("link", { name: "Sign in to reuse a saved vehicle", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/parts$/);
  expect(state.writes).toEqual([]);
});

test("a late saved-vehicle read cannot overwrite a newer parts search", async ({
  page,
}) => {
  const state = await fixture(page);
  state.records[0].isDefault = true;
  let release!: () => void,
    started = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/customers/vehicles/${garageId(1)}`, async (route) => {
    started = true;
    await hold;
    await ok(route, state.records[0]);
  });
  await page.goto("/parts");
  await page.getByRole("radio", { name: "Find Parts for My Car", exact: true }).check();
  await page.getByRole("button", { name: "Use this vehicle", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page
    .getByRole("searchbox", { name: "Search products", exact: true })
    .fill("brake");
  await expect(page).toHaveURL(/search=brake/);
  release();
  await expect(
    page.getByText(/Your search changed while checking the saved vehicle/),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("vehicleModelId")).toBe(false);
  expect(state.writes).toEqual([]);
});
