import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

async function entryVisible(page: Page) {
  const breadcrumb = page.locator('main nav[aria-label="Breadcrumb"]').first();
  await expect(breadcrumb).toBeVisible();
  await expect
    .poll(() =>
      breadcrumb.evaluate((element) => {
        const header = document.querySelector(".site-header")!.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return box.top >= header.bottom && box.bottom < innerHeight;
      }),
    )
    .toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 900],
  [844, 390],
  [1024, 900],
  [1440, 900],
]) {
  test(`Support remains fixed and Allie fits ${width}x${height}`, async ({ page }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height });
    await page.goto("/contact");
    await entryVisible(page);
    const dock = page.locator(".support-controls");
    await expect(dock).toHaveCSS("position", "fixed");
    const initial = await dock.boundingBox();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => Math.round((await dock.boundingBox())!.y))
      .toBe(Math.round(initial!.y));
    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight))
      .toBe(true);
    const trigger = page.getByRole("button", { name: "Ask Allie", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("What do you need help with?").fill("workshop");
    await dialog.getByRole("button", { name: "Find reviewed help" }).click();
    await expect(dialog.locator(".allie-answer")).toContainText("Find the workshop");
    const content = dialog.locator(".allie-dialog-body");
    await expect(content).toHaveCSS("scrollbar-width", "none");
    await expect
      .poll(() => content.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);
    await content.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(() =>
        dialog
          .locator(".learning-dialog-head")
          .evaluate((el) => el.getBoundingClientRect().top >= 0),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".allie-dialog[open]").analyze())
        .violations,
    ).toEqual([]);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-allie-viewport-${width}.png`),
      });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`New pages, direct anchors and repeated links reveal their destinations at ${width}`, async ({
    page,
  }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/contact");
    await page
      .locator("footer")
      .getByRole("link", { name: "About Allied AutoTech" })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await entryVisible(page);
    await page
      .locator("footer")
      .getByRole("link", { name: "Customer Care", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact$/);
    await entryVisible(page);
    await page.getByRole("link", { name: "Send an enquiry", exact: true }).click();
    await expect(page.locator("#enquiry")).toBeFocused();
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole("link", { name: "Send an enquiry", exact: true }).click();
    await expect(page.locator("#enquiry")).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator("#enquiry")
          .evaluate(
            (el) =>
              el.getBoundingClientRect().top >=
              document.querySelector(".site-header")!.getBoundingClientRect().bottom,
          ),
      )
      .toBe(true);
    await page.locator('.contact-channels a[href="#workshop"]').click();
    await expect(page.locator("#workshop")).toBeFocused();
    await page.goto("/contact#workshop");
    await expect
      .poll(() =>
        page.locator("#workshop").evaluate((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.top >=
              document.querySelector(".site-header")!.getBoundingClientRect().bottom &&
            box.bottom < innerHeight
          );
        }),
      )
      .toBe(true);
    await page.reload();
    // Reload may restore native browser focus; the hash destination must remain
    // visible below the sticky header regardless of that browser preference.
    await expect
      .poll(() =>
        page.locator("#workshop").evaluate((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.top >=
              document.querySelector(".site-header")!.getBoundingClientRect().bottom &&
            box.bottom < innerHeight
          );
        }),
      )
      .toBe(true);
    await page.goBack();
    expect(errors).toEqual([]);
  });

  test(`Selectors, radios and checkboxes reveal their linked fields at ${width}`, async ({
    page,
  }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/contact");
    await page.getByLabel("Enquiry type", { exact: true }).selectOption("VEHICLE");
    await expect
      .poll(() =>
        page
          .locator("#support-vehicle-enquiry")
          .evaluate(
            (el) =>
              el.getBoundingClientRect().top >= 68 &&
              el.getBoundingClientRect().top < innerHeight - 100,
          ),
      )
      .toBe(true);
    await page.getByRole("radio", { name: "Discuss my vehicle requirements" }).check();
    await expect
      .poll(() =>
        page
          .locator("#support-opening")
          .evaluate(
            (el) =>
              el.getBoundingClientRect().top >= 68 &&
              el.getBoundingClientRect().top < innerHeight - 100,
          ),
      )
      .toBe(true);
    const checkbox = page.getByLabel("Include my preferred date and time");
    await checkbox.check();
    await expect
      .poll(() =>
        page.locator("#support-visit-date").evaluate((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.top >= 68 &&
            box.bottom <
              document.querySelector(".support-controls")!.getBoundingClientRect().top
          );
        }),
      )
      .toBe(true);
    await checkbox.uncheck();
    await expect(page.locator("#support-visit-date")).toHaveCount(0);
    await page.getByLabel("Your name", { exact: true }).fill("Isolated viewport check");
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Isolated viewport check",
    );
    await expect(
      page.getByRole("radio", { name: "Discuss my vehicle requirements" }),
    ).toBeChecked();
    expect(errors).toEqual([]);
  });
}
