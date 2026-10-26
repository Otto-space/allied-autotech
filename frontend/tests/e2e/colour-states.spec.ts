import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fixture } from "../fixtures/overview-browser";
import { workOverviewFixture } from "../fixtures/work-overview";

const shots = path.join(os.tmpdir(), "allied-colour-20261026");
const css = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .evaluate((el, key) => getComputedStyle(el).getPropertyValue(key), property);

// Browser-only harness uses the application's compiled CSS. No debug route is shipped.
async function gallery(page: Page) {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 401, json: { success: false } }),
  );
  await page.goto("/about");
  await page.locator(".about-hero").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    document.body.innerHTML = `<main style="max-width:1100px;margin:auto;padding:28px">
      <h1>Allied colour and state fixtures</h1>
      <p>Isolated controls. No customer data or server mutations.</p>
      <section aria-label="Actions" style="display:flex;gap:16px;flex-wrap:wrap;padding:20px 0">
        <button id="primary" class="button">Save changes</button>
        <button id="secondary" class="button secondary">Cancel</button>
        <button id="danger" class="button danger">Delete draft</button>
        <button id="disabled" class="button" disabled>Unavailable</button>
        <button id="loading" class="button" disabled aria-busy="true">Saving…</button>
        <button id="selected" class="button ui-action" aria-pressed="true">Selected view</button>
      </section>
      <section style="background:var(--gradient-brand);color:var(--text-inverse);padding:28px;border-radius:8px">
        <h2>Precision Autocare You Can Trust.</h2>
        <p style="color:var(--text-inverse-muted)">Black and red. Clear actions. Readable guidance.</p>
        <button id="inverse" class="button">Explore services</button>
        <a class="text-link" style="color:var(--link-inverse);margin-left:20px" href="#controls">View controls</a>
      </section>
      <section id="controls" style="padding:24px 0">
        <h2>Forms and selection</h2>
        <div class="form-row">
          <label class="field">Your name<input class="input" id="name" required></label>
          <label class="field">Email<input class="input" id="invalid" type="email" aria-invalid="true" aria-describedby="email-error" value="incomplete"><span id="email-error" style="color:var(--error-ink)">Enter a complete email address.</span></label>
          <label class="field">Reference<input class="input" readonly value="SAMPLE-001"></label>
          <label class="field">Unavailable field<input class="input" disabled value="Not available"></label>
        </div>
        <fieldset style="padding:20px"><legend>Preferences</legend>
          <label><input id="check" type="checkbox"> Email updates</label>
          <label><input id="mixed" type="checkbox"> Some selected</label>
          <label><input id="radio1" type="radio" name="scope" checked> All items</label>
          <label><input id="radio2" type="radio" name="scope"> Available items</label>
          <label><input type="checkbox" disabled checked> Unavailable preference</label>
        </fieldset>
        <label class="field">Branch<select id="branch"><option>Choose a branch</option><option>Fixture branch</option></select></label>
        <label class="field">Range<input type="range" min="0" max="10" value="3"></label>
        <label class="field">Attachment<input type="file"></label>
      </section>
      <section aria-label="Statuses" style="display:flex;gap:12px;flex-wrap:wrap;padding:20px 0">
        <span data-status="ACTIVE">Active</span><span data-status="PENDING">Pending</span>
        <span data-status="FAILED">Failed</span><span data-status="SENT">Sent to provider</span>
        <span data-status="CLOSED">Closed</span>
      </section>
      <button class="button secondary" id="open-dialog">Open dialog</button>
      <dialog id="fixture-dialog" class="support-dialog" aria-labelledby="dialog-title">
        <h2 id="dialog-title">Fixture confirmation</h2><p>No live action will be taken.</p>
        <button id="close-dialog" class="button">Close</button>
      </dialog>
    </main>`;
    (document.querySelector("#mixed") as HTMLInputElement).indeterminate = true;
    const dialog = document.querySelector("dialog")!;
    document
      .querySelector("#open-dialog")!
      .addEventListener("click", () => dialog.showModal());
    document
      .querySelector("#close-dialog")!
      .addEventListener("click", () => dialog.close());
  });
}

test("actions compose hover, pressed, selected, disabled and keyboard focus", async ({
  page,
}) => {
  await gallery(page);
  await expect(page.locator("#primary")).toHaveCSS(
    "background-color",
    "rgb(215, 25, 32)",
  );
  await page.keyboard.press("Tab");
  await expect(page.locator("#primary")).toBeFocused();
  await expect(page.locator("#primary")).toHaveCSS("outline-width", "3px");
  await page.locator("#primary").hover();
  await expect(page.locator("#primary")).toHaveCSS(
    "background-color",
    "rgb(181, 18, 24)",
  );
  await expect(page.locator("#primary")).toBeFocused();
  expect(await css(page, "#primary", "box-shadow")).toContain("255, 255, 255");
  await page.mouse.down();
  await expect(page.locator("#primary")).toHaveCSS(
    "background-color",
    "rgb(149, 14, 20)",
  );
  await page.mouse.up();
  await page.locator("#secondary").hover();
  await expect(page.locator("#secondary")).toHaveCSS(
    "background-color",
    "rgb(255, 240, 241)",
  );
  await page.locator("#danger").hover();
  await expect(page.locator("#danger")).toHaveCSS("background-color", "rgb(127, 29, 29)");
  const selected = await css(page, "#selected", "background-color");
  await page.locator("#selected").hover();
  expect(await css(page, "#selected", "background-color")).toBe(selected);
  const disabled = await css(page, "#disabled", "background-color");
  await page.locator("#disabled").hover();
  expect(await css(page, "#disabled", "background-color")).toBe(disabled);
  await expect(page.locator("#disabled")).toBeDisabled();
  await page.locator("#primary").hover();
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({
    path: path.join(shots, "gallery-hover-focus.png"),
    fullPage: true,
  });
});

test("native selection, invalid focus, readonly and modal keyboard behaviour", async ({
  page,
}) => {
  await gallery(page);
  await page.locator("#check").click();
  await expect(page.locator("#check")).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.locator("#mixed")).toBeFocused();
  expect(
    await page.locator("#mixed").evaluate((el) => (el as HTMLInputElement).indeterminate),
  ).toBe(true);
  await page.keyboard.press("Space");
  expect(
    await page.locator("#mixed").evaluate((el) => (el as HTMLInputElement).indeterminate),
  ).toBe(false);
  await page.locator("#radio1").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#radio2")).toBeChecked();
  await page.locator("#radio2").hover();
  await expect(page.locator("#radio2")).toBeFocused();
  await expect(page.locator("#radio2")).toHaveCSS("outline-width", "3px");
  await expect(page.locator("#radio2")).toHaveCSS("accent-color", "rgb(215, 25, 32)");
  await page.locator("#name").click();
  await page.keyboard.press("Tab");
  await expect(page.locator("#invalid")).toBeFocused();
  await expect(page.locator("#invalid")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#invalid")).toHaveCSS("outline-width", "3px");
  await page.screenshot({ path: path.join(shots, "gallery-invalid-focus.png") });
  await page.locator("#name").evaluate((el) => el.classList.add("learning-highlight"));
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#name")).toBeFocused();
  await expect(page.locator("#name")).toHaveCSS("outline-color", "rgb(8, 12, 15)");
  await page.locator("#open-dialog").click();
  await expect(page.locator("#close-dialog")).toBeFocused();
  await page.screenshot({ path: path.join(shots, "gallery-dialog.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("#open-dialog")).toBeFocused();
  await expect(page.locator("[readonly]")).toBeEditable({ editable: false });
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`state gallery contrast and reflow ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await gallery(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({
      path: path.join(shots, `gallery-${width}.png`),
      fullPage: true,
    });
  });
}

test("forced colours retain system focus and reduced motion", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await gallery(page);
  await page.keyboard.press("Tab");
  await expect(page.locator("#primary")).toBeFocused();
  await expect(page.locator("#primary")).toHaveCSS("outline-style", "solid");
  await expect(page.locator("#primary")).toHaveCSS("outline-width", "3px");
  await page.screenshot({
    path: path.join(shots, "gallery-forced-colours.png"),
    fullPage: true,
  });
});

for (const role of ["CUSTOMER", "ADMIN", "SUPER_ADMIN"]) {
  test(`${role} actual dashboard retains light data surfaces and branded navigation`, async ({
    page,
  }) => {
    if (role === "CUSTOMER") await fixture(page, role);
    else await workOverviewFixture(page, role);
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    await expect(page.locator(".sidebar")).toBeVisible();
    expect(await css(page, ".sidebar", "background-image")).toContain("linear-gradient");
    const active = page.locator('.side-nav a[aria-current="page"]').first();
    await active.hover();
    await expect(active).toHaveCSS("background-color", "rgb(101, 12, 18)");
    for (
      let step = 0;
      step < 30 && !(await active.evaluate((el) => el === document.activeElement));
      step++
    )
      await page.keyboard.press("Tab");
    await expect(active).toBeFocused();
    expect(await active.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(
      "255, 255, 255",
    );
    await page.screenshot({
      path: path.join(shots, `dashboard-${role}.png`),
      fullPage: true,
    });
  });
}
