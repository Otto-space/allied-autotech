import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

test.use({ reducedMotion: "reduce" });
test.setTimeout(120_000);
const id = (n: number) => `fa000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic form test",
      data,
      meta: { requestId: "form-ui-test" },
    },
  });
async function fixture(
  page: Page,
  role: string,
  handler: (route: Route, endpoint: string) => Promise<boolean>,
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(1),
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-09-24T09:00:00Z",
        user: { id: id(2), email: "customer@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "synthetic-form-csrf-".repeat(4) });
    if (endpoint === "/staff/profile")
      return reply(route, {
        id: id(2),
        email: "customer@example.test",
        role,
        status: "ACTIVE",
        capabilities: [],
        staffProfile: null,
      });
    return reply(route, { items: [] });
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("customer profile has clear groups, keyboard focus and unchanged save validation", async ({
  page,
}) => {
  let profile = {
    firstName: "Ada",
    lastName: "Okoro",
    phone: "+2348000000000",
    address: null as string | null,
    city: "Port Harcourt",
    state: "Rivers",
    country: "Nigeria",
    user: { id: id(2), email: "customer@example.test" },
  };
  const writes: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, "CUSTOMER", async (route, endpoint) => {
    if (endpoint !== "/customers/profile") return false;
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      writes.push(body);
      profile = { ...profile, ...body };
    }
    await reply(route, profile);
    return true;
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/dashboard/profile");
  await expect(
    page.getByRole("group", { name: "Personal details", exact: true }),
  ).toBeVisible();
  const first = page.getByLabel("First name", { exact: true });
  await first.focus();
  await expect(first).toHaveCSS("outline-style", "solid");
  await expect(first).toHaveCSS("font-size", "16px");
  expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Last name", { exact: true })).toBeFocused();
  await page.getByLabel("Phone number", { exact: true }).focus();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-forms-profile-desktop.png"),
    fullPage: true,
  });
  await first.fill("");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter your name.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  await first.fill("Amara");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    firstName: "Amara",
    lastName: "Okoro",
    phone: "+2348000000000",
    address: null,
    city: "Port Harcourt",
    state: "Rivers",
    country: "Nigeria",
  });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow(page);
    await expect(first).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Phone number", { exact: true }).focus();
  const notification = page.getByRole("button", { name: "Dismiss notification" });
  if (await notification.count()) await notification.first().click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-forms-profile-mobile.png"),
    fullPage: true,
  });
  await accessible(page);
  expect(errors).toEqual([]);
});

test("customer vehicle fields preserve validation and submission on a narrow screen", async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;
  await fixture(page, "CUSTOMER", async (route, endpoint) => {
    if (endpoint !== "/customers/vehicles") return false;
    if (route.request().method() === "POST") {
      saved = { id: id(3), ...route.request().postDataJSON() };
      await reply(route, saved);
    } else await reply(route, { vehicles: saved ? [saved] : [] });
    return true;
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/dashboard/vehicles");
  await page.getByLabel("Make", { exact: true }).fill("Toyota");
  await page.getByLabel("Model", { exact: true }).fill("Corolla");
  await page.getByLabel("Year", { exact: true }).fill("2020");
  await page.getByLabel("VIN (optional)", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByLabel("VIN (optional)", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(saved).toBeNull();
  await page.getByLabel("VIN (optional)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2020 Toyota Corolla" })).toBeVisible();
  expect(saved).toMatchObject({
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    registrationNumber: null,
    color: null,
    vin: null,
    mileageKm: null,
  });
  await noOverflow(page);
  await accessible(page);
});

for (const role of ["ADMIN", "SUPER_ADMIN"]) {
  test(`${role} service form preserves pricing, checkboxes and review confirmation`, async ({
    page,
  }) => {
    const writes: unknown[] = [];
    await fixture(page, role, async (route, endpoint) => {
      if (endpoint !== "/admin/services") return false;
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        await reply(route, { id: id(4) });
      } else await reply(route, { items: [] });
      return true;
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/services");
    await page.getByLabel("Name", { exact: true }).fill("Brake service");
    await page.getByLabel("URL name", { exact: true }).fill("brake-service");
    await page.getByLabel("Pricing", { exact: true }).selectOption("FIXED");
    await page
      .getByLabel("Service price (NGN) (optional)", { exact: true })
      .fill("15000");
    await page.getByLabel("Duration in minutes", { exact: true }).fill("60");
    const description = page.getByLabel("Full description (optional)", { exact: true });
    await description.fill(
      "Inspect the brakes.\nExplain any recommended repairs before starting work.",
    );
    await expect(description).toHaveCSS("resize", "vertical");
    expect((await description.boundingBox())!.height).toBeGreaterThanOrEqual(130);
    await page.getByLabel("Active", { exact: true }).uncheck();
    await description.focus();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-forms-${role.toLowerCase()}-service.png`),
      fullPage: true,
    });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await noOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const review = page.getByRole("dialog");
    await expect(
      review.getByRole("heading", { name: "Save this service?" }),
    ).toBeVisible();
    expect(writes).toHaveLength(0);
    await expect(review.getByRole("button", { name: "Confirm save" })).toHaveCSS(
      "text-transform",
      "none",
    );
    await noOverflow(page);
    await accessible(page);
    await review.getByRole("button", { name: "Confirm save" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      name: "Brake service",
      slug: "brake-service",
      pricingType: "FIXED",
      priceKobo: "1500000",
      durationMinutes: 60,
      isActive: false,
    });
  });
}
