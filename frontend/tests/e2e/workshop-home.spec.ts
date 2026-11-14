import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { HERO_INTERVAL_MS } from "@/lib/hero-carousel";
const hero = (page: Page) => page.getByRole("region", { name: "Workshop highlights" });
async function open(page: Page, waitUntil: "load" | "domcontentloaded" = "load") {
  const response = await page.goto("/", { waitUntil });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Allied AutoTech/);
  await expect(hero(page).getByRole("heading", { level: 1 })).toContainText(
    "Understand your vehicle",
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

for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1366, 1440]) {
  test(`workshop lift link reaches its photograph and preserves keyboard access at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const link = page
      .getByRole("navigation", { name: "Workshop equipment and approach" })
      .getByRole("link", { name: "Two-post vehicle lift" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/about#equipment-item-service-bay-lift$/);
    const lift = page.locator("#equipment-item-service-bay-lift");
    await expect(lift).toBeInViewport();
    await expect(
      lift.getByRole("heading", { name: "Two-post vehicle lift" }),
    ).toBeVisible();
    await page.reload();
    await expect(lift).toBeInViewport();
    const photo = lift.getByRole("link", { name: "View photo of Two-post vehicle lift" });
    await photo.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(photo).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
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
  await expect(hero(page).getByRole("link", { name: "Browse the Shop" })).toBeVisible();
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
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
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
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
  await expect(hero(page)).toHaveAttribute("data-rotating", "false");
  await info.attach("visibility-limit", {
    body: "Visibility state is simulated, not a physical browser tab-switch test.",
    contentType: "text/plain",
  });
});

test("a stalled hero photo is skipped after the bounded wait", async ({ page }) => {
  test.setTimeout(50000);
  let requested = 0;
  await page.route("**/_next/image?*", async (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (asset.includes("family-editorial")) {
      requested++;
      await new Promise((r) => setTimeout(r, 21000));
    }
    return route.continue();
  });
  const completedRequest = page.waitForResponse(
    (response) =>
      (new URL(response.url()).searchParams.get("url") ?? "").includes(
        "family-editorial",
      ),
    { timeout: 30000 },
  );
  await open(page);
  await expect(hero(page)).toHaveAttribute("data-slide", "3", { timeout: 19000 });
  await expect(hero(page).getByRole("link", { name: "Browse the Shop" })).toBeVisible();
  expect(requested).toBeLessThanOrEqual(2);
  // Finish the deliberately delayed request before this page/context is disposed.
  await completedRequest;
});
test("all failed hero photos retain readable content and a working discovery link", async ({
  page,
}) => {
  await page.route("**/_next/image?*", (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    return /workshop-editorial|family-editorial|parts-editorial|showroom-neutral-editorial/.test(
      asset,
    )
      ? route.fulfill({ status: 404, body: "" })
      : route.continue();
  });
  await open(page);
  await expect(hero(page).getByText("Image unavailable", { exact: true })).toBeVisible();
  await expect(hero(page)).toHaveAttribute("data-rotating", "false");
  await expect(hero(page).getByRole("button", { name: "Next slide" })).toBeDisabled();
  await expect(hero(page).getByRole("heading", { level: 1 })).toContainText(
    "Understand your vehicle",
  );
  await expect(hero(page).getByRole("link", { name: "View diagnostics" })).toBeVisible();
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
    '[aria-label="Workshop highlights"]',
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
  test.setTimeout(105000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await decoded(page);
  const changes: { slide: number; elapsed: number }[] = [];
  let previous = Date.now();
  for (let step = 1; step <= 12; step++) {
    const slide = (step % 4) + 1;
    await expect(hero(page)).toHaveAttribute("data-slide", String(slide), {
      timeout: 10000,
    });
    const now = Date.now();
    changes.push({ slide, elapsed: now - previous });
    previous = now;
    if (step > 1) expect(changes.at(-1)!.elapsed).toBeGreaterThan(HERO_INTERVAL_MS - 600);
    await expect(hero(page).locator('img[data-current="true"]')).toHaveCount(1);
    await expect(
      hero(page).getByRole("group", { name: `${slide} of 4`, exact: true }),
    ).toBeVisible();
    await expect(hero(page).locator("a[data-hero-primary]:visible")).toHaveAttribute(
      "href",
      ["/services?search=diagnostics", "/services", "/parts", "/vehicles"][slide - 1],
    );
  }
  expect(errors).toEqual([]);
  await info.attach("real-time-loops", {
    body: JSON.stringify(changes),
    contentType: "application/json",
  });
});

test("laptop hover keeps rotating while manual pause and keyboard focus remain persistent", async ({
  page,
}) => {
  test.setTimeout(100000);
  await open(page);
  await decoded(page);
  for (let i = 0; i < 2; i++) {
    await hero(page).hover();
    const current = await hero(page).getAttribute("data-slide");
    await expect(hero(page)).not.toHaveAttribute("data-slide", current!, {
      timeout: HERO_INTERVAL_MS + 2500,
    });
    await expect(hero(page)).toHaveAttribute("data-rotating", "true");
  }
  await hero(page).getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.move(1, 1);
  const paused = await hero(page).getAttribute("data-slide");
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
  await expect(hero(page)).toHaveAttribute("data-slide", paused!);
  await hero(page).getByRole("button", { name: "Play slideshow" }).click();
  await page.mouse.move(1, 1);
  await expect(hero(page)).not.toHaveAttribute("data-slide", paused!, { timeout: 8000 });
  await hero(page).locator("a[data-hero-primary]:visible").focus();
  const focused = await hero(page).getAttribute("data-slide");
  await page
    .getByRole("link", { name: "Allied AutoTech home", exact: true })
    .first()
    .focus();
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
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
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
  await expect(hero(page)).toHaveAttribute("data-slide", current!);
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(1, 1);
  await expect(hero(page)).not.toHaveAttribute("data-slide", current!, { timeout: 8500 });
  await hero(page).getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.move(1, 1);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(HERO_INTERVAL_MS + 500);
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
  let releaseImage!: () => void;
  const delayedImage = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route("**/_next/image?*", async (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    if (asset.includes("family-editorial")) {
      requests++;
      await delayedImage;
    }
    return route.continue();
  });
  try {
    // Observe the pending state before releasing the image. Waiting for the load
    // event would include the delayed eager image and make this a timer race.
    await open(page, "domcontentloaded");
    await expect(hero(page)).toHaveAttribute("data-waiting", "true", { timeout: 10000 });
    await expect(hero(page)).toHaveAttribute("data-slide", "1");
    await expect(
      hero(page).getByRole("link", { name: "View diagnostics" }),
    ).toBeVisible();
    releaseImage();
    await expect(hero(page)).toHaveAttribute("data-slide", "2", { timeout: 7900 });
  } finally {
    releaseImage();
  }
  expect(requests).toBeLessThanOrEqual(2);
  await page.unroute("**/_next/image?*");
  await page.route("**/_next/image?*", (route) => {
    const asset = new URL(route.request().url()).searchParams.get("url") ?? "";
    return asset.includes("family-editorial")
      ? route.fulfill({ status: 404, body: "" })
      : route.continue();
  });
  await open(page);
  await expect(hero(page)).toHaveAttribute("data-slide", "3", { timeout: 10000 });
  await expect(hero(page).getByRole("link", { name: "Browse the Shop" })).toBeVisible();
});

for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1366, 1440]) {
  test(`editorial backgrounds, genuine workshop images, accessible controls and responsive layout at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await decoded(page);
    await expect(hero(page)).toHaveAttribute("data-rotating", "false");
    await page.evaluate(() => document.fonts.ready);
    const composition = await hero(page).evaluate((root) => {
      const heading = root.querySelector("h1")!;
      const copy = root.querySelector('[data-active="true"] p')!;
      const action = root.querySelector('[data-active="true"] a')!;
      const image = root.querySelector("img")!;
      return {
        heading: heading.getBoundingClientRect().toJSON(),
        action: action.getBoundingClientRect().toJSON(),
        image: image.getBoundingClientRect().toJSON(),
        headingFont: getComputedStyle(heading).fontFamily,
        copyFont: getComputedStyle(copy).fontFamily,
        actionFont: getComputedStyle(action).fontFamily,
        background: getComputedStyle(root).backgroundImage,
      };
    });
    expect(composition.headingFont.toLowerCase()).toContain("nippo");
    expect(composition.copyFont.toLowerCase()).toContain("quicksand");
    expect(composition.actionFont.toLowerCase()).toContain("quicksand");
    expect(composition.background).toBe("none");
    // Editorial backgrounds sit behind the copy and fill the carousel rather than
    // becoming a separate photo column. Hit testing below verifies usable controls.
    expect(composition.image.left).toBeLessThanOrEqual(composition.heading.left);
    expect(composition.image.right).toBeGreaterThanOrEqual(composition.heading.right);
    expect(composition.image.top).toBeLessThanOrEqual(composition.heading.top);
    expect(composition.image.bottom).toBeGreaterThanOrEqual(composition.action.bottom);
    const first = await hero(page).boundingBox();
    for (let i = 0; i < 8; i++) {
      await hero(page).getByRole("button", { name: "Next slide" }).click();
      await expect(hero(page)).toHaveAttribute("data-slide", String(((i + 1) % 4) + 1));
      expect((await hero(page).boundingBox())!.height).toBeCloseTo(first!.height, 0);
    }
    await expect(hero(page)).toHaveAttribute("data-slide", "1");
    expect((await hero(page).boundingBox())!.height).toBeCloseTo(first!.height, 0);
    for (const control of await hero(page).getByRole("button").all()) {
      const bounds = await control.boundingBox();
      const picker = await control.getAttribute("aria-label");
      expect(bounds!.width).toBeGreaterThanOrEqual(
        picker?.startsWith("Show slide") ? 24 : 44,
      );
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    for (const selector of [
      ".home-services",
      ".home-workshop__grid",
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
    await team.scrollIntoViewIfNeeded();
    await expect
      .poll(() => team.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
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

for (const width of [320, 390])
  test(`short ${width}px phone keeps hero actions clear of support and restores the normal bar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 667 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await decoded(page);
    const support = page.getByRole("navigation", {
      name: "Customer support",
      exact: true,
    });
    expect((await support.boundingBox())!.width).toBe(48);
    for (const action of [
      hero(page).locator("a[data-hero-primary]:visible"),
      ...(await hero(page).getByRole("button").all()),
    ]) {
      await action.scrollIntoViewIfNeeded();
      expect(
        await action.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
      ).toBe(true);
    }
    await page.locator(".home-team-photo").scrollIntoViewIfNeeded();
    await expect(hero(page)).toHaveAttribute("data-in-view", "false");
    expect((await support.boundingBox())!.width).toBe(48);
    await page.goto("/about");
    expect((await support.boundingBox())!.width).toBe(48);
  });

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
    "Understand your vehicle",
  );
  await expect(
    hero(page).getByRole("link", { name: "View diagnostics" }),
  ).toHaveAttribute("href", "/services?search=diagnostics");
  await expect(hero(page).locator("img")).toHaveCount(1);
  await expect(hero(page).getByRole("button")).toHaveCount(0);
  await context.close();
});
