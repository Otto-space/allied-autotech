import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";

const address =
  "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria";
async function session(page: Page, role = "anonymous") {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/"))
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.route("**/api/v1/auth/session", (route) =>
    role === "anonymous"
      ? route.fulfill({
          status: 401,
          json: { success: false, error: { code: "UNAUTHORIZED" } },
        })
      : route.fulfill({
          json: {
            success: true,
            message: "Isolated QA",
            meta: { requestId: "about-quality" },
            data: {
              user: { id: "c6000000-0000-4000-8000-000000000001", role },
              mfaRequired: false,
              mfaVerifiedAt: null,
              expiresAt: "2099-01-01T00:00:00Z",
              idleExpiresAt: "2099-01-01T00:00:00Z",
            },
          },
        }),
  );
  return requests;
}
async function open(page: Page) {
  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/About Allied AutoTech/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Precision AutocareYou Can Trust.",
  );
  await page.evaluate(() => document.fonts.ready);
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536]) {
  test(`About layout, complete content and keyboard disclosures at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await session(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page);
    await expect(
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText("About");
    await expect(page.locator(".principles-list > li")).toHaveCount(11);
    await expect(
      page.getByRole("heading", { name: "Authentic parts", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Always learning", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const groups = page.locator(".equipment-disclosure");
    await expect(groups).toHaveCount(3);
    await expect(groups.first()).toHaveAttribute("open", "");
    await expect(groups.first().locator("figure")).toHaveCount(4);
    const diagnostics = groups.nth(1).locator("summary");
    await diagnostics.focus();
    await page.keyboard.press("Enter");
    await expect(groups.nth(1)).toHaveAttribute("open", "");
    await expect(
      groups.nth(1).getByRole("heading", { name: "Thermal camera", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(groups.nth(1)).not.toHaveAttribute("open");
    expect((await diagnostics.boundingBox())!.height).toBeGreaterThanOrEqual(44);
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
      path: path.join(os.tmpdir(), `about-quality-${width}-viewport.png`),
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `about-quality-${width}-full.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("section links move keyboard focus below the header on a short mobile screen", async ({
  page,
}) => {
  await session(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  for (const [name, id] of [
    ["Our purpose", "purpose"],
    ["Our principles", "principles"],
    ["Workshop equipment", "equipment"],
    ["Visit us", "visit"],
  ]) {
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name, exact: true })
      .click();
    const target = page.locator(`#${id}`);
    await expect(target).toBeFocused();
    await expect
      .poll(() => target.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(68);
    expect((await target.boundingBox())!.y).toBeLessThan(200);
  }
});

test("every equipment item and campaign poster is available with readable labels", async ({
  page,
}) => {
  await session(page);
  await open(page);
  const groups = page.locator(".equipment-disclosure");
  for (let i = 0; i < 3; i++) {
    const group = groups.nth(i);
    if (!(await group.evaluate((el) => el.hasAttribute("open"))))
      await group.locator("summary").click();
    await expect(group.locator("figure")).toHaveCount([4, 5, 6][i]);
    for (const img of await group.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (el) =>
              (el as HTMLImageElement).complete &&
              (el as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(await img.getAttribute("alt")).toBeTruthy();
    }
  }
  const archive = page.locator(".about-archive");
  await archive.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(archive.locator("figure")).toHaveCount(4);
  await expect(archive).toContainText(
    "Pictured campaign vehicles are lifestyle inspiration",
  );
  for (const anchor of await archive
    .getByRole("link", { name: /Open full-size poster:/ })
    .all()) {
    await expect(anchor).toHaveAttribute("target", "_blank");
    await expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    const href = await anchor.getAttribute("href");
    expect(href).toMatch(/^\/images\/allied-autotech\/[a-z-]+\.webp$/);
    expect((await page.request.get(href!)).status()).toBe(200);
  }
  const popupPromise = page.waitForEvent("popup");
  await archive
    .getByRole("link", {
      name: /Open full-size poster: Our original operating principles/,
    })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/images\/allied-autotech\/operating-principles\.webp$/);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  await expect(
    archive.getByRole("link", { name: "Explore current vehicle listings", exact: true }),
  ).toHaveAttribute("href", "/vehicles");
});

test("contact links use the confirmed address and safe public destinations", async ({
  page,
}) => {
  await session(page);
  await open(page);
  const visit = page.locator("#visit");
  await expect(visit).toContainText(address);
  await expect(visit.locator('a[href^="tel:"]')).toHaveAttribute(
    "href",
    "tel:+2348136075567",
  );
  await expect(visit.locator('a[href^="mailto:"]')).toHaveAttribute(
    "href",
    "mailto:alliedautotech26@gmail.com",
  );
  const directions = visit.getByRole("link", { name: "Get directions", exact: false });
  const url = new URL((await directions.getAttribute("href"))!);
  expect(url.origin).toBe("https://www.google.com");
  expect(url.searchParams.get("destination")).toBe(address);
  expect(url.searchParams.has("destination_place_id")).toBe(false);
  await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    visit.getByRole("link", { name: "WhatsApp the team", exact: false }),
  ).toHaveAttribute("href", "https://wa.me/2348136075567");
  await visit.getByRole("link", { name: "Contact customer care", exact: false }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Let’s talk about your vehicle.",
  );
  await page.goBack();
  await page.getByRole("link", { name: "Explore services", exact: false }).click();
  await expect(page).toHaveURL(/\/services$/);
});

for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) {
  test(`About stays public for ${role} without private data or mutation requests`, async ({
    page,
  }) => {
    const requests = await session(page, role);
    await open(page);
    await expect(
      page.getByRole("main").locator('a[href^="/dashboard"], a[href^="/admin"]'),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: "Contact the team", exact: false }),
    ).toHaveAttribute("href", "/contact");
    expect(requests.filter((request) => request !== "GET /api/v1/auth/session")).toEqual(
      [],
    );
  });
}

test("About content and disclosures work with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".principles-list > li")).toHaveCount(11);
    const engine = page.locator(".equipment-disclosure").last();
    await engine.locator("summary").click();
    await expect(
      engine.getByRole("heading", { name: "Smoke leak detector", exact: true }),
    ).toBeVisible();
    await page.locator(".about-archive > summary").click();
    await expect(page.locator(".about-archive figure")).toHaveCount(4);
    await page
      .getByRole("main")
      .getByRole("link", { name: "Contact the team", exact: false })
      .click();
    await expect(page).toHaveURL(/\/contact$/);
  } finally {
    await context.close();
  }
});

test("untrusted query text cannot alter the About page or contact destinations", async ({
  page,
}) => {
  await session(page);
  await page.goto(
    "/about?next=javascript%3Aalert(1)&title=%3Cscript%3Ewindow.pwned%3D1%3C%2Fscript%3E",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Precision AutocareYou Can Trust.",
  );
  await expect(page.getByRole("main")).not.toContainText("window.pwned");
  await expect(page.getByRole("main").locator('a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});
