import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workServicesFixture, bookingId } from "../fixtures/work-services";
const id = bookingId(901);
const url = `/admin/services/${id}`;
const review = (page: Page) =>
  page.getByRole("button", { name: "Review changes", exact: true });
const confirm = (page: Page) =>
  page.getByRole("button", { name: "Confirm save", exact: true });

test("a direct record outside the catalogue page reloads without any list read", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto(`/admin/services/${bookingId(904)}`);
  await expect(
    page.getByRole("heading", { name: "Wheel alignment", exact: true }),
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await expect(breadcrumb).toContainText("Overview");
  await expect(breadcrumb).toContainText("Services");
  await expect(breadcrumb).toContainText("Wheel alignment");
  await expect(breadcrumb).not.toContainText(bookingId(904));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Wheel alignment", exact: true }),
  ).toBeVisible();
  expect(state.reads.every((u) => u.pathname.endsWith(bookingId(904)))).toBe(true);
  expect(state.writes).toHaveLength(0);
});

test("catalogue names open details and browser back restores filters", async ({
  page,
}) => {
  await workServicesFixture(page);
  await page.goto("/admin/services?search=Engine");
  await page.getByRole("link", { name: "Engine servicing", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${id}$`));
  await expect(
    page.getByRole("heading", { name: "Engine servicing", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/search=Engine/);
  await expect(page.getByLabel("Search services")).toHaveValue("Engine");
});

test("inactive and legacy-null facts remain readable without a public-record fallback", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  Object.assign(state.records[1], {
    isActive: false,
    durationMinutes: null,
    categoryId: null,
    category: null,
    description: null,
  });
  await page.goto(url);
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(page.getByText("Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("No category", { exact: true })).toBeVisible();
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit service", exact: true }),
  ).toBeEnabled();
  expect(state.reads.length).toBeGreaterThan(0);
  expect(state.reads.every((read) => read.pathname.endsWith(id))).toBe(true);
});

test("editing reviews every field, cancels without a write and saves one versioned patch", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto(url);
  await page.getByRole("button", { name: "Edit service", exact: true }).click();
  await expect(page).toHaveURL(/view=edit/);
  await page.getByLabel("Duration in minutes").fill("75");
  await page
    .getByLabel("Service price (NGN) (optional)", { exact: true })
    .fill("87654.32");
  await review(page).click();
  await expect(page.getByRole("dialog")).toContainText("₦87,654.32");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await review(page).click();
  await confirm(page).click();
  await expect(page.getByText("75 minutes", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${id}$`));
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "PATCH",
    path: `/admin/services/${id}`,
    body: { expectedVersion: 1, durationMinutes: 75, priceKobo: "8765432" },
  });
});

test("edit mode and draft survive reload; closing makes no write", async ({ page }) => {
  const { state } = await workServicesFixture(page);
  await page.goto(`${url}?view=edit`);
  await page.getByLabel("Name", { exact: true }).fill("Kept service draft");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Kept service draft",
  );
  await page.getByRole("button", { name: "Close editing", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Engine servicing", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("a changed pre-save revision rejects before mutation and reconciles explicitly", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto(`${url}?view=edit`);
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  await review(page).click();
  state.records[1].version++;
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  await page
    .getByRole("button", { name: "Load latest service and replace this draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Engine servicing");
  expect(state.writes).toHaveLength(0);
});

for (const outcome of ["uncertain", "uncommitted"])
  test(`${outcome} edit remains locked after reload and recovers without replay`, async ({
    page,
  }) => {
    const { state } = await workServicesFixture(page);
    state.outcome = outcome;
    await page.goto(`${url}?view=edit`);
    await page.getByLabel("Duration in minutes").fill("75");
    await review(page).click();
    await confirm(page).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(review(page)).toBeDisabled();
    if (outcome === "uncommitted") {
      state.detailMode = "error";
      await page
        .getByRole("button", { name: "Discard draft and reload saved service" })
        .click();
      await expect(
        page.getByText(
          "The saved service could not be loaded. Your draft has been kept. Refresh the service before trying again.",
        ),
      ).toBeVisible();
      await expect(review(page)).toBeDisabled();
      expect(state.writes).toHaveLength(1);
      state.detailMode = "normal";
      await page
        .getByRole("button", { name: "Refresh service", exact: true })
        .first()
        .click();
    }
    await page
      .getByRole("button", { name: "Discard draft and reload saved service" })
      .click();
    await expect(page.getByLabel("Duration in minutes")).toHaveValue(
      outcome === "uncertain" ? "75" : "120",
    );
    await expect(review(page)).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });

for (const mode of ["error", "denied", "mismatch"])
  test(`${mode} detail fails closed and retries`, async ({ page }) => {
    const { state } = await workServicesFixture(page);
    state.detailMode = mode;
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Service unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit service", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).not.toContainText("Engine servicing");
    state.detailMode = "normal";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Engine servicing", exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(0);
  });

test("missing and malformed IDs do not expose record controls", async ({ page }) => {
  const { state } = await workServicesFixture(page);
  await page.goto(`/admin/services/${bookingId(999)}`);
  await expect(
    page.getByRole("heading", { name: "Service unavailable", exact: true }),
  ).toBeVisible();
  const reads = state.reads.length;
  await page.goto("/admin/services/invalid");
  await expect(
    page.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit service", exact: true }),
  ).toHaveCount(0);
  expect(state.reads).toHaveLength(reads);
});

test("stale reads preserve the edit draft; access loss clears the record and editor", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page);
  await page.goto(`${url}?view=edit`);
  await page.getByLabel("Name", { exact: true }).fill("Preserved draft");
  state.detailMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText(
      "Service information may be out of date. Refresh before making changes.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Preserved draft");
  await expect(review(page)).toBeDisabled();
  state.detailMode = "normal";
  await page
    .getByRole("button", { name: "Refresh service", exact: true })
    .first()
    .click();
  await expect(review(page)).toBeEnabled();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Preserved draft");
  state.detailMode = "denied";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "Service unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Engine servicing", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} direct service link issues no administrator reads`, async ({ page }) => {
    const { state } = await workServicesFixture(page, role);
    await page.goto(url);
    if (role === "CUSTOMER") await expect(page).toHaveURL(/\/dashboard$/);
    else
      await expect(
        page.getByText("Administrator access is required to manage these records."),
      ).toBeVisible();
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });

test("Super Admin can reload media mode and return to the same record", async ({
  page,
}) => {
  const { state } = await workServicesFixture(page, "SUPER_ADMIN");
  await page.goto(url);
  await page.getByRole("button", { name: "Manage image", exact: true }).click();
  await expect(page).toHaveURL(/view=image/);
  await expect(
    page.getByRole("heading", { name: "Image for Engine servicing" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Choose a service image", { exact: true })).toBeEnabled();
  state.detailMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByLabel("Choose a service image", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close image editor", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${id}$`));
  await expect(
    page.getByRole("heading", { name: "Service details", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

for (const width of [320, 390, 768, 1467])
  test(`complete accessible detail at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1072 });
    const { state } = await workServicesFixture(page);
    state.records[1].name = "Engine servicing and preventative workshop maintenance";
    state.records[1].description =
      "Maintain reliable performance with thorough engine servicing.\nOur technicians explain the work required.";
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Manage image", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Edit service", exact: true }).click();
    await expect(review(page)).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
