import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workCategoriesFixture, bookingId } from "../fixtures/work-categories";
const path = "/admin/service-categories";

test("prefix and visibility filters, signed paging and history survive reload", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(path);
  await expect(page.getByText("3 categories on this page")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Category name starts with").fill("  I  ");
  await page.getByLabel("Visibility", { exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 category on this page")).toBeVisible();
  expect(Object.fromEntries(state.reads.at(-1)!.searchParams)).toEqual({
    limit: "25",
    search: "I",
    isActive: "false",
  });
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 category on this page")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
});
test("create validates all fields, reviews, cancels and saves exactly once", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic category");
  await page.getByLabel("URL name", { exact: true }).fill("synthetic-category");
  await page.getByLabel("Description (optional)").fill("Category description.");
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByRole("dialog")).toContainText("Category description.");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Category saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "POST",
    body: {
      name: "Synthetic category",
      slug: "synthetic-category",
      description: "Category description.",
      isActive: true,
    },
  });
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
});
test("direct edit outside current page reloads and deactivates with its revision", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${path}?edit=${bookingId(804)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Wheels");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Wheels");
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "its active services remain available",
  );
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Category saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "PATCH",
    body: { expectedVersion: 1, isActive: false },
  });
});
test("a changed review cannot patch and keeps the draft for explicit replacement", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${path}?edit=${bookingId(801)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
  await page.getByLabel("Name", { exact: true }).fill("My draft");
  await page.getByRole("button", { name: "Review changes" }).click();
  state.records[1].version = 2;
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("My draft");
  await page
    .getByRole("button", { name: "Load latest category and replace this draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
});
for (const outcome of ["uncertain", "uncommitted"])
  test(`${outcome} edits remain locked after reload and explicitly recover without replay`, async ({
    page,
  }) => {
    const { state } = await workCategoriesFixture(page);
    state.outcome = outcome;
    await page.goto(`${path}?edit=${bookingId(801)}`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
    await page.getByLabel("Name", { exact: true }).fill("Revised maintenance");
    await page.getByRole("button", { name: "Review changes" }).click();
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
    state.detailMode = "error";
    await page
      .getByRole("button", { name: "Discard draft and reload saved category" })
      .click();
    await expect(
      page.getByText("The saved category could not be loaded.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
    state.detailMode = "normal";
    await page.getByRole("button", { name: "Refresh category", exact: true }).click();
    await page
      .getByRole("button", { name: "Discard draft and reload saved category" })
      .click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      outcome === "uncertain" ? "Revised maintenance" : "Maintenance",
    );
    await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });
test("uncertain creation requires manual reconciliation and a new blank draft", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  state.outcome = "uncertain";
  await page.goto(path);
  await page.getByLabel("Name", { exact: true }).fill("New grouping");
  await page.getByLabel("URL name", { exact: true }).fill("new-grouping");
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await page.getByRole("button", { name: "Close & review record" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
  await page
    .getByRole("button", { name: "I checked the categories; start a blank draft" })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  expect(state.writes).toHaveLength(1);
});
for (const mode of ["error", "denied", "malformed"])
  test(`${mode} list fails closed and retries`, async ({ page }) => {
    const { state } = await workCategoriesFixture(page);
    state.mode = mode;
    await page.goto(path);
    await expect(
      page.getByText("Categories could not be loaded.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry categories" }).click();
    await expect(page.getByText("3 categories on this page")).toBeVisible();
  });
test("stale data preserves draft but permission loss removes editor and rows", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  await page.goto(`${path}?edit=${bookingId(801)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Maintenance");
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  state.mode = "error";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("Category information may be out of date.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
  state.mode = "denied";
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});
test("mismatched direct read hides the record and malformed URL issues no reads", async ({
  page,
}) => {
  const { state } = await workCategoriesFixture(page);
  state.detailMode = "mismatch";
  await page.goto(`${path}?edit=${bookingId(801)}`);
  await expect(
    page.getByText("The returned category does not match your selection.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  state.reads.length = 0;
  await page.goto(`${path}?edit=invalid&isActive=bad`);
  await expect(
    page.getByText("Some category filters are invalid.", { exact: false }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
});
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} issues no administrator category reads`, async ({ page }) => {
    const { state } = await workCategoriesFixture(page, role);
    await page.goto(path);
    if (role === "STAFF")
      await expect(
        page.getByText("Administrator access is required to manage service categories."),
      ).toBeVisible();
    else await expect(page).toHaveURL(/\/dashboard$/);
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });
test("Super Admin can edit and close without a mutation", async ({ page }) => {
  const { state } = await workCategoriesFixture(page, "SUPER_ADMIN");
  await page.goto(path);
  await page.getByRole("button", { name: "View & edit" }).first().click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Diagnostics");
  await page.getByRole("button", { name: "Close editing" }).click();
  await expect(page.getByRole("heading", { name: "Create category" })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
for (const width of [320, 390, 768, 1467])
  test(`readable accessible list and edit at ${width}px`, async ({ page }) => {
    const { state } = await workCategoriesFixture(page);
    state.records[0].name =
      "Comprehensive workshop diagnostics and scheduled vehicle servicing "
        .repeat(2)
        .slice(0, 120);
    state.records[0].description = "Detailed workshop guidance. ".repeat(40);
    await page.setViewportSize({ width, height: 1045 });
    await page.goto(path);
    await expect(page.getByText("3 categories on this page")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "View & edit" }).first().click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      state.records[0].name,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
  });
