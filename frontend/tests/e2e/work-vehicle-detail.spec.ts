import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workVehicleDetailFixture, bookingId } from "../fixtures/work-vehicle-detail";
const open = async (page: Page) => {
  await page.goto(`/admin/vehicles/${bookingId(7000)}`);
  await expect(
    page.getByRole("heading", { name: "2022 Toyota Camry", exact: true }),
  ).toBeVisible();
};
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const editor = async (page: Page) => {
  await page.getByText("Edit vehicle specifications", { exact: true }).click();
};
const review = async (page: Page) => {
  await btn(page, "Review vehicle changes").click();
  await expect(page.getByRole("dialog")).toBeVisible();
};
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} sees complete scoped facts and exact values`, async ({ page }) => {
    const f = await workVehicleDetailFixture(page, role);
    await open(page);
    const main = page.locator(".work-vehicle-detail");
    await expect(main).toContainText("0 km");
    await expect(main).toContainText("Pearl White");
    await expect(main).toContainText("10:00:37.123");
    await expect(main).toContainText("JTNBE46KX73000001");
    await expect(main).toContainText("No");
    await expect(main).toContainText("Not recorded");
    await expect(
      page.getByRole("link", { name: "View public listing", exact: true }),
    ).toHaveAttribute("href", `/vehicles/${bookingId(7100)}`);
    await expect(
      main.getByText("Internal acquisition cost", { exact: true }),
    ).toHaveCount(role === "STAFF" ? 0 : 1);
    await editor(page);
    await expect(
      page.getByLabel("Acquisition cost (optional, NGN)", { exact: true }),
    ).toHaveCount(role === "STAFF" ? 0 : 1);
    expect(f.detail.writes).toHaveLength(0);
  });
test("profile gate waits before detail reads and recovers", async ({ page }) => {
  const f = await workVehicleDetailFixture(page);
  f.state.profileMode = "hold";
  await page.goto(`/admin/vehicles/${bookingId(7000)}`);
  await expect(page.getByText("Checking vehicle access…", { exact: true })).toBeVisible();
  expect(f.detail.reads).toBe(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry vehicle access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry vehicle access").click();
  await expect(
    page.getByRole("heading", { name: "2022 Toyota Camry", exact: true }),
  ).toBeVisible();
});
for (const mode of ["mismatch", "malformed", "denied", "missing"])
  test(`detail ${mode} cannot display private record`, async ({ page }) => {
    const f = await workVehicleDetailFixture(page);
    f.detail.mode = mode;
    await page.goto(`/admin/vehicles/${bookingId(7000)}`);
    await expect(btn(page, "Retry vehicle record")).toBeVisible();
    await expect(page.getByText("JTNBE46KX73000001", { exact: true })).toHaveCount(0);
    expect(f.detail.writes).toHaveLength(0);
  });
test("Staff rejects foreign branch and leaked internal cost", async ({ page }) => {
  const f = await workVehicleDetailFixture(page, "STAFF");
  f.detail.record.branchId = bookingId(102);
  f.detail.record.branch.id = bookingId(102);
  await page.goto(`/admin/vehicles/${bookingId(7000)}`);
  await expect(btn(page, "Retry vehicle record")).toBeVisible();
  await expect(page.getByText("JTNBE46KX73000001", { exact: true })).toHaveCount(0);
  f.detail.record.branchId = bookingId(101);
  f.detail.record.branch.id = bookingId(101);
  f.detail.mode = "leak";
  await btn(page, "Retry vehicle record").click();
  await expect(btn(page, "Retry vehicle record")).toBeVisible();
  await expect(page.getByText("JTNBE46KX73000001", { exact: true })).toHaveCount(0);
});
test("full review cancels safely then sends one exact update", async ({ page }) => {
  const f = await workVehicleDetailFixture(page);
  await open(page);
  await editor(page);
  await page.getByLabel("Colour (optional)", { exact: true }).fill("Deep Blue");
  await review(page);
  await expect(page.getByRole("dialog")).toContainText("99,999,999,999,999.99");
  await expect(page.getByRole("dialog")).toContainText("10:00:37.123");
  await btn(page, "Go back").click();
  expect(f.detail.writes).toHaveLength(0);
  await review(page);
  f.detail.writeMode = "hold";
  await confirm(page).click();
  await expect.poll(() => f.detail.writes.length).toBe(1);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  f.detail.writeMode = "normal";
  f.detail.held?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes[0]).toMatchObject({
    expectedVersion: 0,
    color: "Deep Blue",
    acquiredAt: "2026-10-17T09:00:37.123Z",
    acquisitionCostKobo: "9999999999999999",
  });
  await expect(page.locator(".vd-facts")).toContainText("Deep Blue");
  await expect(btn(page, "Review vehicle changes")).toBeEnabled();
});
test("fresh preflight catches concurrent record and preserves draft until explicit reload", async ({
  page,
}) => {
  const f = await workVehicleDetailFixture(page);
  await open(page);
  await editor(page);
  await page.getByLabel("Colour (optional)", { exact: true }).fill("My draft");
  await review(page);
  f.detail.record.version = 1;
  f.detail.record.color = "Concurrent";
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No change was sent");
  expect(f.detail.writes).toHaveLength(0);
  await btn(page, "Go back").click();
  await expect(page.getByLabel("Colour (optional)", { exact: true })).toHaveValue(
    "My draft",
  );
  await btn(page, "Reload vehicle fields").click();
  await expect(page.getByLabel("Colour (optional)", { exact: true })).toHaveValue(
    "Concurrent",
  );
  await page.reload();
  await editor(page);
  await expect(page.getByLabel("Colour (optional)", { exact: true })).toHaveValue(
    "Concurrent",
  );
});
test("unrelated listing version does not invalidate a reviewed specification change", async ({
  page,
}) => {
  const f = await workVehicleDetailFixture(page);
  await open(page);
  await editor(page);
  await page.getByLabel("Colour (optional)", { exact: true }).fill("Silver");
  await review(page);
  f.detail.record.listings[0].version = 1;
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes).toHaveLength(1);
});
for (const mode of ["lost", "malformed", "mismatch", "throttle"])
  test(`${mode} update stays locked across reload until explicit read with no replay`, async ({
    page,
  }) => {
    const f = await workVehicleDetailFixture(page);
    f.detail.writeMode = mode;
    await open(page);
    await editor(page);
    await page.getByLabel("Colour (optional)", { exact: true }).fill("Unconfirmed");
    await review(page);
    await confirm(page).click();
    await expect(btn(page, "Close & review record")).toBeVisible();
    await btn(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", {
        name: "A vehicle change needs reconciliation",
        exact: true,
      }),
    ).toBeVisible();
    await expect(btn(page, "Review vehicle changes")).toBeDisabled();
    const saved = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:stock-detail:v1:"),
      ),
    );
    expect(saved).toHaveLength(1);
    expect(saved[0][1]).not.toContain("Unconfirmed");
    expect(saved[0][1]).not.toContain("9999999999999999");
    await page.reload();
    await expect(btn(page, "Load current vehicle")).toBeVisible();
    await btn(page, "Load current vehicle").click();
    await expect(btn(page, "Load current vehicle")).toHaveCount(0);
    await expect(page.locator(".work-vehicle-detail")).toContainText(
      "previous request outcome is not proven",
    );
    await editor(page);
    await expect(btn(page, "Review vehicle changes")).toBeEnabled();
    expect(f.detail.writes).toHaveLength(1);
  });
test("temporary read failure preserves facts but disables mutation; denial removes them", async ({
  page,
}) => {
  const f = await workVehicleDetailFixture(page);
  await open(page);
  await editor(page);
  f.detail.mode = "error";
  await btn(page, "Refresh stock record").click();
  await expect(btn(page, "Retry vehicle record")).toBeVisible();
  await expect(page.getByText("JTNBE46KX73000001", { exact: true })).toBeVisible();
  await expect(btn(page, "Review vehicle changes")).toBeDisabled();
  f.detail.mode = "denied";
  await btn(page, "Retry vehicle record").click();
  await expect(page.getByText("JTNBE46KX73000001", { exact: true })).toHaveCount(0);
});
test("definitive update rejection is distinct from an unsent preflight failure", async ({
  page,
}) => {
  const f = await workVehicleDetailFixture(page);
  f.detail.writeMode = "reject";
  await open(page);
  await editor(page);
  await page.getByLabel("Colour (optional)", { exact: true }).fill("Rejected draft");
  await review(page);
  await confirm(page).click();
  await expect(btn(page, "Go back")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(btn(page, "Load current vehicle")).toHaveCount(0);
  await expect(page.getByLabel("Colour (optional)", { exact: true })).toHaveValue(
    "Rejected draft",
  );
  expect(f.detail.writes).toHaveLength(1);
});
test("older response cannot replace a confirmed new record", async ({ page }) => {
  const f = await workVehicleDetailFixture(page);
  await open(page);
  await editor(page);
  await page.getByLabel("Colour (optional)", { exact: true }).fill("Confirmed Blue");
  await review(page);
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  f.detail.record.version = 0;
  f.detail.record.color = "Old";
  await btn(page, "Refresh stock record").click();
  await expect(btn(page, "Retry vehicle record")).toBeVisible();
  await expect(page.locator(".vd-facts")).toContainText("Confirmed Blue");
  await expect(btn(page, "Review vehicle changes")).toBeDisabled();
});
test("responsive named record, navigation, disclosure and review pass accessibility checks", async ({
  page,
}) => {
  await workVehicleDetailFixture(page);
  await open(page);
  for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "2022 Toyota Camry", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
  await editor(page);
  await review(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
