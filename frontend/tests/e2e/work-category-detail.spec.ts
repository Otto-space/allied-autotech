import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCategoriesFixture, bookingId } from "../fixtures/work-categories";
const root = "/admin/service-categories";
const path = `${root}/${bookingId(801)}`;

test("direct category outside the list page, named breadcrumb, dates and service link reload", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${root}/${bookingId(804)}`);
  await expect(page.getByRole("heading", { name: "Wheels", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
  ).toContainText("Wheels");
  await expect(page.locator("time").first()).toContainText("Lagos time");
  await expect(
    page.getByRole("link", { name: "View services in this category" }),
  ).toHaveAttribute("href", `/admin/services?categoryId=${bookingId(804)}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Wheels", exact: true })).toBeVisible();
  expect(state.reads.every((u) => u.pathname.endsWith(bookingId(804)))).toBe(true);
  expect(state.writes).toHaveLength(0);
});
test("list category links open the record and back returns to the list", async ({
  page,
}) => {
  await workCategoriesFixture(page);
  await page.goto(root);
  await page.getByRole("link", { name: "Maintenance", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to categories" }).click();
  await expect(page.getByText("3 categories on this page")).toBeVisible();
});
test("edit history, reload, complete review, cancel and one versioned save", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Edit category", exact: true }).click();
  await expect(page).toHaveURL(
    `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}${path}?view=edit`,
  );
  await expect(
    page.getByRole("heading", { name: "Edit category", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Edit category", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
  await page.getByLabel("Name", { exact: true }).fill("Reviewed maintenance");
  await page.getByLabel("Description (optional)").fill("Complete reviewed description.");
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review changes" }).click();
  const dialog = page.getByRole("dialog");
  for (const text of [
    "Reviewed maintenance",
    "maintenance",
    "Complete reviewed description.",
    "its active services remain available",
  ])
    await expect(dialog).toContainText(text);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reviewed maintenance", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".category-detail-summary")).toContainText("Inactive");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "PATCH",
    body: { expectedVersion: 1, isActive: false, name: "Reviewed maintenance" },
  });
});
test("stale confirmation preserves the draft and makes no write", async ({ page }) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${path}?view=edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  await page.getByRole("button", { name: "Review changes" }).click();
  state.records[1].version++;
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Load latest category and replace this draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
});
for (const outcome of ["uncertain", "uncommitted"])
  test(`${outcome} save stays locked after reload and explicitly reconciles without replay`, async ({
    page,
  }) => {
    const { state } = await workCategoriesFixture(page);
    state.outcome = outcome;
    await page.goto(`${path}?view=edit`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
    await page.getByLabel("Name", { exact: true }).fill("Reconciled name");
    await page.getByRole("button", { name: "Review changes" }).click();
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
    await page
      .getByRole("button", { name: "Discard draft and reload saved category" })
      .click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      outcome === "uncertain" ? "Reconciled name" : "Maintenance",
    );
    await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });
for (const mode of ["error", "denied", "missing", "malformed", "mismatch"])
  test(`${mode} detail fails closed then retries`, async ({ page }) => {
    const { state } = await workCategoriesFixture(page);
    state.detailMode = mode;
    await page.goto(`${path}?view=edit`);
    await expect(
      page.getByRole("heading", { name: "Category unavailable" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "View services in this category" }),
    ).toHaveCount(0);
    state.detailMode = "normal";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
    expect(state.writes).toHaveLength(0);
  });
test("transient refresh preserves draft while permission loss clears private record", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${path}?view=edit`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  state.detailMode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Category information may be out of date.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
  state.detailMode = "denied";
  await page
    .getByRole("button", { name: "Refresh category", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("inactive category with missing description still links to its services", async ({
  page,
}) => {
  await workCategoriesFixture(page);
  await page.goto(`${root}/${bookingId(802)}`);
  await expect(page.locator(".category-detail-summary")).toContainText("Inactive");
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View services in this category" }),
  ).toHaveAttribute("href", `/admin/services?categoryId=${bookingId(802)}`);
});
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} cannot request or edit category details`, async ({ page }) => {
    const { state } = await workCategoriesFixture(page, role);
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Edit category", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });
test("Super Admin can read and open the editor", async ({ page }) => {
  await workCategoriesFixture(page, "SUPER_ADMIN");
  await page.goto(path);
  await page.getByRole("button", { name: "Edit category", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
});
test("invalid identifier and repeated view do not open an editor", async ({ page }) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${root}/not-an-id`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.goto(`${path}?view=edit&view=edit`);
  await expect(
    page.getByRole("button", { name: "Edit category", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});
for (const width of [320, 390, 768, 1467])
  test(`${width}px long category and editor have no page overflow or accessibility violations`, async ({
    page,
  }) => {
    const { state } = await workCategoriesFixture(page);
    state.records[1].name = "Long category ".repeat(8).trim();
    state.records[1].slug = "category-".repeat(12).slice(0, -1);
    state.records[1].description = "Long detailed category guidance. ".repeat(40);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: state.records[1].name, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Edit category", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      state.records[1].name,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
  });
