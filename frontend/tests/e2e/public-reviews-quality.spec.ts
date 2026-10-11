import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { reviewTargets } from "@/lib/api/review-schemas";

const id = (n: number) => `c5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = reviewTargets.map((targetType, index) => ({
  id: id(index + 1),
  targetType,
  rating: index + 1,
  title: `Synthetic ${targetType} feedback`,
  comment: "Isolated review content.\nA second line of feedback.",
  createdAt: "2026-10-07T10:00:00Z",
  product: null,
  service: null,
  customer: { firstName: "PRIVATE_NAME", email: "private@example.invalid" },
  moderationNote: "PRIVATE_NOTE",
  status: "APPROVED",
}));
async function fixture(page: Page) {
  const state = {
    role: "anonymous",
    error: false,
    malformed: false,
    empty: false,
    paginate: false,
    delay: 0,
    reads: [] as string[],
    privateReads: [] as string[],
    writes: [] as string[],
    content: rows.map((row) => ({ ...row })),
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Isolated QA",
          meta: { requestId: "reviews-quality" },
        },
      });
    if (req.method() !== "GET") state.writes.push(url.pathname);
    if (url.pathname.endsWith("/auth/session")) {
      if (state.role === "anonymous" || state.role === "error")
        return route.fulfill({
          status: state.role === "anonymous" ? 401 : 503,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        });
      return ok({
        user: { id: id(20), role: state.role, email: "review@example.invalid" },
        mfaRequired: false,
        mfaVerifiedAt: null,
      });
    }
    if (url.pathname.endsWith("/public/support/reviews")) {
      state.reads.push(url.search);
      const filtered = state.content.filter(
        (row) =>
          !url.searchParams.has("targetType") ||
          row.targetType === url.searchParams.get("targetType"),
      );
      const data = state.malformed
        ? { items: [{}] }
        : {
            items: state.empty || url.searchParams.has("cursor") ? [] : filtered,
            ...(state.paginate && !url.searchParams.has("cursor")
              ? { nextCursor: id(5) }
              : {}),
          };
      const fail = state.error;
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (fail)
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            message: "PRIVATE_EXCEPTION",
            error: { code: "DATABASE_UNAVAILABLE" },
          },
        });
      return ok(data);
    }
    if (/\/(customers|staff)\/support\//.test(url.pathname))
      state.privateReads.push(url.pathname);
    return ok({ items: [] });
  });
  return state;
}
async function open(page: Page) {
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Customer reviews.");
  await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
  await expect(page.locator(".review-card--editorial")).toHaveCount(5);
}

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`public feedback layout, keyboard and controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("link", { name: "Sign in to review", exact: true }),
    ).toHaveAttribute("href", "/login?next=%2Fdashboard%2Freviews");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const select = page.getByLabel("Review type", { exact: true });
    await select.focus();
    await expect(select).toBeFocused();
    await expect(select).toHaveCSS("border-top-color", "rgb(184, 2, 1)");
    expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Refresh reviews", exact: true }),
    ).toBeFocused();
    const faq = page.locator("summary").first();
    await faq.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Customers can share an overall experience.", { exact: false }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    if ([320, 390, 768, 1280, 1440, 1536].includes(width)) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await page.screenshot({
      path: path.join(os.tmpdir(), `public-reviews-quality-${width}.png`),
      fullPage: true,
    });
    expect(state.privateReads).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test("every review type filters on the server and exposes only public fields", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  for (const type of reviewTargets) {
    await page.getByLabel("Review type", { exact: true }).selectOption(type);
    await expect(page.locator(".review-card--editorial")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: `Synthetic ${type} feedback`, exact: true }),
    ).toBeVisible();
    expect(state.reads.at(-1)).toContain(`targetType=${type}`);
  }
  await expect(page.getByRole("main")).not.toContainText("PRIVATE_");
  await expect(page.getByRole("main")).not.toContainText("private@example.invalid");
});
test("cursor pagination and changing a filter reset to the first page", async ({
  page,
}) => {
  const state = await fixture(page);
  state.paginate = true;
  await open(page);
  const nav = page.getByRole("navigation", { name: "Published reviews pages" });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No more feedback on this page" }),
  ).toBeVisible();
  expect(state.reads.at(-1)).toContain(`cursor=${id(5)}`);
  await expect(nav).toContainText("Page 2");
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".review-card--editorial")).toHaveCount(5);
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(nav).toContainText("Page 2");
  await page.getByLabel("Review type", { exact: true }).selectOption("SERVICE");
  await expect(page.locator(".review-card--editorial")).toHaveCount(1);
  await expect(nav).toContainText("Page 1");
  expect(state.reads.at(-1)).not.toContain("cursor");
});
test("empty filtered results provide a working reset", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  state.content = [rows[0]];
  await page.getByLabel("Review type", { exact: true }).selectOption("PRODUCT");
  await expect(
    page.getByRole("heading", { name: "No feedback for this review type" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all review types", exact: true }).click();
  await expect(page.locator(".review-card--editorial")).toHaveCount(1);
  await expect(page.getByLabel("Review type", { exact: true })).toHaveValue("");
});
test("empty reviews and in-page guidance remain accessible on a short mobile screen", async ({
  page,
}) => {
  const state = await fixture(page);
  state.empty = true;
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reviews");
  await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No published feedback yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Browse feedback", exact: true }).click();
  await expect(page.locator("#published-feedback")).toBeFocused();
  await page.getByRole("link", { name: "How reviews work", exact: true }).click();
  await expect(page.locator("#how-reviews-work")).toBeFocused();
  await page.locator("summary").last().click();
  await expect(
    page.getByText("Posting a review does not create a support request.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Contact customer care", exact: true }),
  ).toHaveAttribute("href", "/contact");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
for (const mode of ["error", "malformed"] as const) {
  test(`${mode} responses show an honest error and recover on refresh`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await open(page);
    state[mode] = true;
    await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.locator(".review-card--editorial")).toHaveCount(0);
    await expect(page.locator(".reviews-empty")).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText("PRIVATE_EXCEPTION");
    state[mode] = false;
    await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
    await expect(page.locator(".review-card--editorial")).toHaveCount(5);
  });
}
test("obsolete filter requests cannot replace the current result", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  state.delay = 1200;
  await page.getByLabel("Review type", { exact: true }).selectOption("SERVICE");
  await expect(page.locator(".reviews-load-status")).toHaveText(
    "Loading customer reviews…",
  );
  await expect(
    page.getByRole("button", { name: "Refresh reviews", exact: true }),
  ).toBeDisabled();
  state.delay = 0;
  await page.getByLabel("Review type", { exact: true }).selectOption("PRODUCT");
  await expect(
    page.getByRole("heading", { name: "Synthetic PRODUCT feedback", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(page.locator(".review-card--editorial")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Synthetic SERVICE feedback", exact: true }),
  ).toHaveCount(0);
});
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} receives only the appropriate review shortcut`, async ({ page }) => {
    const state = await fixture(page);
    state.role = role;
    await open(page);
    const main = page.getByRole("main");
    if (role === "CUSTOMER")
      await expect(
        main.getByRole("link", { name: "Write or check your review", exact: true }),
      ).toHaveAttribute("href", "/dashboard/reviews");
    else if (role === "STAFF") {
      await expect(
        main.getByText("Reviews are submitted from customer accounts."),
      ).toBeVisible();
      await expect(
        main.locator('a[href="/admin/reviews"], a[href="/dashboard/reviews"]'),
      ).toHaveCount(0);
    } else
      await expect(
        main.getByRole("link", { name: "Open review moderation", exact: true }),
      ).toHaveAttribute("href", "/admin/reviews");
    if (role !== "CUSTOMER")
      await expect(
        main.getByRole("link", { name: "Write or check your review", exact: true }),
      ).toHaveCount(0);
    expect(state.privateReads).toEqual([]);
    expect(state.writes).toEqual([]);
  });
}
test("account errors can be retried and session changes clear customer shortcuts", async ({
  page,
}) => {
  const state = await fixture(page);
  state.role = "error";
  await open(page);
  await expect(
    page.getByText("Account options are unavailable.", { exact: false }),
  ).toBeVisible();
  state.role = "CUSTOMER";
  await page.getByRole("button", { name: "Retry account check", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Write or check your review", exact: true }),
  ).toBeVisible();
  state.role = "STAFF";
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByText("Reviews are submitted from customer accounts."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Write or check your review", exact: true }),
  ).toHaveCount(0);
});
test("untrusted feedback remains text and long content fits a short mobile viewport", async ({
  page,
}) => {
  const state = await fixture(page);
  await open(page);
  state.content[0].title = '<img src=x onerror="window.pwned=1">';
  state.content[0].comment = "https://untrusted.invalid/" + "x".repeat(1600);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Refresh reviews", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: state.content[0].title, exact: true }),
  ).toBeVisible();
  expect(await page.locator(".review-list img, .review-list a").count()).toBe(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});
