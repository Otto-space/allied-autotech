import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const hero = (page: Page) => page.getByRole("region", { name: "Workshop highlights" });
async function open(page: Page) {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Allied AutoTech/);
  await expect(hero(page).getByRole("heading", { level: 1 })).toContainText(
    "Comprehensive diagnostics",
  );
  await expect(hero(page).getByRole("button", { name: /slideshow/ })).toBeVisible();
  await page.mouse.move(1, 1);
}
async function decoded(page: Page) {
  await expect
    .poll(() =>
      hero(page)
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
}

test("touch swipes retain vertical scrolling and rapid selection stays stable after resize", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await open(page);
  await decoded(page);
  const session = await context.newCDPSession(page);
  const frame = await hero(page).locator("img").first().boundingBox();
  const y = frame!.y + frame!.height / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 320, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 200, y: y + 3 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(hero(page)).toHaveAttribute("data-slide", "2");
  const start = await page.evaluate(() => scrollY);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 380 }],
  });
  for (const point of [340, 280, 210])
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y: point }],
    });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(start);
  await page.evaluate(() => scrollTo(0, 0));
  for (let i = 0; i < 8; i++)
    await hero(page).getByRole("button", { name: "Next slide", exact: true }).click();
  await hero(page)
    .getByRole("button", { name: /Show slide 3:/ })
    .click();
  await expect(hero(page)).toHaveAttribute("data-slide", "3");
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(hero(page).getByRole("link", { name: "Meet the team" })).toBeVisible();
  await context.close();
});

test("visibility suspension resets the interval without overriding manual pause", async ({
  page,
}, info) => {
  test.setTimeout(45000);
  await open(page);
  await decoded(page);
  // A deterministic visibility event simulation; actual physical background-tab coverage is separate.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const current = await hero(page).getAttribute("data-slide");
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-slide", current!);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hero(page)).not.toHaveAttribute("data-slide", current!, { timeout: 8500 });
  await hero(page).getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-rotating", "false");
  await info.attach("visibility-limit", {
    body: "Visibility state is simulated, not a physical browser tab-switch test.",
    contentType: "text/plain",
  });
});

test("all failed hero photos retain content and a stalled photo is skipped after the bounded wait", async ({
  page,
}) => {
  test.setTimeout(50000);
  let requested = 0;
  await page.route("**/_next/image?*", async (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (asset.includes("alignment-at-work")) {
      requested++;
      await new Promise((r) => setTimeout(r, 21000));
    }
    return route.continue();
  });
  await open(page);
  await expect(hero(page)).toHaveAttribute("data-slide", "3", { timeout: 19000 });
  await expect(hero(page).getByRole("link", { name: "Meet the team" })).toBeVisible();
  expect(requested).toBeLessThanOrEqual(2);
  await page.unroute("**/_next/image?*");
  await page.route("**/_next/image?*", (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    return /diagnostics-at-work|alignment-at-work|tyre-care-at-work/.test(asset)
      ? route.fulfill({ status: 404, body: "" })
      : route.continue();
  });
  await open(page);
  await expect(hero(page).getByText("Workshop photograph unavailable")).toBeVisible();
  await expect(hero(page).getByRole("heading", { level: 1 })).toContainText(
    "Comprehensive diagnostics",
  );
  await expect(
    hero(page).getByRole("link", { name: "Explore diagnostics" }),
  ).toBeVisible();
});

test("doubled text reflows without losing controls or service context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      "main h1,main h2,main h3,main p,main a,main button",
    )) {
      el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
      el.style.lineHeight = "1.5";
    }
  });
  for (const selector of [
    '[aria-roledescription="carousel"]',
    ".home-services",
    ".home-bay",
    ".home-shop",
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  // No enquiry is submitted: check the editable topic carried to the existing request form.
  await page.goto("/contact?serviceInterest=diagnostics#enquiry");
  await expect(
    page.getByText(/Ask about Comprehensive Vehicle Diagnostics/),
  ).toBeVisible();
});

test("three complete real-time autoplay loops keep images, copy and actions in sync", async ({
  page,
}, info) => {
  test.setTimeout(85000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await decoded(page);
  const changes: { slide: number; elapsed: number }[] = [];
  let previous = Date.now();
  for (let step = 1; step <= 9; step++) {
    const slide = (step % 3) + 1;
    await expect(hero(page)).toHaveAttribute("data-slide", String(slide), {
      timeout: 10000,
    });
    const now = Date.now();
    changes.push({ slide, elapsed: now - previous });
    previous = now;
    if (step > 1) expect(changes.at(-1)!.elapsed).toBeGreaterThan(5400);
    await expect(hero(page).locator('img[data-current="true"]')).toHaveCount(1);
    await expect(
      hero(page).getByRole("group", { name: `${slide} of 3`, exact: true }),
    ).toBeVisible();
    await expect(hero(page).getByRole("link")).toHaveAttribute(
      "href",
      ["/services?search=diagnostics", "/services?search=alignment", "/about#team"][
        slide - 1
      ],
    );
  }
  expect(errors).toEqual([]);
  await info.attach("real-time-loops", {
    body: JSON.stringify(changes),
    contentType: "application/json",
  });
});

test("hover, manual pause and keyboard focus retain distinct pause behaviour", async ({
  page,
}) => {
  test.setTimeout(100000);
  await open(page);
  await decoded(page);
  for (let i = 0; i < 2; i++) {
    await hero(page).hover();
    const current = await hero(page).getAttribute("data-slide");
    await page.waitForTimeout(6500);
    await expect(hero(page)).toHaveAttribute("data-slide", current!);
    await page.mouse.move(1, 1);
    await expect(hero(page)).not.toHaveAttribute("data-slide", current!, {
      timeout: 8000,
    });
  }
  await hero(page).getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.move(1, 1);
  const paused = await hero(page).getAttribute("data-slide");
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-slide", paused!);
  await hero(page).getByRole("button", { name: "Play slideshow" }).click();
  await page.mouse.move(1, 1);
  await expect(hero(page)).not.toHaveAttribute("data-slide", paused!, { timeout: 8000 });
  await hero(page).getByRole("link").focus();
  const focused = await hero(page).getAttribute("data-slide");
  await page
    .getByRole("link", { name: "Allied AutoTech home", exact: true })
    .first()
    .focus();
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-slide", focused!);
  const play = hero(page).getByRole("button", { name: "Play slideshow" });
  await play.focus();
  await play.press("Enter");
  await page.mouse.move(1, 1);
  await expect(hero(page)).not.toHaveAttribute("data-slide", focused!, { timeout: 8000 });
  await hero(page).getByRole("button", { name: "Next slide" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(hero(page).getByRole("status")).toContainText("Slide");
  await expect(hero(page).getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("offscreen return resumes only an eligible carousel and revisits do not multiply timers", async ({
  page,
}) => {
  test.setTimeout(65000);
  await open(page);
  await decoded(page);
  await page.locator("footer").scrollIntoViewIfNeeded();
  const current = await hero(page).getAttribute("data-slide");
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-slide", current!);
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1, 1);
  await expect(hero(page)).not.toHaveAttribute("data-slide", current!, { timeout: 8500 });
  await hero(page).getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.move(1, 1);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(6500);
  await expect(hero(page)).toHaveAttribute("data-rotating", "false");
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("navigation", { name: "Primary navigation", exact: true })
      .getByRole("link", { name: "About", exact: true })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await page
      .getByRole("link", { name: "Allied AutoTech home", exact: true })
      .first()
      .click();
    await expect(hero(page)).toHaveAttribute("data-slide", "1");
    await page.mouse.move(1, 1);
  }
  await page.waitForTimeout(6400);
  await expect(hero(page)).toHaveAttribute("data-slide", "2");
});

test("slow and failed slide requests retain a usable current slide with bounded recovery", async ({
  page,
}) => {
  test.setTimeout(60000);
  let requests = 0;
  await page.route("**/_next/image?*", async (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (asset.includes("alignment-at-work")) {
      requests++;
      await new Promise((r) => setTimeout(r, 8500));
    }
    return route.continue();
  });
  await open(page);
  await page.waitForTimeout(6300);
  await expect(hero(page)).toHaveAttribute("data-slide", "1");
  await expect(
    hero(page).getByRole("link", { name: "Explore diagnostics" }),
  ).toBeVisible();
  await expect(hero(page)).toHaveAttribute("data-slide", "2", { timeout: 6000 });
  expect(requests).toBeLessThanOrEqual(2);
  await page.unroute("**/_next/image?*");
  await page.route("**/_next/image?*", (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    return asset.includes("alignment-at-work")
      ? route.fulfill({ status: 404, body: "" })
      : route.continue();
  });
  await open(page);
  await expect(hero(page)).toHaveAttribute("data-slide", "3", { timeout: 10000 });
  await expect(hero(page).getByRole("link", { name: "Meet the team" })).toBeVisible();
});

for (const width of [320, 360, 390, 414, 768, 1024, 1440, 1920]) {
  test(`authentic images, accessible controls and responsive layout at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await decoded(page);
    await expect(hero(page)).toHaveAttribute("data-rotating", "false");
    const first = await hero(page).boundingBox();
    for (let i = 0; i < 6; i++)
      await hero(page).getByRole("button", { name: "Next slide" }).click();
    await expect(hero(page)).toHaveAttribute("data-slide", "1");
    expect((await hero(page).boundingBox())!.height).toBeCloseTo(first!.height, 0);
    for (const selector of [
      ".home-services",
      ".home-equipment-grid",
      ".home-bay",
      ".home-team-photo",
      ".home-shop",
      ".home-vehicles",
    ]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    const team = page.locator(".home-team-photo img");
    const ratio = await team.evaluate((img) => ({
      natural:
        (img as HTMLImageElement).naturalWidth / (img as HTMLImageElement).naturalHeight,
      rendered: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    }));
    expect(ratio.rendered).toBeCloseTo(ratio.natural, 2);
    if ([390, 1440].includes(width)) {
      await page.evaluate(() => scrollTo(0, 0));
      expect(
        (
          await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`home-after-${width}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

test("no-JavaScript first slide retains real HTML, photo and discovery links", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(hero(page).getByRole("heading", { level: 1 })).toContainText(
    "Comprehensive diagnostics",
  );
  await expect(
    hero(page).getByRole("link", { name: "Explore diagnostics" }),
  ).toHaveAttribute("href", "/services?search=diagnostics");
  await expect(hero(page).locator("img")).toHaveCount(1);
  await expect(hero(page).getByRole("button")).toHaveCount(0);
  await context.close();
});
