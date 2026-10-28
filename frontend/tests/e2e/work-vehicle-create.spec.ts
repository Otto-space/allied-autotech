import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { workVehicleCreateFixture, bookingId } from "../fixtures/work-vehicle-create";
import { stockCreationStorageKey } from "@/lib/admin/vehicle-stock-creation";
test("an active branch chosen from a later choice page restores with its real name", async ({
  page,
}) => {
  await workVehicleCreateFixture(page);
  await page.route("**/api/v1/admin/branches**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/v1/admin/branches") return route.fallback();
    const later = url.searchParams.has("cursor");
    return route.fulfill({
      json: {
        success: true,
        message: "Branch page",
        meta: { requestId: "branch-reload" },
        data: {
          items: [
            {
              id: bookingId(later ? 103 : 101),
              name: later ? "Remote workshop" : "Stadium Road workshop",
              isActive: true,
            },
          ],
          ...(later ? {} : { nextCursor: bookingId(101) }),
        },
      },
    });
  });
  await open(page);
  await page
    .getByRole("navigation", { name: "Branch choices pages", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByLabel("Workshop branch", { exact: true }).selectOption(bookingId(103));
  await page.getByLabel("Stock number", { exact: true }).fill("OFF-PAGE");
  await page.reload();
  await expect(page.getByLabel("Workshop branch", { exact: true })).toHaveValue(
    bookingId(103),
  );
  await expect(page.locator("#vehicle-record-branch option:checked")).toHaveText(
    "Remote workshop",
  );
  await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue("OFF-PAGE");
});
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
test("Customer cannot load a stock creation form or submit a vehicle", async ({
  page,
}) => {
  const { state } = await workVehicleCreateFixture(page, "CUSTOMER");
  await page.goto("/admin/vehicles/new");
  await expect.poll(() => /\/(dashboard|login)/.test(page.url())).toBe(true);
  await expect(page.getByLabel("Stock number", { exact: true })).toHaveCount(0);
  expect(state.posts).toHaveLength(0);
});
test("Staff without an assignment cannot open creation fields", async ({ page }) => {
  const { state, stock } = await workVehicleCreateFixture(page, "STAFF");
  stock.state.profileBranch = null;
  await page.goto("/admin/vehicles/new");
  await expect(button(page, "Refresh staff profile")).toBeVisible();
  await expect(button(page, "Review new vehicle")).toHaveCount(0);
  expect(state.posts).toHaveLength(0);
});
test("profile failure blocks creation and can be retried without losing scope", async ({
  page,
}) => {
  const { stock, state } = await workVehicleCreateFixture(page);
  stock.state.profileMode = "error";
  await page.goto("/admin/vehicles/new");
  await expect(button(page, "Retry creation access")).toBeVisible();
  await expect(button(page, "Review new vehicle")).toHaveCount(0);
  stock.state.profileMode = "normal";
  await button(page, "Retry creation access").click();
  await expect(button(page, "Review new vehicle")).toBeVisible();
  expect(state.posts).toHaveLength(0);
});
async function open(p: Page) {
  await p.goto("/admin/vehicles/new");
  await expect(button(p, "Review new vehicle")).toBeVisible();
}
async function fill(p: Page, staff = false) {
  if (!staff)
    await p.getByLabel("Workshop branch", { exact: true }).selectOption(bookingId(101));
  await p.getByLabel("Stock number", { exact: true }).fill("new-vehicle-01");
  await p.getByLabel("Make", { exact: true }).fill("Toyota");
  await p.getByLabel("Model", { exact: true }).fill("Camry");
  await p.getByLabel("Model year", { exact: true }).fill("2022");
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} reviews all permitted facts, cancels, then creates exactly once and opens photos`, async ({
    page,
  }) => {
    const { state } = await workVehicleCreateFixture(page, role);
    await open(page);
    await fill(page, role === "STAFF");
    await page.getByLabel("Mileage (optional, km)").fill("0");
    await page.getByLabel("VIN (optional)").fill("1hgcm82633a004352");
    await page.getByLabel("Acquired at (optional, Lagos time)").fill("2026-10-17T10:00");
    if (role !== "STAFF")
      await page.getByLabel("Acquisition cost (optional, NGN)").fill("99999999999999.99");
    else await expect(page.getByLabel("Acquisition cost (optional, NGN)")).toHaveCount(0);
    await button(page, "Review new vehicle").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".spec-row")).toHaveCount(role === "STAFF" ? 25 : 26);
    await expect(dialog.getByText("0 km", { exact: true })).toBeVisible();
    await expect(dialog.getByText("1HGCM82633A004352", { exact: true })).toBeVisible();
    expect(state.posts).toHaveLength(0);
    await button(page, "Go back").click();
    await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue(
      "new-vehicle-01",
    );
    await button(page, "Review new vehicle").click();
    await button(page, "Confirm change").dblclick();
    await expect(page).toHaveURL(
      new RegExp(`/admin/vehicles/${bookingId(9000)}#vehicle-photos$`),
    );
    await expect(page.locator("#vehicle-photos")).toBeFocused();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0]).toMatchObject({
      stockNumber: "NEW-VEHICLE-01",
      mileageKm: 0,
      vin: "1HGCM82633A004352",
      acquiredAt: "2026-10-17T10:00:00+01:00",
    });
    if (role === "STAFF")
      expect(state.posts[0]).not.toHaveProperty("acquisitionCostKobo");
    else expect(state.posts[0].acquisitionCostKobo).toBe("9999999999999999");
  });
test("required and invalid data stay in the form and focus the first error", async ({
  page,
}) => {
  const { state } = await workVehicleCreateFixture(page);
  await open(page);
  await button(page, "Review new vehicle").click();
  await expect(page.getByLabel("Workshop branch", { exact: true })).toBeFocused();
  await fill(page);
  await page.getByLabel("VIN (optional)").fill("invalid");
  await button(page, "Review new vehicle").click();
  await expect(page.getByLabel("VIN (optional)")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.posts).toHaveLength(0);
});
test("form draft survives reload and a definite rejection without replay", async ({
  page,
}) => {
  const { state } = await workVehicleCreateFixture(page);
  await open(page);
  await fill(page);
  await page.getByLabel("Colour (optional)").fill("Red");
  await page.reload();
  await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue(
    "new-vehicle-01",
  );
  await expect(page.getByLabel("Workshop branch", { exact: true })).toHaveValue(
    bookingId(101),
  );
  state.mode = "reject";
  await button(page, "Review new vehicle").click();
  await button(page, "Confirm change").click();
  await expect(button(page, "Confirm change")).toBeDisabled();
  await button(page, "Go back").click();
  await expect(page.getByLabel("Colour (optional)")).toHaveValue("Red");
  await expect(button(page, "Review new vehicle")).toBeEnabled();
  expect(state.posts).toHaveLength(1);
});
for (const mode of [
  "lost",
  "malformed",
  "mismatch",
  "timeout",
  "throttle",
  "unavailable",
])
  test(`${mode} remains locked after reload and requires explicit manual reconciliation`, async ({
    page,
  }) => {
    const { state } = await workVehicleCreateFixture(page);
    state.mode = mode;
    await open(page);
    await fill(page);
    await button(page, "Review new vehicle").click();
    await button(page, "Confirm change").click();
    await expect(button(page, "Confirm change")).toBeDisabled();
    await button(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", { name: "Vehicle creation needs reconciliation" }),
    ).toBeVisible();
    await expect(button(page, "Review new vehicle")).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Vehicle creation needs reconciliation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Check vehicle stock", exact: true }),
    ).toHaveAttribute("href", "/admin/vehicles?search=NEW-VEHICLE-01");
    expect(state.posts).toHaveLength(1);
    await expect(button(page, "Start another vehicle draft")).toBeDisabled();
    await page.getByRole("checkbox").check();
    await button(page, "Start another vehicle draft").click();
    await expect(button(page, "Review new vehicle")).toBeVisible();
    await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue("");
    expect(state.posts).toHaveLength(1);
  });
test("Staff acquisition leak in a success response never confirms creation", async ({
  page,
}) => {
  const { state } = await workVehicleCreateFixture(page, "STAFF");
  state.mode = "leak";
  await open(page);
  await fill(page, true);
  await button(page, "Review new vehicle").click();
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await expect(
    page.getByRole("heading", { name: "Vehicle creation needs reconciliation" }),
  ).toBeVisible();
  expect(state.posts).toHaveLength(1);
});
for (const phase of ["review", "confirm"])
  test(`inactive branch at ${phase} prevents POST`, async ({ page }) => {
    const { state } = await workVehicleCreateFixture(page);
    await open(page);
    await fill(page);
    if (phase === "confirm") await button(page, "Review new vehicle").click();
    state.branchMode = "inactive";
    await button(
      page,
      phase === "review" ? "Review new vehicle" : "Confirm change",
    ).click();
    if (phase === "review")
      await expect(page.getByRole("main").getByRole("alert")).toContainText("not sent");
    else
      await expect(page.getByRole("dialog")).toContainText("No vehicle request was sent");
    expect(state.posts).toHaveLength(0);
  });
test("a changed Staff assignment prevents an old branch draft from being submitted", async ({
  page,
}) => {
  const { state, stock } = await workVehicleCreateFixture(page, "STAFF");
  await open(page);
  await fill(page, true);
  await button(page, "Review new vehicle").click();
  stock.state.profileBranch = bookingId(103);
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No vehicle request was sent");
  expect(state.posts).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel("Stock number", { exact: true })).toHaveValue("");
});
test("unavailable recovery storage prevents POST", async ({ page }) => {
  const { state } = await workVehicleCreateFixture(page);
  await open(page);
  await fill(page);
  await button(page, "Review new vehicle").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:stock-create:")) throw Error("Storage disabled");
      return original.call(this, key, value);
    };
  });
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No vehicle request was sent");
  expect(state.posts).toHaveLength(0);
});
test("corrupt stored state stays locked until manual acknowledgement", async ({
  page,
}) => {
  await workVehicleCreateFixture(page);
  await page.addInitScript(
    (key) => sessionStorage.setItem(key, "corrupt"),
    stockCreationStorageKey(bookingId(302), "ADMIN"),
  );
  await page.goto("/admin/vehicles/new");
  await expect(
    page.getByRole("heading", { name: "Vehicle creation needs reconciliation" }),
  ).toBeVisible();
  await expect(button(page, "Start another vehicle draft")).toBeDisabled();
});
test("responsive groups and long review preserve all fields with accessible keyboard focus", async ({
  page,
}) => {
  await workVehicleCreateFixture(page);
  await open(page);
  await fill(page);
  await page.getByLabel("Make", { exact: true }).fill("M".repeat(80));
  await page.getByLabel("Model", { exact: true }).fill("V".repeat(80));
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.locator(".vc-group")).toHaveCount(4);
    await page.getByLabel("Stock number", { exact: true }).focus();
    await expect(page.getByLabel("Stock number", { exact: true })).toHaveCSS(
      "outline-width",
      "3px",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join("C:/Users/PC/.codex", `work-vehicle-create-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 950 });
  await button(page, "Review new vehicle").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page
    .getByRole("region", { name: "Review details" })
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByRole("dialog").getByText("Acquired at", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "C:/Users/PC/.codex/work-vehicle-create-review-320.png",
    fullPage: true,
  });
});
