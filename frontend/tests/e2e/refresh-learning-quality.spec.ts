import { expect, test, type Page } from "@playwright/test";
import { fixture as mfaFixture } from "../fixtures/mfa";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

async function fixture(page: Page, guides = false) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") throw new Error("Unexpected test write");
    if (endpoint.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    let data: unknown = { items: [] };
    if (endpoint.endsWith("/learning/catalogue"))
      data = {
        accessKey: "a".repeat(64),
        audience: "public",
        contentVersion: 1,
        mode: "browse_enquiries",
        flags: { guides, practice: false, ai: false },
        articles: [
          {
            id: "workshop-help",
            title: "Find the workshop",
            summary: "Synthetic help fixture",
            prerequisites: "",
            steps: Array.from(
              { length: 8 },
              (_, index) =>
                `Step ${index + 1}: Read the workshop directions and contact the team before travelling. This is an isolated browser fixture.`,
            ),
            outcome: "Directions are available on Contact.",
            recovery: "Contact the team.",
            keywords: "workshop location",
            page: "other",
            href: "/help",
            source: "Browser test fixture",
            version: 1,
            status: "published",
            reviewedAt: "2026-10-27T00:00:00Z",
          },
        ],
        guides: guides
          ? [
              {
                id: "sample-parts",
                title: "Sample parts walkthrough",
                articleId: "workshop-help",
                page: "parts",
                href: "/parts",
                version: 1,
                steps: [
                  {
                    id: "search",
                    target: "parts-search",
                    text: "Search for a part using the page controls.",
                    event: "input",
                  },
                  {
                    id: "review",
                    target: "parts-results",
                    text: "Read the results before making an enquiry.",
                    event: "read",
                  },
                ],
              },
            ]
          : [],
        scenarios: [],
      };
    if (endpoint.endsWith("/public/branches"))
      data = {
        items: [
          {
            id: "f6000000-0000-4000-8000-000000000001",
            name: "Test workshop",
            code: "TEST",
          },
        ],
      };
    if (endpoint.endsWith("/public/services"))
      data = {
        items: [{ id: "f6000000-0000-4000-8000-000000000002", name: "Test service" }],
      };
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Isolated test",
        meta: { requestId: "viewport-test" },
      },
    });
  });
  return errors;
}

for (const width of [390, 1440]) {
  test(`refresh and touch scrolling preserve reading position at ${width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: width === 390,
    });
    const page = await context.newPage();
    const errors = await fixture(page);
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () =>
        window.scrollTo({ top: 650, behavior: "instant" }),
      );
    });
    for (let round = 0; round < 3; round++) {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(600);
      await page.waitForTimeout(700); // Includes hydration and queued entry/focus effects.
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(600);
      expect(
        await page.locator("main").evaluate((el) => document.activeElement === el),
      ).toBe(false);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 180, y: 650 }],
      });
      for (let move = 1; move <= 12; move++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 180, y: 650 - move * 25 }],
        });
        await page.waitForTimeout(20);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await page.waitForTimeout(400);
      const reading = await page.evaluate(() => scrollY);
      expect(reading).toBeGreaterThan(750);
      await page.waitForTimeout(400);
      expect(Math.abs((await page.evaluate(() => scrollY)) - reading)).toBeLessThan(3);
    }
    expect(errors).toEqual([]);
    await context.close();
  });

  test(`Help, Allie, answer and empty-mode recovery at ${width}`, async ({ page }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/help");
    const category = page.getByLabel("Browse by topic", { exact: true });
    if (width < 768) await category.selectOption("Contact and location");
    else
      await page
        .getByRole("button", { name: "Contact and location", exact: true })
        .click();
    await expect
      .poll(() =>
        page
          .locator("#help-results")
          .evaluate(
            (el) =>
              el.getBoundingClientRect().top >=
              document.querySelector(".site-header")!.getBoundingClientRect().bottom,
          ),
      )
      .toBe(true);
    await page.getByLabel("Search help topics").fill("zzzzqqqq");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator("#help-results")).toBeFocused();
    await expect(page.locator("#help-results")).toHaveCSS("box-shadow", "none");
    await expect(page.getByRole("heading", { name: "No matching topics" })).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(page.getByLabel("Search help topics")).toBeFocused();
    await page.getByRole("link", { name: "Explore Help & Learn" }).click();
    await expect(page.locator('main nav[aria-label="Breadcrumb"]')).toBeVisible();
    await page.getByRole("tab", { name: /Guide me/ }).click();
    await expect(
      page.getByRole("button", { name: "Browse written answers" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Browse written answers" }).click();
    await page.getByRole("link", { name: "Read answer: Find the workshop" }).click();
    const detail = page.locator(".learning-detail");
    await expect(detail).toBeFocused();
    await expect(detail).toHaveCSS("outline-style", "none");
    await expect(detail).toHaveCSS("box-shadow", "none");
    expect(
      await detail.evaluate(
        (el) =>
          el.getBoundingClientRect().top >=
          document.querySelector(".site-header")!.getBoundingClientRect().bottom,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Back to results" }).click();
    const launcher = page.getByRole("button", { name: "Ask Allie", exact: true });
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    await expect(
      dialog.getByRole("button", { name: "Find the workshop", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Show me the steps" })).toHaveCount(
      0,
    );
    await dialog.getByRole("button", { name: "Find the workshop", exact: true }).click();
    await expect(dialog.locator(".allie-response")).toBeFocused();
    await dialog.getByRole("button", { name: "Ask another question" }).click();
    await expect(dialog.getByLabel("What do you need help with?")).toBeFocused();
    await dialog.getByLabel("What do you need help with?").fill("zzzzqqqq");
    await dialog.getByRole("button", { name: "Find reviewed help" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Try a related help topic" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Find the workshop", exact: true }).click();
    await expect(dialog.locator(".allie-answer")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".allie-dialog[open]").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), `aat-help-after-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
    // Keyboard focus on a real control remains visible.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
    ).not.toBe("none");
    await launcher.click();
    await dialog.getByRole("link", { name: "Contact the team", exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.locator('main nav[aria-label="Breadcrumb"]')).toBeFocused();
    await page.waitForTimeout(300);
    await expect(page.locator('main nav[aria-label="Breadcrumb"]')).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("optional guide written mode, pause, restart and safe completion", async ({
  page,
}) => {
  await fixture(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/parts#learn=sample-parts");
  const guide = page.getByRole("complementary", { name: "Optional guide" });
  await expect(guide.getByText(/Written mode/)).toBeVisible();
  await expect(
    guide.getByRole("progressbar", { name: "Guide progress" }),
  ).toHaveAttribute("value", "0");
  await guide.getByRole("button", { name: "Mark step read" }).click();
  await expect(guide.getByText("Optional guide · 2 of 2")).toBeVisible();
  await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Pause guide" }).click();
  await expect(guide.getByText(/Guide paused/)).toBeVisible();
  await guide.getByRole("button", { name: "Resume guide" }).click();
  await guide.getByRole("button", { name: "Restart guide" }).click();
  await expect(guide.getByText("Optional guide · 1 of 2")).toBeVisible();
  await guide.getByRole("button", { name: "Mark step read" }).click();
  await guide.getByRole("button", { name: "Mark step read" }).click();
  await expect(guide.getByText(/Guide complete/)).toBeVisible();
  await expect(guide.getByRole("progressbar")).toHaveAttribute("value", "2");
  await guide.getByRole("button", { name: "Exit guide" }).click();
  await expect(guide).toHaveCount(0);
  await expect(page).not.toHaveURL(/#learn=/);
});

for (const width of [390, 1440]) {
  test(`login redirect and MFA completion focus at ${width}`, async ({ page }) => {
    await fixture(page);
    await page.route("**/api/v1/auth/**", (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint.endsWith("/login"))
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic auth fixture",
            meta: { requestId: "refresh-auth-test" },
            data: {
              user: {
                id: "f6000000-0000-4000-8000-000000000010",
                email: "isolated@example.test",
                role: "CUSTOMER",
              },
              mfaRequired: false,
            },
          },
        });
      if (endpoint.endsWith("/csrf"))
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic auth fixture",
            meta: { requestId: "refresh-auth-test" },
            data: { csrfToken: "synthetic-token-not-used-outside-test" },
          },
        });
      return route.fallback();
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login?next=%2Fservices");
    await page.getByLabel("Email address").fill("isolated@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("synthetic-test-only-passphrase");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/services$/, { timeout: 30000 });
    const breadcrumb = page.locator('main nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeFocused();
    await expect(breadcrumb).toHaveCSS("box-shadow", "none");
    await page.waitForTimeout(300);
    await expect(breadcrumb).toBeFocused();
    await mfaFixture(page);
    await page.goto("/mfa");
    await page.getByRole("button", { name: "Authenticator", exact: true }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
    const complete = page.getByRole("heading", { name: "Verification complete" });
    await expect(complete).toBeFocused();
    await expect(complete).toHaveCSS("outline-style", "none");
    await expect(complete).toHaveCSS("box-shadow", "none");
    await page.getByRole("button", { name: "Continue to account security" }).click();
    await expect(page).toHaveURL(/\/admin\/security$/);
  });
}
