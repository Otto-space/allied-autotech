import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { faqs } from "@/lib/business";

async function session(page: Page, role = "anonymous") {
  const state = { role, delay: 0, requests: [] as string[] };
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/"))
      state.requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    const current = state.role;
    const delay = state.delay;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (current === "anonymous" || current === "error")
      return route.fulfill({
        status: current === "anonymous" ? 401 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA",
        meta: { requestId: "help-article-quality" },
        data: {
          user:
            current === "malformed"
              ? { id: "invalid", role: "OWNER" }
              : { id: "c8000000-0000-4000-8000-000000000001", role: current },
          mfaRequired: false,
          mfaVerifiedAt: null,
          expiresAt: "2099-01-01T00:00:00Z",
          idleExpiresAt: "2099-01-01T00:00:00Z",
        },
      },
    });
  });
  return state;
}
async function open(page: Page, id = "pending-payments") {
  expect((await page.goto(`/help/${id}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    faqs.find((faq) => faq.id === id)!.question,
  );
  await page.evaluate(() => document.fonts.ready);
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`article layout, breadcrumb and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await session(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb.locator("ol")).toHaveCount(1);
    await expect(crumb.locator('[aria-current="page"]')).toHaveText(
      "My payment is not confirmed. What should I do?",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const action = page
      .locator(".ha-action")
      .getByRole("link", { name: "Sign in to continue" });
    await expect(action).toBeVisible();
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await expect(action).toBeFocused();
    if ([320, 390, 768, 1280, 1440, 1536].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-article-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-article-quality-${width}-full.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
for (const article of faqs)
  test(`complete article content and destinations: ${article.id}`, async ({ page }) => {
    await session(page, "CUSTOMER");
    await open(page, article.id);
    await expect(page.locator(".ha-answer > p")).toHaveText(article.answer);
    await expect(page.locator(".ha-preparation li")).toHaveCount(3);
    await expect(page).toHaveTitle(
      new RegExp(article.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    const action = page.locator(".ha-action a").first();
    await expect(action).toHaveAttribute("href", article.href);
    if (article.href.startsWith("https://")) {
      await expect(action).toHaveAttribute("target", "_blank");
      await expect(action).toHaveAttribute("rel", /noopener/);
      await expect(action).toHaveAttribute("aria-label", /opens in a new tab/);
    }
    await expect(page.locator(`.ha-related a[href='/help/${article.id}']`)).toHaveCount(
      0,
    );
    const related = faqs.filter(
      (faq) => faq.id !== article.id && faq.category === article.category,
    );
    await expect(page.locator(".ha-related li")).toHaveCount(related.length || 3);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.locator(".ha-topic").click();
    await expect(page).toHaveURL(/\/help\?topic=/);
    await expect(page.getByLabel("Browse by topic", { exact: true })).toHaveValue(
      article.category,
    );
    await expect(page.locator(".help-answers details")).toHaveCount(
      faqs.filter((faq) => faq.category === article.category).length,
    );
  });
for (const role of ["anonymous", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`article account actions match ${role}`, async ({ page }) => {
    const state = await session(page, role);
    for (const article of faqs.filter((faq) => faq.href.startsWith("/dashboard/"))) {
      await open(page, article.id);
      const action = page.locator(".ha-action");
      if (role === "CUSTOMER")
        await expect(action.locator("a")).toHaveAttribute("href", article.href);
      else if (role === "anonymous")
        await expect(action.locator("a")).toHaveAttribute(
          "href",
          `/login?next=${encodeURIComponent(article.href)}`,
        );
      else if (article.href.endsWith("/security") || article.href.endsWith("/support"))
        await expect(action.locator("a")).toHaveAttribute(
          "href",
          article.href.replace("/dashboard/", "/admin/"),
        );
      else {
        await expect(action).toContainText("available to customer accounts");
        await expect(action.locator("a")).toHaveAttribute("href", "/contact#enquiry");
      }
    }
    expect(state.requests.filter((item) => item !== "GET /api/v1/auth/session")).toEqual(
      [],
    );
  });
for (const role of ["error", "malformed"])
  test(`article session ${role} fails closed and retries`, async ({ page }) => {
    const state = await session(page, role);
    await open(page);
    await expect(page.getByRole("button", { name: "Retry account check" })).toBeVisible();
    await expect(page.locator(".ha-action a")).toHaveCount(0);
    await expect(page.locator(".ha-answer > p")).toBeVisible();
    state.role = "CUSTOMER";
    await page.getByRole("button", { name: "Retry account check" }).click();
    await expect(page.locator(".ha-action a")).toHaveAttribute(
      "href",
      "/dashboard/payments",
    );
  });
test("article session transition removes stale shortcuts", async ({ page }) => {
  const state = await session(page, "CUSTOMER");
  await open(page);
  await expect(page.locator(".ha-action a")).toHaveAttribute(
    "href",
    "/dashboard/payments",
  );
  state.role = "STAFF";
  state.delay = 700;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.locator(".ha-action a")).toHaveCount(0);
  state.role = "anonymous";
  state.delay = 0;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.locator(".ha-action a")).toHaveAttribute(
    "href",
    "/login?next=%2Fdashboard%2Fpayments",
  );
  await page.waitForTimeout(850);
  await expect(page.locator(".ha-action a")).toHaveAttribute(
    "href",
    "/login?next=%2Fdashboard%2Fpayments",
  );
});
test("related article navigation and back update content and account target", async ({
  page,
}) => {
  await session(page, "CUSTOMER");
  await open(page, "recover-your-account");
  await page
    .locator(".ha-related")
    .getByRole("link", { name: "How do I protect my account with MFA?" })
    .click();
  await expect(page).toHaveURL(/\/help\/account-security$/);
  await expect(page.locator(".ha-action a")).toHaveAttribute(
    "href",
    "/dashboard/security",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]'),
  ).toHaveText("How do I protect my account with MFA?");
  await page.goBack();
  await expect(page.locator(".ha-action a")).toHaveAttribute("href", "/forgot-password");
});
test("unknown articles recover through Help and do not reflect the slug", async ({
  page,
}) => {
  await session(page);
  const response = await page.goto("/help/unknown-article-xyz");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Help article unavailable.",
  );
  const policies = await page
    .locator('meta[name="robots"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("content")),
    );
  expect(policies.length).toBeGreaterThan(0);
  for (const policy of policies) expect(policy).toMatch(/noindex/);
  await expect(page.getByRole("main")).not.toContainText("unknown-article-xyz");
  await page.getByRole("link", { name: "Browse help topics" }).click();
  await expect(page).toHaveURL(/\/help$/);
});
test("public article content and navigation work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/help/booking-a-service");
    await expect(page.locator(".ha-answer > p")).toContainText(
      "workshop confirms availability",
    );
    await expect(page.locator(".ha-preparation li")).toHaveCount(3);
    await page.locator(".ha-topic").click();
    await expect(page.locator(".help-answers details")).toHaveCount(1);
  } finally {
    await context.close();
  }
});
test("query text cannot alter article content, actions or SEO identity", async ({
  page,
}) => {
  await session(page, "CUSTOMER");
  await page.goto(
    "/help/pending-payments?next=https%3A%2F%2Fevil.invalid&q=%3Cimg%20onerror%3Dwindow.articleXss%3D1%3E",
  );
  await expect(page.locator(".ha-action a")).toHaveAttribute(
    "href",
    "/dashboard/payments",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "My payment is not confirmed. What should I do?",
  );
  expect(await page.evaluate(() => Object.hasOwn(window, "articleXss"))).toBe(false);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(
    page.getByRole("main").locator('a[href*="evil.invalid"], img'),
  ).toHaveCount(0);
});
