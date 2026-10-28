import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { garageFixture, garageId } from "../fixtures/customer-garage";
import { privacyFixture, privacyRecord } from "../fixtures/customer-privacy";

for (const width of [390, 1440]) {
  test(`garage basic entry and optional search disclosure at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await garageFixture(page);
    await page.goto("/dashboard/vehicles");
    await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const setup = dialog.locator(".garage-search-setup");
    const summary = setup.locator("summary").first();
    await expect(summary).toHaveText("Use this vehicle in Shop searches (optional)");
    expect(await setup.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await page.getByLabel("Make (required)", { exact: true }).fill("Honda");
    await page.getByLabel("Model (required)", { exact: true }).fill("Civic");
    await page.getByLabel("Year (required)", { exact: true }).fill("2020");
    await page.getByLabel("Nickname (optional)", { exact: true }).fill("My daily car");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(
      setup.getByText(/The details above are enough to save your vehicle/),
    ).toBeVisible();
    expect(await summary.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      "none",
    );
    await summary.hover();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Make (required)", { exact: true })).toHaveValue(
      "Honda",
    );
    await expect(page.getByLabel("Nickname (optional)", { exact: true })).toHaveValue(
      "My daily car",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`garage-basic-${width}.png`) });
    await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toMatchObject({
      make: "Honda",
      model: "Civic",
      year: 2020,
      nickname: "My daily car",
      vehicleModelId: null,
      engineCode: null,
    });
  });

  test(`privacy approval explains review, execution and follow-up at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await privacyFixture(page);
    state.items = [privacyRecord(10, "APPROVED_PENDING_POLICY")];
    await page.goto("/dashboard/privacy");
    await expect(
      page.getByRole("heading", { name: "What happens to your request", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".cpv-guidance")).toContainText(
      "An authorised privacy reviewer",
    );
    await expect(page.locator(".cpv-guidance")).toContainText(
      "does not currently perform or schedule it",
    );
    await expect(page.locator(".cpv-policy")).toContainText(
      "Your information has not been deleted or anonymized",
    );
    await expect(page.locator(".cpv-policy")).toContainText(
      "execution needs a separate approved process",
    );
    const next = page.getByRole("link", {
      name: "Ask Customer Care about the next step",
      exact: true,
    });
    await expect(next).toHaveAttribute("href", "/dashboard/support");
    const reason = page.getByLabel("Why are you making this request?");
    await reason.fill("Please explain the next step for my existing privacy request.");
    await next.focus();
    expect(await next.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
      "none",
    );
    await next.hover();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`privacy-next-step-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/support$/);
    await page.goBack();
    await expect(reason).toHaveValue(
      "Please explain the next step for my existing privacy request.",
    );
    expect(state.writes).toHaveLength(0);
  });
}

test("direct search setup opens, preserves basic details on unavailable options, and reveals invalid fields before focusing", async ({
  page,
}) => {
  const state = await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  await page
    .getByRole("button", { name: "Set up parts search", exact: true })
    .first()
    .click();
  const setup = page.locator(".garage-search-setup");
  expect(await setup.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
  const choice = page.getByRole("checkbox", {
    name: "Set up this vehicle for Shop searches",
    exact: true,
  });
  await choice.check();
  await page
    .getByRole("combobox", { name: "Make for Shop searches", exact: true })
    .click();
  await expect(page.getByText(/No matching/)).toBeVisible();
  await setup.locator("summary").first().click();
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Make for Shop searches", exact: true }),
  ).toBeFocused();
  expect(await setup.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
  expect(state.writes).toHaveLength(0);
  await choice.uncheck();
  await expect(page.getByLabel("Make (required)", { exact: true })).toHaveValue("Toyota");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({
    make: "Toyota",
    model: "Camry",
    vehicleModelId: null,
  });
});

test("an existing linked vehicle opens search setup and toggling preserves its specification draft until saving", async ({
  page,
}) => {
  const state = await garageFixture(page);
  const make = { id: garageId(50), name: "Toyota", isActive: true };
  const model = {
    id: garageId(51),
    name: "Camry",
    makeId: make.id,
    make,
    yearFrom: 2016,
    yearTo: 2022,
    isActive: true,
  };
  Object.assign(state.records[0], {
    vehicleModelId: model.id,
    vehicleModel: model,
    engineCode: "2AR-FE",
  });
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
  const setup = page.locator(".garage-search-setup");
  expect(await setup.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
  const choice = page.getByRole("checkbox", {
    name: "Set up this vehicle for Shop searches",
    exact: true,
  });
  await page
    .getByText("More details to help check a part (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Engine code (optional)", { exact: true })
    .fill("My checked engine code");
  await choice.uncheck();
  await expect(setup).toContainText("removes the Shop search link");
  await choice.check();
  await page
    .getByText("More details to help check a part (optional)", { exact: true })
    .click();
  await expect(page.getByLabel("Engine code (optional)", { exact: true })).toHaveValue(
    "My checked engine code",
  );
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({
    vehicleModelId: model.id,
    engineCode: "My checked engine code",
  });
});
