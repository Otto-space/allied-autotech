import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workProductCategoriesFixture,
  bookingId,
} from "../fixtures/work-product-categories";
const path = "/admin/categories";

test("prefix, visibility, paging and browser history preserve their scope", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  await page.goto(path);
  await expect(page.getByText("3 categories on this page")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Search category names").fill("  fi  ");
  await page.getByLabel("Visibility", { exact: true }).selectOption("false");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("1 category on this page")).toBeVisible();
  expect(Object.fromEntries(state.reads.at(-1)!.searchParams)).toEqual({
    limit: "25",
    search: "fi",
    isActive: "false",
  });
  await page.goBack();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByText("1 category on this page")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.getByRole("link", { name: "View products in Braking", exact: true }),
  ).toHaveAttribute("href", `/admin/products?categoryId=${bookingId(900)}`);
});
test("create validates, reviews, cancels with focus restored and saves once with CSRF", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("New grouping");
  await page.getByLabel("URL name", { exact: true }).fill("new-grouping");
  await page.getByLabel("Description (optional)").fill("New parts.");
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByRole("dialog")).toContainText("New parts.");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review changes" })).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Category saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    method: "POST",
    body: {
      name: "New grouping",
      slug: "new-grouping",
      description: "New parts.",
      isActive: true,
    },
  });
  expect(state.writes[0].csrf).toBeTruthy();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
});
test("direct edit beyond page one survives reload and saves observed timestamp", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  state.mode = "error";
  await page.goto(`${path}?edit=${bookingId(904)}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Wheels");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Wheels");
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByLabel("Description (optional)").fill("");
  await page.getByRole("button", { name: "Review changes" }).click();
  state.mode = "normal";
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(page.getByText("Category saved.", { exact: true }).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    expectedUpdatedAt: "2026-10-13T08:00:00.000Z",
    isActive: false,
    description: null,
  });
});
test("another administrator's edit blocks submission and preserves local draft", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  await page.goto(`${path}?edit=${bookingId(900)}`);
  await page.getByLabel("Name", { exact: true }).fill("My draft");
  await page.getByRole("button", { name: "Review changes" }).click();
  state.records[0].updatedAt = "2026-10-13T08:02:00.000Z";
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
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Braking");
});
for (const outcome of ["uncertain", "uncommitted", "contradictory"])
  test(`${outcome} edit remains locked across reload and recovers without replay`, async ({
    page,
  }) => {
    const { state } = await workProductCategoriesFixture(page);
    state.outcome = outcome;
    await page.goto(`${path}?edit=${bookingId(900)}`);
    await page.getByLabel("Name", { exact: true }).fill("Revised braking");
    await page.getByRole("button", { name: "Review changes" }).click();
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
    await page
      .getByRole("button", { name: "Discard draft and reload saved category" })
      .click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      outcome === "uncommitted" ? "Braking" : "Revised braking",
    );
    await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });
test("lost creation response requires reconciliation and a new blank draft", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  state.outcome = "uncertain";
  await page.goto(`${path}?view=create`);
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
test("business conflict leaves the draft available after closing the review", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  state.outcome = "reject";
  await page.goto(`${path}?edit=${bookingId(900)}`);
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Confirm save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByLabel("Active", { exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});
for (const mode of ["missing", "denied", "malformed", "mismatch"])
  test(`direct ${mode} record cannot show an editable form`, async ({ page }) => {
    const { state } = await workProductCategoriesFixture(page);
    state.detailMode = mode;
    await page.goto(`${path}?edit=${bookingId(900)}`);
    await expect(page.getByText("Loading category…")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review changes" })).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });
test("temporary refresh failure preserves draft but denial removes private fields", async ({
  page,
}) => {
  const { state } = await workProductCategoriesFixture(page);
  await page.goto(`${path}?edit=${bookingId(900)}`);
  await page.getByLabel("Name", { exact: true }).fill("Kept draft");
  state.detailMode = "error";
  await page.getByRole("button", { name: "Refresh category", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kept draft");
  await expect(page.getByRole("button", { name: "Review changes" })).toBeDisabled();
  state.detailMode = "normal";
  await page.getByRole("button", { name: "Refresh category", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
  state.detailMode = "denied";
  await page.getByRole("button", { name: "Refresh category", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});
test("empty, failed, stale and denied lists have usable recovery", async ({ page }) => {
  const { state } = await workProductCategoriesFixture(page);
  state.mode = "empty";
  await page.goto(path);
  await expect(page.getByText("No categories found.")).toBeVisible();
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh categories", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  state.mode = "normal";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View & edit Braking", exact: true }),
  ).toBeEnabled();
  state.mode = "error";
  await page.getByRole("button", { name: "Refresh categories", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View & edit Braking", exact: true }),
  ).toBeDisabled();
  state.mode = "denied";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View & edit Braking", exact: true }),
  ).toHaveCount(0);
});
test("invalid links issue no category requests", async ({ page }) => {
  const { state } = await workProductCategoriesFixture(page);
  await page.goto(`${path}?edit=bad&view=create`);
  await expect(
    page.getByRole("heading", { name: "Category filters unavailable" }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
});
for (const role of ["STAFF", "CUSTOMER"])
  test(`${role} cannot enter administrator category controls`, async ({ page }) => {
    const { state } = await workProductCategoriesFixture(page, role);
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Add category", exact: true }),
    ).toHaveCount(0);
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });
for (const width of [320, 390, 768, 1467])
  test(`${width}px catalogue and editor remain accessible without horizontal overflow`, async ({
    page,
  }) => {
    await workProductCategoriesFixture(page, "SUPER_ADMIN");
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(page.getByText("3 categories on this page")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "View & edit Braking", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Braking");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Review changes" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
