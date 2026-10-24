import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { faqs } from "@/lib/business";

async function fixture(page: Page, role = "anonymous") {
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
        meta: { requestId: "help-quality" },
        data: {
          user:
            current === "malformed"
              ? { id: "invalid", role: "OWNER" }
              : { id: "c7000000-0000-4000-8000-000000000001", role: current },
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
async function open(page: Page, url = "/help") {
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Help, when you need it.",
  );
  await page.evaluate(() => document.fonts.ready);
}
async function topic(page: Page, value: string) {
  if (await page.getByLabel("Browse by topic", { exact: true }).isVisible())
    await page.getByLabel("Browse by topic", { exact: true }).selectOption(value);
  else await page.getByRole("button", { name: value, exact: true }).click();
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`Help layout and keyboard answers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText("Help centre");
    await expect(page.locator(".help-answers details")).toHaveCount(faqs.length);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const summary = page.locator(".help-answers summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".help-answers details").first()).toHaveAttribute(
      "open",
      "",
    );
    await expect(
      page.getByRole("link", { name: "Explore services", exact: true }),
    ).toBeVisible();
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width <= 760) {
      await expect(page.locator(".help-desktop-topics")).toBeHidden();
      await expect(page.getByLabel("Browse by topic", { exact: true })).toBeVisible();
    } else {
      await expect(page.locator(".help-mobile-topics")).toBeHidden();
      await expect(page.locator(".help-topic-buttons button")).toHaveCount(9);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    if ([320, 390, 768, 1280, 1440, 1536].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `help-quality-${width}-full.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
test("every category and multiword search uses the complete article collection", async ({
  page,
}) => {
  await fixture(page);
  await open(page);
  for (const category of [...new Set(faqs.map((faq) => faq.category))]) {
    await topic(page, category);
    await expect(page.locator(".help-answers details")).toHaveCount(
      faqs.filter((faq) => faq.category === category).length,
    );
  }
  await topic(page, "All topics");
  await page.getByLabel("Search help topics").fill("Payments");
  await expect(page.locator(".help-answers details")).toHaveCount(1);
  await expect(page.locator(".help-answers summary")).toHaveText(
    "My payment is not confirmed. What should I do?",
  );
  await page.getByLabel("Search help topics").fill("  BOOK appointment ");
  await expect(page.locator(".help-answers details")).toHaveCount(1);
  await expect(page.locator(".help-answers summary")).toHaveText(
    "How do I book a service?",
  );
  await topic(page, "Payments");
  await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".help-answers details")).toHaveCount(faqs.length);
  await expect(page.getByLabel("Search help topics")).toBeFocused();
});
test("search and category survive reload, article return and history traversal", async ({
  page,
}) => {
  await fixture(page);
  await open(page);
  await topic(page, "Accounts and security");
  await page.getByLabel("Search help topics").fill("MFA");
  await page.reload();
  await expect(page.getByLabel("Search help topics")).toHaveValue("MFA");
  await expect(page.locator(".help-answers details")).toHaveCount(2);
  await page.locator(".help-answers summary").first().click();
  await page.getByRole("link", { name: "Read article", exact: false }).click();
  await expect(page).toHaveURL(/\/help\/account-security$/);
  await page.goBack();
  await expect(page.getByLabel("Search help topics")).toHaveValue("MFA");
  await expect(page.locator(".help-answers details")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await topic(page, "Payments");
  await topic(page, "Quotations");
  await page.goBack();
  await expect(page.locator(".help-answers summary")).toHaveText(
    "My payment is not confirmed. What should I do?",
  );
  await page.goForward();
  await expect(page.locator(".help-answers summary")).toHaveText(
    "How do I request a quotation?",
  );
});
test("short mobile search moves focus to results and resets safely", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await fixture(page);
  await open(page);
  await page.getByLabel("Search help topics").fill("no-match-xyz");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("#help-results")).toBeFocused();
  await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
  expect(
    await page.locator("#help-results").evaluate((e) => e.getBoundingClientRect().top),
  ).toBeGreaterThanOrEqual(68);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: path.join(os.tmpdir(), "help-quality-empty-320.png") });
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByLabel("Search help topics")).toBeFocused();
  await topic(page, "Contact and location");
  await expect(page.locator(".help-answers details")).toHaveCount(4);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
for (const role of ["anonymous", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`Help account shortcuts match ${role} without private requests`, async ({
    page,
  }) => {
    const state = await fixture(page, role);
    await open(page);
    const main = page.getByRole("main");
    const follow = page.locator(".help-account-options a");
    await expect(follow).toHaveAttribute(
      "href",
      role === "anonymous"
        ? "/login?next=%2Fdashboard%2Fsupport"
        : role === "CUSTOMER"
          ? "/dashboard/support"
          : "/admin/support",
    );
    if (role === "CUSTOMER")
      for (const href of [
        "/dashboard/payments",
        "/dashboard/vehicles",
        "/dashboard/security",
      ])
        await expect(main.locator(`a[href='${href}']`)).toHaveCount(1);
    else await expect(main.locator('a[href^="/dashboard"]')).toHaveCount(0);
    if (!["anonymous", "CUSTOMER"].includes(role)) {
      await expect(main.locator('a[href="/admin/security"]')).toHaveCount(1);
      await expect(
        main.locator('a[href="/admin/payments"], a[href="/admin/vehicles"]'),
      ).toHaveCount(0);
    }
    expect(state.requests.filter((item) => item !== "GET /api/v1/auth/session")).toEqual(
      [],
    );
  });
}
for (const role of ["error", "malformed"])
  test(`Help preserves public answers when the session is ${role}`, async ({ page }) => {
    const state = await fixture(page, role);
    await open(page);
    await expect(page.getByRole("button", { name: "Retry account check" })).toBeVisible();
    await expect(
      page.getByRole("main").locator('a[href^="/dashboard"], a[href^="/admin"]'),
    ).toHaveCount(0);
    await page.getByLabel("Search help topics").fill("book");
    await expect(page.locator(".help-answers details")).not.toHaveCount(0);
    state.role = "CUSTOMER";
    await page.getByRole("button", { name: "Retry account check" }).click();
    await expect(page.locator(".help-account-options a")).toHaveAttribute(
      "href",
      "/dashboard/support",
    );
  });
test("session changes clear shortcuts and ignore obsolete responses", async ({
  page,
}) => {
  const state = await fixture(page, "CUSTOMER");
  await open(page);
  await expect(page.locator(".help-account-options a")).toHaveAttribute(
    "href",
    "/dashboard/support",
  );
  state.role = "STAFF";
  state.delay = 800;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(
    page.getByRole("main").locator('a[href^="/dashboard"], a[href^="/admin"]'),
  ).toHaveCount(0);
  state.role = "anonymous";
  state.delay = 0;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.locator(".help-account-options a")).toHaveAttribute(
    "href",
    "/login?next=%2Fdashboard%2Fsupport",
  );
  await page.waitForTimeout(1000);
  await expect(
    page.getByRole("main").locator('a[href^="/dashboard"], a[href^="/admin"]'),
  ).toHaveCount(0);
});
test("server-rendered search and topic selection work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/help");
    await page.getByLabel("Search help topics").fill("MFA");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    // Both setup and lost-authenticator recovery are published MFA articles.
    await expect(page.locator(".help-answers summary")).toHaveText([
      faqs.find((faq) => faq.id === "account-security")!.question,
      faqs.find((faq) => faq.id === "lost-authenticator")!.question,
    ]);
    await page.locator(".help-answers summary").first().click();
    await expect(
      page.getByRole("link", { name: "Read article", exact: false }),
    ).toBeVisible();
    await page.getByLabel("Search help topics").fill("");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByLabel("Browse by topic", { exact: true }).selectOption("Payments");
    await page.getByRole("button", { name: "Apply topic" }).click();
    await expect(page.locator(".help-answers summary")).toHaveText(
      "My payment is not confirmed. What should I do?",
    );
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(page.locator(".help-answers details")).toHaveCount(faqs.length);
  } finally {
    await context.close();
  }
});
test("all articles and approved external contacts are reachable", async ({
  page,
  request,
}) => {
  await fixture(page);
  await open(page);
  for (const faq of faqs)
    expect((await request.get(`/help/${faq.id}`)).status()).toBe(200);
  await page
    .locator(".help-answers details")
    .evaluateAll((elements) => elements.forEach((e) => e.setAttribute("open", "")));
  await expect(
    page.locator(".help-answers a").filter({ hasText: "Read article" }),
  ).toHaveCount(faqs.length);
  const external = page.getByRole("main").locator('a[target="_blank"]');
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute("rel", /noopener/);
    expect(new URL((await link.getAttribute("href"))!).protocol).toBe("https:");
  }
  await expect(page.locator(".help-contact")).toContainText(
    "133 Stadium Road, beside Kilimanjaro",
  );
  await expect(page.locator(".help-contact a[href^='tel:']")).toHaveAttribute(
    "href",
    "tel:+2348136075567",
  );
});
test("untrusted and invalid URL filters remain literal and bounded", async ({ page }) => {
  await fixture(page);
  await open(
    page,
    `/help?q=${encodeURIComponent("<img src=x onerror=window.helpXss=1>")}&topic=invalid`,
  );
  await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, "helpXss"))).toBe(false);
  await expect(page.getByRole("main").locator("img")).toHaveCount(0);
  await expect(page.getByLabel("Search help topics")).toHaveAttribute("maxlength", "200");
  await open(page, `/help?q=${"x".repeat(500)}&topic=invalid`);
  expect((await page.getByLabel("Search help topics").inputValue()).length).toBe(200);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".help-answers details")).toHaveCount(faqs.length);
});
