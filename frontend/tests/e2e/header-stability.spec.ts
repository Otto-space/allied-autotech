import { expect, test, type Page } from "@playwright/test";
import os from "node:os";
import path from "node:path";

async function fixture(page: Page) {
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
        flags: { guides: false, practice: false, ai: false },
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
        guides: [],
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

test.beforeEach(async ({ page }) => {
  if (process.env.HEADER_STABILITY_PATCH !== "true") return;
  await page.route("**/_next/**/*.css*", async (route) => {
    const response = await route.fetch();
    const css = (await response.text()).replace(
      /(\.site-header\.site-header--scrolled\s*\{)([^}]*)(\})/g,
      (_, selector, declarations, close) =>
        selector + declarations.replace(/--header-height\s*:\s*68px;?/g, "") + close,
    );
    await route.fulfill({ response, body: css });
  });
});

async function recordHeader(page: Page) {
  return page.evaluateHandle(() => {
    const state = {
      ended: false,
      samples: [] as {
        height: number;
        top: number;
        brandTop: number;
        y: number;
        path: string;
      }[],
    };
    function sample() {
      const header = document.querySelector(".site-header")?.getBoundingClientRect();
      const brand = document
        .querySelector(".site-header__brand")
        ?.getBoundingClientRect();
      if (header && brand)
        state.samples.push({
          height: header.height,
          top: header.top,
          brandTop: brand.top,
          y: scrollY,
          path: location.pathname,
        });
      if (!state.ended) requestAnimationFrame(sample);
    }
    sample();
    return state;
  });
}

for (const width of [390, 700, 701, 768, 1024, 1280, 1440]) {
  test(`Help to Learn, history and threshold scrolling keep navbar stable at ${width}`, async ({
    page,
  }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/help");
    const startHeight = await page
      .locator(".site-header")
      .evaluate((el) => el.getBoundingClientRect().height);
    const recording = await recordHeader(page);
    await page.getByRole("link", { name: "Explore Help & Learn" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(
      page.getByRole("link", { name: "Read answer: Find the workshop" }),
    ).toBeVisible();
    await page.waitForTimeout(1000); // Sample the former 30Hz height/scroll feedback loop.
    const frames = await recording.evaluate((state) => {
      state.ended = true;
      return state.samples;
    });
    await recording.dispose();
    expect(new Set(frames.map((frame) => frame.height))).toEqual(new Set([startHeight]));
    expect(new Set(frames.map((frame) => frame.top))).toEqual(new Set([0]));
    expect(
      Math.max(...frames.map((f) => f.brandTop)) -
        Math.min(...frames.map((f) => f.brandTop)),
    ).toBeLessThan(1);
    const settled = frames.filter((frame) => frame.path === "/learn").slice(-30);
    expect(settled.length).toBeGreaterThan(10);
    expect(
      Math.max(...settled.map((f) => f.y)) - Math.min(...settled.map((f) => f.y)),
    ).toBeLessThan(1);
    const breadcrumb = page.locator('main nav[aria-label="Breadcrumb"]');
    expect(
      await breadcrumb.evaluate(
        (el) =>
          el.getBoundingClientRect().top >=
          document.querySelector(".site-header")!.getBoundingClientRect().bottom,
      ),
    ).toBe(true);
    for (const top of [0, 10, 13, 20, 35, 200, 0]) {
      await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
      const thresholdRecording = await recordHeader(page);
      await page.waitForTimeout(180);
      const thresholdFrames = await thresholdRecording.evaluate((state) => {
        state.ended = true;
        return state.samples;
      });
      await thresholdRecording.dispose();
      expect(new Set(thresholdFrames.map((frame) => frame.height))).toEqual(
        new Set([startHeight]),
      );
    }
    await page.evaluate(() => scrollTo({ top: 200, behavior: "instant" }));
    await expect(page.locator(".site-header")).toHaveClass(/site-header--scrolled/);
    expect(
      await page.locator(".site-header").evaluate((el) => getComputedStyle(el).boxShadow),
    ).not.toBe("none");
    await page.goBack();
    await expect(page).toHaveURL(/\/help$/);
    await expect
      .poll(() =>
        page.locator(".site-header").evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(startHeight);
    await page.goForward();
    await expect(page).toHaveURL(/\/learn$/);
    await expect
      .poll(() =>
        page.locator(".site-header").evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(startHeight);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: path.join(os.tmpdir(), `aat-navbar-stable-${width}.png`),
      });
    expect(errors).toEqual([]);
  });
}
