import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const shots = path.join(os.tmpdir(), "allied-allie-20261026");
async function identity(context: BrowserContext, name: string) {
  const cookies = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.LOCALAPPDATA!,
        "AlliedAutoTech/database-verification/help-learn-browser.json",
      ),
      "utf8",
    ),
  );
  const [key, value] = cookies[name].split("=");
  await context.addCookies([
    { name: key, value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3107" },
  ]);
}
function observe(page: Page) {
  const mutations: string[] = [],
    external: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (!/^(GET|HEAD|OPTIONS)$/.test(r.method()))
      mutations.push(r.method() + " " + r.url());
    if (
      /^https?:/.test(r.url()) &&
      !["localhost", "127.0.0.1"].includes(new URL(r.url()).hostname)
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource"))
      errors.push(message.text());
  });
  return { mutations, external, errors };
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
}
async function axe(page: Page, selector: string) {
  expect(
    (
      await new AxeBuilder({ page })
        .include(selector)
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
async function shot(page: Page, name: string, fullPage = false) {
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, name + ".png"), fullPage });
}

for (const width of [360, 390, 768, 1024, 1440])
  test(`Help entry, hub modes and compact grounded Allie at ${width}`, async ({
    page,
  }) => {
    const seen = observe(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/help");
    await expect(page).toHaveTitle(/Help centre/);
    const card = page.locator(".help-learning-card");
    await expect(
      card.getByRole("heading", { name: "Let Allie show you around." }),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Explore Help & Learn" }),
    ).toHaveAttribute("href", "/learn");
    await expect(
      page.getByRole("searchbox", { name: "Search help topics" }),
    ).toBeVisible();
    await noOverflow(page);
    await axe(page, "main");
    await shot(page, `help-${width}`, width === 1440 || width === 390);
    await card.getByRole("link", { name: "Explore Help & Learn" }).click();
    await expect(page).toHaveURL(/\/learn$/);
    await expect(page.getByText("5 available tasks", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
    const answer = page.getByRole("tab", { name: /Find an answer/ });
    await answer.focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: /Practise/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("link", { name: "Find fictional Corolla brake pads", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Home");
    await expect(answer).toHaveAttribute("aria-selected", "true");
    await noOverflow(page);
    await axe(page, "main");
    await shot(page, `learn-${width}`, width === 1440 || width === 390);
    const trigger = page.getByRole("button", { name: "Ask Allie", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("What do you need help with?").fill("How do I find a part?");
    await dialog.getByRole("button", { name: "Find reviewed help" }).click();
    await expect(dialog.locator(".allie-answer")).toContainText("Search by product name");
    await expect(dialog).toContainText("no generative AI");
    await expect(
      dialog.getByRole("link", { name: "Read answer", exact: true }),
    ).toHaveAttribute("href", "/learn?article=parts-fitment");
    await expect(dialog.locator(".learning-modes,.learning-topics")).toHaveCount(0);
    await noOverflow(page);
    await axe(page, ".allie-dialog[open]");
    await shot(page, `assistant-${width}`);
    // Native dialog trap and return focus; both ends stay in the panel.
    await dialog.getByRole("button", { name: "Close help" }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("dialog[open]")),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(seen.errors).toEqual([]);
    expect(seen.mutations).toEqual([]);
    expect(seen.external).toEqual([]);
  });

test("Allie unknown/context/load failure, hide and restore preserve the page draft", async ({
  page,
}) => {
  await page.goto("/contact");
  const draft = page.getByRole("textbox", { name: "Your message", exact: true });
  await expect(draft).toBeVisible();
  await draft.fill("Local unsent acceptance draft");
  const trigger = page.getByRole("button", { name: "Ask Allie", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
  await dialog
    .getByLabel("What do you need help with?")
    .fill("unobtainium zeppelin schedule");
  await dialog.getByRole("button", { name: "Find reviewed help" }).click();
  await expect(dialog).toContainText("couldn’t find a reviewed answer");
  await dialog.getByRole("button", { name: "Explain this page" }).click();
  await expect(dialog).toContainText("don’t have a specific reviewed explanation");
  await dialog
    .getByRole("button", { name: "Hide floating help for this session" })
    .click();
  await expect(trigger).toHaveCount(0);
  await expect(draft).toHaveValue("Local unsent acceptance draft");
  await page.goto("/help");
  await page
    .locator(".help-learning-card")
    .getByRole("button", { name: "Ask Allie" })
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".support-controls").getByRole("button", { name: "Ask Allie" }),
  ).toBeVisible();
  await page.route("**/api/v1/**learning/**", (r) =>
    r.fulfill({ status: 503, json: { success: false } }),
  );
  await page
    .locator(".support-controls")
    .getByRole("button", { name: "Ask Allie" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("could not be verified");
  await expect(dialog.locator(".allie-answer")).toHaveCount(0);
  await page.unroute("**/api/v1/**learning/**");
  await dialog.getByRole("button", { name: "Retry help" }).click();
  await expect(dialog.getByLabel("What do you need help with?")).toBeVisible();
});

test("private answer and practice draft clear on actual identity change; product-photo help stays administrator-only", async ({
  page,
  context,
}) => {
  await identity(context, "care");
  const seen = observe(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
  await dialog.getByLabel("What do you need help with?").fill("customer care request");
  await dialog.getByRole("button", { name: "Find reviewed help" }).click();
  await expect(dialog.locator(".allie-answer")).toContainText(
    "Handle a Customer Care request",
  );
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Ask Allie", exact: true }).click();
  await expect(dialog.getByLabel("What do you need help with?")).toHaveValue("");
  await expect(dialog).not.toContainText("Handle a Customer Care request");
  await page.keyboard.press("Escape");
  await identity(context, "owner");
  await page.goto("/learn?q=product+photo");
  await expect(
    page.getByRole("link", { name: "Manage product photos", exact: true }),
  ).toBeVisible();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByRole("link", { name: "Manage product photos", exact: true }),
  ).toHaveCount(0);
  await identity(context, "care");
  await page.goto("/learn/practice/care-triage");
  await page.getByRole("button", { name: "Fill sample data" }).click();
  const reply = page.getByLabel("Sample public reply (fictional)");
  await expect(reply).toHaveValue(/make, model, year/);
  await reply.fill("Sample reply only: please share the engine and filter number.");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Practice review complete" }),
  ).toContainText("You chose:");
  await expect(page.locator(".learning-mode-label")).toHaveCount(1);
  await expect(page.locator(".support-controls")).toHaveCount(0);
  await shot(page, "practice-care-desktop", true);
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(reply).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("Sample reply only");
  expect(seen.mutations).toEqual([]);
  expect(seen.external).toEqual([]);
});

test("parts oil-filter progression survives settled results, access refresh and target remount", async ({
  page,
}) => {
  const seen = observe(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/parts#learn=parts-find");
  const guide = page.getByRole("complementary", { name: "Optional guide" });
  const input = page.locator('[data-learning-target="parts-search"]');
  const next = guide.getByRole("button", { name: "Next step", exact: true });
  await expect(next).toBeDisabled();
  await expect(guide).toContainText("Enter at least two characters");
  await input.fill("oil filter");
  await page.getByRole("button", { name: "Search products", exact: true }).click();
  await page.waitForURL(/search=oil/);
  await page
    .locator('[data-learning-target="parts-results"][aria-busy="false"]')
    .waitFor();
  await expect(next).toBeEnabled();
  const recheck = page.waitForResponse(
    (r) => r.url().includes("/learning/catalogue") && r.status() === 200,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await recheck;
  await expect(next).toBeEnabled();
  // Exercise the existing scheduled refresh, not only a synthetic focus event.
  await page.waitForResponse(
    (r) => r.url().includes("/learning/catalogue") && r.status() === 200,
    { timeout: 35000 },
  );
  await expect(next).toBeEnabled();
  await page.evaluate(() => {
    const old = document.querySelector('[data-learning-target="parts-search"]')!;
    old.replaceWith(old.cloneNode(true));
  });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(guide).toContainText("2 of 2");
  await expect(next).toBeEnabled();
  await guide.getByRole("button", { name: "Back", exact: true }).click();
  await expect(next).toBeEnabled();
  await shot(page, "guide-after-oil-filter");
  await next.click();
  await next.click();
  await expect(guide).toContainText("Guide complete");
  expect(seen.mutations).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test("choice-only hint is honest; sample practice clears on leave without business network traffic", async ({
  page,
  context,
}) => {
  await identity(context, "finance");
  const seen = observe(page);
  await page.goto("/learn/practice/payment-discrepancy");
  await expect(page.getByRole("button", { name: "Fill sample data" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByRole("note")).toContainText("pending");
  await expect(page.getByRole("radio").first()).not.toBeChecked();
  await page.getByRole("radio").last().check();
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Practice feedback" }),
  ).toContainText("screenshot");
  await page.getByRole("link", { name: "Exit practice", exact: true }).click();
  await page.goto("/learn/practice/payment-discrepancy");
  await expect(page.getByRole("radio").last()).not.toBeChecked();
  expect(seen.mutations).toEqual([]);
  expect(seen.external).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test("search all kinds and preserve query/mode through article, written guide and practice", async ({
  page,
}) => {
  await page.goto("/learn?q=shop+fitment");
  await expect(
    page.getByText("3 available tasks matching your search", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Guide me/ }).click();
  await page.getByRole("link", { name: "Find the right part", exact: true }).click();
  await expect(page.locator(".learning-written")).toBeVisible();
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("shop fitment");
  await expect(page.getByRole("tab", { name: /Guide me/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: /Practise/ }).click();
  await page
    .getByRole("link", { name: "Find fictional Corolla brake pads", exact: true })
    .click();
  await expect(page.locator(".learning-practice-session")).toBeVisible();
  await page.getByRole("link", { name: "Exit practice", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("shop fitment");
  await expect(page.getByRole("tab", { name: /Practise/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("reduced-motion logical reflow, reachable sheet controls and unavailable guide recovery", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/learn");
    await expect(page.getByText("5 available tasks", { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "Ask Allie", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeCloseTo(width, 0);
    await dialog.getByLabel("What do you need help with?").fill("part");
    await dialog.getByRole("button", { name: "Find reviewed help" }).click();
    await expect(dialog.locator(".allie-answer")).toBeVisible();
    await dialog
      .getByRole("button", { name: "Hide floating help for this session" })
      .scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Close help" })).toBeInViewport();
    await noOverflow(page);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/**learning/**", (r) =>
    r.fulfill({ status: 503, json: { success: false } }),
  );
  await page.goto("/parts#learn=parts-find");
  await expect(page.getByRole("complementary").getByRole("alert")).toContainText(
    "could not be verified",
  );
  await page.getByRole("button", { name: "Exit guide" }).click();
  await expect(page.getByRole("complementary", { name: "Optional guide" })).toHaveCount(
    0,
  );
  await expect(page).not.toHaveURL(/#learn=/);
});
