import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { garageFixture, garageId } from "../fixtures/customer-garage";

test("desktop footer link stays clear of the floating support control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1506, height: 1045 });
  await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  const support = page
    .locator(".garage-footer")
    .getByRole("link", { name: "Contact support" });
  await expect(support).toBeVisible();
  expect(
    await support.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.right - 3,
        bounds.y + bounds.height / 2,
      );
      return hit === element || (hit !== null && element.contains(hit));
    }),
  ).toBe(true);
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`garage list and dialog fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await garageFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dashboard/vehicles");
    await expect(page.locator(".garage-record")).toHaveCount(3);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb", exact: true })
        .locator('[aria-current="page"]'),
    ).toHaveText("My vehicles");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    for (const button of await page
      .locator(".customer-garage button:visible,.garage-record a")
      .all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(43.9);
    }
    await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Make (required)", { exact: true })).toBeFocused();
    expect(
      await page.getByRole("dialog").evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
    const save = await page
      .getByRole("button", { name: "Save vehicle", exact: true })
      .boundingBox();
    expect(save!.y + save!.height).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#garage-add")).toBeFocused();
    expect(errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
for (const width of [390, 768, 1280, 1440])
  test(`garage list, edit and removal accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await garageFixture(page);
    await page.goto("/dashboard/vehicles");
    await expect(page.locator(".garage-record")).toHaveCount(3);
    const axe = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
    expect((await axe()).violations).toEqual([]);
    await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
    expect((await axe()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Keep vehicle" })).toBeFocused();
    expect((await axe()).violations).toEqual([]);
  });
test("create and edit normalize fields, preserve zero and send one CSRF mutation", async ({
  page,
}) => {
  const state = await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
  await page.getByLabel("Make (required)", { exact: true }).fill("  Honda  ");
  await page.getByLabel("Model (required)", { exact: true }).fill(" Civic ");
  await page.getByLabel("Year (required)", { exact: true }).fill("2020");
  await page.getByLabel("Registration (optional)").fill(" abc 12 ");
  await page.getByLabel("Mileage in km (optional)").fill("0");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".garage-record")).toHaveCount(4);
  await expect(page.locator(".garage-record").last()).toContainText("0 km");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    make: "Honda",
    model: "Civic",
    year: 2020,
    registrationNumber: "ABC 12",
    vin: null,
    color: null,
    mileageKm: 0,
  });
  expect(state.writes[0].csrf).toBeTruthy();
  await page.getByRole("button", { name: "Edit details", exact: true }).last().click();
  await expect(page.getByLabel("Make (required)", { exact: true })).toHaveValue("Honda");
  await page.getByLabel("Colour (optional)").fill("Blue");
  await page.getByLabel("Registration (optional)").fill("");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".garage-record").last()).toContainText("Blue");
  expect(state.writes[1]).toMatchObject({
    method: "PATCH",
    path: `/customers/vehicles/${garageId(10)}`,
    body: { registrationNumber: null, color: "Blue" },
  });
});
test("validation focuses invalid fields and does not submit", async ({ page }) => {
  const state = await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
  await page.getByLabel("Make (required)", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByText("Enter the make.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Make (required)", { exact: true })).toBeFocused();
  await page.getByLabel("Make (required)", { exact: true }).fill("Toyota");
  await page.getByLabel("Model (required)", { exact: true }).fill("Camry");
  await page.getByLabel("Year (required)", { exact: true }).fill("2020.5");
  await page.getByLabel("VIN (optional)", { exact: true }).fill("IIIIIIIIIIIIIIIII");
  await page.getByLabel("Mileage in km (optional)").fill("-1");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByText(/Enter a whole year/)).toBeVisible();
  await expect(page.getByText(/Enter a 17-character VIN without/)).toBeVisible();
  await expect(page.getByText(/Enter a whole number from 0/)).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("remove requires confirmation and restores focus", async ({ page }) => {
  const state = await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  const remove = page.getByRole("button", { name: "Remove", exact: true }).first();
  await remove.click();
  await expect(page.getByRole("dialog")).toContainText("including its saved photos");
  await page.getByRole("button", { name: "Keep vehicle" }).click();
  await expect(remove).toBeFocused();
  expect(state.writes).toEqual([]);
  await remove.click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.locator(".garage-record")).toHaveCount(2);
  expect(state.writes[0]).toMatchObject({
    method: "DELETE",
    path: `/customers/vehicles/${garageId(1)}`,
    body: {},
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("pending save prevents duplicate requests and Escape closure", async ({ page }) => {
  const state = await garageFixture(page);
  state.mutation = "hold";
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saving" })).toBeDisabled();
  state.mutation = "normal";
  state.releaseMutation?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
for (const mutation of ["error", "wrong-identity"])
  test(`${mutation} never claims save success or retries automatically`, async ({
    page,
  }) => {
    const state = await garageFixture(page);
    state.mutation = mutation;
    await page.goto("/dashboard/vehicles");
    await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
    await page.getByRole("button", { name: "Save vehicle" }).click();
    await expect(page.getByRole("dialog")).toContainText("We couldn't confirm the save");
    await expect(page.getByRole("button", { name: "Save vehicle" })).toBeDisabled();
    await page.getByRole("button", { name: "Close and review vehicles" }).click();
    await expect(page.locator(".garage-record")).toHaveCount(3);
    await expect.poll(() => state.reads.length).toBeGreaterThan(1);
    expect(state.writes).toHaveLength(1);
    await expect(page.getByText("Vehicle details saved.", { exact: true })).toHaveCount(
      0,
    );
  });
test("server rejection retains edits and allows correction", async ({ page }) => {
  const state = await garageFixture(page);
  state.mutation = "reject";
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
  await page.getByLabel("Colour (optional)").fill("Blue");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Colour (optional)")).toHaveValue("Blue");
  state.mutation = "normal";
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".garage-record").first()).toContainText("Blue");
});
test("uncertain removal requires reread", async ({ page }) => {
  const state = await garageFixture(page);
  state.mutation = "error";
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByRole("dialog")).toContainText("Removal could not be confirmed");
  await expect(page.getByRole("button", { name: "Confirm removal" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect.poll(() => state.reads.length).toBeGreaterThan(1);
  expect(state.writes).toHaveLength(1);
});
test("cursor traversal survives reload and history; invalid scope is stripped", async ({
  page,
}) => {
  const state = await garageFixture(page);
  state.next = true;
  await page.goto(`/dashboard/vehicles?limit=10&customerId=${garageId(99)}&q=Toyota`);
  await expect(page.locator(".garage-record")).toHaveCount(3);
  expect([...state.reads[0].searchParams.keys()]).toEqual(["limit"]);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".garage-record")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".garage-record")).toHaveCount(1);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".garage-record")).toHaveCount(3);
  await page.goBack();
  await expect(page.locator(".garage-record")).toHaveCount(1);
  await page.getByLabel("Rows per page").selectOption("50");
  await expect(page.locator(".garage-record")).toHaveCount(3);
  expect(state.reads.at(-1)?.searchParams.has("_trail")).toBe(false);
  expect(state.reads.at(-1)?.searchParams.has("cursor")).toBe(false);
});
test("empty, loading and later-page recovery", async ({ page }) => {
  const state = await garageFixture(page);
  state.mode = "hold";
  await page.goto(`/dashboard/vehicles?cursor=${garageId(3)}`);
  await expect(page.getByLabel("Loading vehicles")).toBeVisible();
  await expect(page.locator("#garage-add")).toBeDisabled();
  state.mode = "empty";
  await expect.poll(() => !!state.held).toBe(true);
  state.held?.();
  await expect(
    page.getByRole("heading", { name: "No vehicles on this page" }),
  ).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "First page", exact: true }).first().click();
  await expect(page.locator(".garage-record")).toHaveCount(3);
  state.mode = "empty";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your garage is empty" })).toBeVisible();
  await page.getByRole("button", { name: "Add your first vehicle" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
for (const mode of ["error", "malformed"])
  test(`${mode} hides previous records and recovers`, async ({ page }) => {
    const state = await garageFixture(page);
    await page.goto("/dashboard/vehicles");
    await expect(page.locator(".garage-record")).toHaveCount(3);
    state.mode = mode;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "We couldn't load your vehicles" }),
    ).toBeVisible();
    await expect(page.locator(".garage-record")).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry vehicles" }).click();
    await expect(page.locator(".garage-record")).toHaveCount(3);
  });
test("background failure labels retained rows and disables edits", async ({ page }) => {
  const state = await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  await expect(page.locator(".garage-record")).toHaveCount(3);
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/These details may be out of date/)).toBeVisible();
  await expect(page.locator(".garage-record")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }).first(),
  ).toBeDisabled();
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry vehicles" }).click();
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }).first(),
  ).toBeEnabled();
});
test("session change clears private dialog and late mutation feedback", async ({
  page,
}) => {
  const state = await garageFixture(page);
  state.mutation = "hold";
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect.poll(() => !!state.releaseMutation).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.mutation = "normal";
  state.releaseMutation?.();
  await expect(page.locator(".garage-record")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Vehicle details saved.", { exact: true })).toHaveCount(0);
});
for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} cannot access the customer garage`, async ({ page }) => {
    const state = await garageFixture(page, role);
    await page.goto("/dashboard/vehicles");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await expect(page.locator(".customer-garage")).toHaveCount(0);
    expect(state.reads).toEqual([]);
  });
test("long values, zero mileage and missing fields fit narrow records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  const state = await garageFixture(page);
  state.records[0].make = "M".repeat(80);
  state.records[0].model = "N".repeat(80);
  state.records[0].mileageKm = 0;
  await page.goto("/dashboard/vehicles");
  await expect(page.locator(".garage-record").first()).toContainText("0 km");
  await expect(page.locator(".garage-record").last()).toContainText("Not provided");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("short modal has reachable footer, scrollable fields and keyboard containment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await garageFixture(page);
  await page.goto("/dashboard/vehicles");
  await page.getByRole("button", { name: "Add a vehicle", exact: true }).click();
  const body = page.locator(".garage-dialog-body");
  expect(await body.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  await page.getByLabel("Mileage in km (optional)").fill("123");
  await expect(page.getByLabel("Mileage in km (optional)")).toBeInViewport();
  await page.getByRole("button", { name: "Save vehicle" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close vehicle dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Save vehicle" })).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("photo action links to real detail without eager media requests", async ({
  page,
}) => {
  await garageFixture(page);
  const reads: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/customers/vehicles/")) reads.push(r.url());
  });
  await page.goto("/dashboard/vehicles");
  const photo = page.getByRole("link", { name: "Manage photos for 2021 Toyota Camry" });
  await expect(photo).toHaveAttribute("href", `/dashboard/vehicles/${garageId(1)}`);
  expect(reads).toEqual([]);
  await photo.click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/vehicles/${garageId(1)}`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => reads.length).toBeGreaterThan(0);
});
