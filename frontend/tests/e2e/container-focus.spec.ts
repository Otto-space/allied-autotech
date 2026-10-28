import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
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
            id: "parts-fitment",
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

// Allows the exact source policy to be checked against the current production CSS
// before publication. Hosted acceptance runs again without this override.
test.beforeEach(async ({ page }) => {
  if (process.env.FOCUS_POLICY_PATCH !== "true") return;
  const css = fs.readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
  const policy = css.slice(css.lastIndexOf("/* Containers receive focus"));
  await page.route("**/_next/**/*.css*", async (route) => {
    const response = await route.fetch();
    // Prepend to the actual optimized asset; CSP stays enabled and later scoped
    // rules still exercise the cascade that caused the production-only defect.
    await route.fulfill({ response, body: policy + "\n" + (await response.text()) });
  });
});

async function noContainerRing(target: ReturnType<Page["locator"]>) {
  await expect(target).toBeFocused();
  await expect(target).toHaveCSS("outline-style", "none");
  await expect(target).toHaveCSS("box-shadow", "none");
}
for (const width of [390, 1440]) {
  test(`direct learning article and repeated refresh have no container ring at ${width}`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/learn?article=parts-fitment");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await page.reload();
      const detail = page.locator(".learning-detail");
      await expect(page.locator(".learning-article")).toBeVisible();
      await noContainerRing(detail);
    }
    await page.screenshot({
      path: path.join(os.tmpdir(), `aat-container-focus-${width}.png`),
    });
    await page.keyboard.press("Tab");
    const back = page.getByRole("link", { name: "Back to results" });
    await expect(back).toBeFocused();
    await expect(back).toHaveCSS("outline-style", "solid");
  });

  test(`Allie automatic response focus has no container ring at ${width}`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/contact");
    const opener = page.getByRole("button", { name: "Ask Allie", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    await dialog.getByRole("button", { name: "Find the workshop", exact: true }).click();
    await noContainerRing(dialog.locator(".allie-response"));
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await expect(opener).toHaveCSS("outline-style", "solid");
  });
}

test("automatic panels, alerts, headings and dialogs keep borders while keyboard widgets keep rings", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/learn?article=parts-fitment");
  await expect(page.locator(".learning-article")).toBeVisible();
  await page.evaluate(() => {
    const host = document.createElement("section");
    host.className = "learning-practice-session";
    host.innerHTML = `<h2 id="focus-heading" tabindex="-1">Result heading</h2>
      <section id="focus-section" tabindex="-1">Results</section>
      <div id="focus-panel" tabindex="-1">Panel</div>
      <fieldset id="focus-group" tabindex="-1"><legend>Selection group</legend></fieldset>
      <div id="focus-alert" class="learning-errors" tabindex="-1" role="alert">Review the errors</div>
      <p id="focus-status" tabindex="-1" role="status">Complete</p>
      <div role="listbox" aria-label="Keyboard options"><div id="focus-option" role="option" aria-selected="false" tabindex="-1">Option</div></div>
      <input id="focus-input" aria-label="Keyboard field" tabindex="-1">
      <dialog id="focus-dialog" class="learning-dialog" tabindex="-1" aria-label="Focus test dialog"><button>Close</button></dialog>`;
    document.querySelector("main")!.append(host);
  });
  for (const id of [
    "focus-heading",
    "focus-section",
    "focus-panel",
    "focus-group",
    "focus-alert",
    "focus-status",
  ]) {
    await page.locator("#" + id).focus();
    await noContainerRing(page.locator("#" + id));
  }
  await expect(page.locator("#focus-alert")).toHaveCSS("border-top-width", "2px");
  await page.keyboard.press("Tab");
  for (const id of ["focus-option", "focus-input"]) {
    await page.locator("#" + id).focus();
    await expect(page.locator("#" + id)).toHaveCSS("outline-style", "solid");
  }
  await page.locator("#focus-dialog").evaluate((el: HTMLDialogElement) => {
    el.showModal();
    el.focus();
  });
  await noContainerRing(page.locator("#focus-dialog"));
  await expect(page.locator("#focus-dialog")).toHaveCSS("border-top-style", "solid");
  await page.locator("#focus-dialog").getByRole("button").focus();
  await expect(page.locator("#focus-dialog").getByRole("button")).toHaveCSS(
    "outline-style",
    "solid",
  );
});
