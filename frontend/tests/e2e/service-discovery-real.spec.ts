import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.skip(
  process.env.SERVICE_DISCOVERY_REAL !== "true",
  "Requires the isolated service discovery test API",
);
type Fixture = {
  prefix: string;
  categories: { id: string; name: string }[];
  serviceIds: string[];
  editableServiceId: string;
  cookieName: string;
  sessions: { role: string; token: string; csrf: string }[];
};
const fixture = async () =>
  JSON.parse(
    await readFile(join(tmpdir(), "allied-service-discovery-browser.json"), "utf8"),
  ) as Fixture;

test("real service search, options paging, sorting, history and reload on desktop and mobile", async ({
  page,
}) => {
  const f = await fixture();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/services?search=${f.prefix}`);
  await expect(page).toHaveTitle(/services/i);
  await expect(
    page.getByText("75 matching services · 12 on this page", { exact: true }),
  ).toBeVisible();
  const first = await page.locator(".services-row h3").allTextContents();
  await page
    .getByRole("navigation", { name: "Service pages", exact: true })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.locator(".services-row h3").first()).not.toHaveText(first[0]);
  await expect(page.locator(".services-row")).toHaveCount(12);
  const second = await page.locator(".services-row h3").allTextContents();
  expect(new Set([...first, ...second]).size).toBe(24);
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.locator(".services-row h3").first()).toHaveText(second[0]);
  await page.getByLabel("Sort services", { exact: true }).selectOption("duration_asc");
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.locator(".services-row h3").first()).toHaveText(first[0]);
  await page.getByText("Find a category", { exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill(f.prefix);
  await page.getByRole("button", { name: "Find categories", exact: true }).click();
  const options = page.getByRole("navigation", {
    name: "Service category options pages",
    exact: true,
  });
  await options.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByLabel("Service category", { exact: true })
    .selectOption(f.categories[24].id);
  await expect(
    page.getByText("3 matching services · 3 on this page", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".services-row").first()).toContainText(
    f.categories[24].name,
  );
  await page.reload();
  await expect(page.getByLabel("Service category", { exact: true })).toHaveValue(
    f.categories[24].id,
  );
  await expect(page.locator("#service-category option:checked")).toHaveText(
    f.categories[24].name,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".services-discovery-panel").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({ path: join(tmpdir(), "service-discovery-real-mobile.png") });
  await page.getByRole("button", { name: "Remove category filter", exact: true }).click();
  await expect(
    page.getByText("75 matching services · 12 on this page", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Service category", { exact: true })).toHaveValue(
    f.categories[24].id,
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator(".services-discovery-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), "service-discovery-real-desktop.png") });
  expect(errors).toEqual([]);
});

for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`real ${role} category creation, service assignment and archive`, async ({
    page,
    context,
    baseURL,
  }) => {
    const f = await fixture(),
      session = f.sessions.find((s) => s.role === role)!;
    await context.addCookies([
      { name: f.cookieName, value: session.token, url: baseURL! },
    ]);
    const name = `AA ${role} category ${Date.now()}`,
      slug = `browser-${role.toLowerCase().replaceAll("_", "-")}-${Date.now()}`;
    await page.goto("/admin/service-categories");
    await expect(
      page.getByRole("heading", { name: "Service categories", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("URL name", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/admin/service-categories") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const categoryId = (await response.json()).data.id as string;
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.goto("/admin/services");
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: "View & edit", exact: true })
      .click();
    await page
      .getByLabel("Service category (optional)", { exact: true })
      .selectOption(categoryId);
    // Some legacy fixtures have null duration; service edits require a valid duration.
    await page.getByLabel("Duration in minutes", { exact: true }).fill("45");
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const assignment = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/admin/services/") && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    expect((await assignment).status()).toBe(200);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.goto(`/services?categoryId=${categoryId}`);
    await expect(page.locator(".services-row")).toHaveCount(1);
    await expect(page.locator(".services-row").first()).toContainText(name);
    await page.goto("/admin/service-categories");
    await page
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: "View & edit", exact: true })
      .click();
    await page.getByLabel("Active", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const archive = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/admin/service-categories/${categoryId}`) &&
        r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    expect((await archive).status()).toBe(200);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // An unchanged archived category must not prevent unrelated service edits.
    await page.goto("/admin/services");
    await page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: "View & edit", exact: true })
      .click();
    await page.getByLabel("Duration in minutes", { exact: true }).fill("60");
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const edit = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/admin/services/") && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Confirm save", exact: true }).click();
    expect((await edit).status()).toBe(200);
  });
