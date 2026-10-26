import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const shots = path.join(os.tmpdir(), "allied-allie-20261026");
async function identity(context: BrowserContext, name: string) {
  const file = path.join(
    process.env.LOCALAPPDATA!,
    "AlliedAutoTech/database-verification/help-learn-browser.json",
  );
  const cookies = JSON.parse(fs.readFileSync(file, "utf8"));
  const [key, value] = cookies[name].split("=");
  await context.addCookies([
    { name: key, value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3107" },
  ]);
}
function observe(page: Page) {
  const writes: string[] = [],
    errors: string[] = [],
    external: string[] = [];
  page.on("request", (req) => {
    if (!/^(GET|HEAD|OPTIONS)$/.test(req.method()))
      writes.push(req.method() + " " + req.url());
    if (
      /^https?:/.test(req.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(req.url()).hostname)
    )
      external.push(req.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { writes, errors, external };
}
test("public help, deterministic search, direct private denial and back navigation", async ({
  page,
}) => {
  const seen = observe(page);
  await page.goto("/learn");
  await expect(
    page.getByRole("status").filter({ hasText: "5 available tasks" }),
  ).toBeVisible();
  const input = page.getByRole("searchbox", { name: "What would you like to do?" });
  await input.fill("shop compatibility");
  await expect(
    page.getByText("3 available tasks matching your search", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Find a part and understand compatibility", exact: true })
    .click();
  await expect(
    page
      .locator(".learning-article")
      .getByRole("heading", { name: "Find a part and understand compatibility" }),
  ).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue("shop compatibility");
  await page.getByRole("button", { name: "Clear search" }).click();
  await input.fill("payment-discrepancy-private");
  await expect(page.getByText("No matching topics.", { exact: false })).toBeVisible();
  await page.goto("/learn?article=privileged-recovery");
  await expect(
    page.getByText("This learning item is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Use the approved account recovery process" }),
  ).toHaveCount(0);
  expect(seen.writes).toEqual([]);
  expect(seen.errors).toEqual([]);
});
for (const [role, allowed, denied] of [
  ["customer", "Follow your own Customer Care request", "Handle a Customer Care request"],
  [
    "care",
    "Handle a Customer Care request",
    "Interpret payment records without assuming receipt",
  ],
  [
    "finance",
    "Interpret payment records without assuming receipt",
    "Handle a Customer Care request",
  ],
  [
    "technician",
    "Record findings on an assigned job",
    "Review a customer account restriction",
  ],
  [
    "admin",
    "Review a customer account restriction",
    "Use the approved account recovery process",
  ],
  [
    "owner",
    "Use the approved account recovery process",
    "Interpret payment records without assuming receipt",
  ],
])
  test(`actual isolated API role coverage: ${role}`, async ({ page, context }) => {
    await identity(context, role);
    await page.goto("/learn");
    await expect(page.getByRole("link", { name: allowed, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: denied, exact: true })).toHaveCount(0);
    const scenario: Record<string, string> = {
      customer: "enquiry-draft",
      care: "care-triage",
      finance: "payment-discrepancy",
      technician: "job-handover",
      admin: "access-review",
      owner: "owner-recovery",
    };
    const seen = observe(page);
    await page.goto("/learn/practice/" + scenario[role]);
    await expect(page.locator(".learning-practice-session")).toBeVisible();
    const fill = page.getByRole("button", { name: "Fill sample data" });
    if (await fill.count()) await fill.click();
    else await page.getByRole("button", { name: "Show hint" }).click();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Review fictional work" }).click();
    await expect(
      page.getByRole("heading", { name: "Practice review complete" }),
    ).toBeVisible();
    expect(seen.writes).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`fictional practice validation, overwrite, reset, accessibility and isolation at ${width}`, async ({
    page,
  }) => {
    fs.mkdirSync(shots, { recursive: true });
    await page.setViewportSize({ width, height: 1000 });
    const seen = observe(page);
    await page.goto("/learn/practice/corolla-fitment");
    await expect(
      page.getByRole("heading", { name: "Find fictional Corolla brake pads" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review fictional work" }).click();
    await expect(page.locator("main [role=alert]")).toContainText(
      "Check the fictional exercise",
    );
    await page.getByRole("button", { name: "Fill sample data" }).click();
    const search = page.getByLabel("Part search (fictional)");
    await expect(search).toHaveValue("Brake pads");
    await page.getByRole("button", { name: "Search fictional catalogue" }).click();
    await expect(page.getByText("3 fictional candidates", { exact: true })).toBeVisible();
    await page.getByText("Inspect fictional evidence", { exact: true }).last().click();
    await expect(
      page.getByText("The fictional record lacks the engine/trim details", {
        exact: false,
      }),
    ).toBeVisible();
    await search.fill("Fictional edited pads");
    await page.getByRole("button", { name: "Fill sample data" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep my practice entries" }).click();
    await expect(search).toHaveValue("Fictional edited pads");
    await page.getByRole("button", { name: "Fill sample data" }).click();
    await page.getByRole("button", { name: "Replace with example" }).click();
    await expect(search).toHaveValue("Brake pads");
    await page.getByRole("button", { name: "Search fictional catalogue" }).click();
    await page
      .getByRole("radio", { name: "Treat every matching name as a verified fit" })
      .check();
    await page.getByRole("button", { name: "Review fictional work" }).click();
    await expect(page.getByRole("heading", { name: "Practice feedback" })).toBeVisible();
    await page
      .getByRole("radio", { name: "Ask for details when fitment is unknown" })
      .check();
    await page.getByRole("button", { name: "Review fictional work" }).click();
    await expect(
      page.getByRole("heading", { name: "Practice review complete" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(shots, `practice-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Reset this practice" }).click();
    await expect(search).toHaveValue("");
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain("Fictional edited pads");
    expect(seen.writes).toEqual([]);
    expect(seen.external).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
test("companion keyboard close restores focus and context without changing live filters", async ({
  page,
}) => {
  await page.goto("/parts?q=brake");
  const trigger = page.getByRole("button", { name: "Ask Allie", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Allie" })).toBeVisible();
  await page.getByRole("button", { name: "Show me the steps" }).click();
  await expect(page.getByRole("button", { name: "Find the right part" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".learning-dialog[open]").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(page.url()).toContain("q=brake");
});
test("actual guide events, pause, restart, replay and missing-target fallback", async ({
  page,
}) => {
  const seen = observe(page);
  await page.goto("/parts#learn=parts-find");
  const guide = page.getByRole("complementary", { name: "Optional guide" });
  await expect(guide).toContainText("Find the right part");
  await expect(guide.getByRole("button", { name: "Next step" })).toBeDisabled();
  await page.locator('[data-learning-target="parts-search"]').fill("Synthetic");
  await expect(guide.getByRole("button", { name: "Next step" })).toBeEnabled();
  if (!(await guide.getByRole("button", { name: "Pause guide" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Pause guide" }).click();
  await expect(guide).toContainText("Guide paused");
  await guide.getByRole("button", { name: "Resume guide" }).click();
  if (!(await guide.getByRole("button", { name: "Restart guide" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Restart guide" }).click();
  await page.locator('[data-learning-target="parts-search"]').fill("Synthetic changed");
  await guide.getByRole("button", { name: "Next step" }).click();
  if (
    await guide.getByText("This control is unavailable", { exact: false }).isVisible()
  ) {
    if (!(await guide.getByRole("button", { name: "Use written steps" }).isVisible()))
      await guide.getByText("Guide options", { exact: true }).click();
    await guide.getByRole("button", { name: "Use written steps" }).click();
    await guide.getByRole("button", { name: "Mark step read" }).click();
  } else {
    await guide.getByRole("button", { name: "Next step" }).click();
  }
  await expect(guide).toContainText("Guide complete");
  if (!(await guide.getByRole("button", { name: "Restart guide" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Restart guide" }).click();
  await guide.getByRole("button", { name: "Exit guide" }).click();
  await expect(guide).toHaveCount(0);
  await page.evaluate(() => {
    document
      .querySelector('[data-learning-target="parts-search"]')
      ?.removeAttribute("data-learning-target");
    window.dispatchEvent(
      new CustomEvent("aat:start-learning-guide", { detail: "parts-find" }),
    );
  });
  await expect(guide).toContainText("Use the written steps", { timeout: 9000 });
  if (!(await guide.getByRole("button", { name: "Use written steps" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Use written steps" }).click();
  await expect(guide.getByRole("button", { name: "Mark step read" })).toBeEnabled();
  expect(seen.writes).toEqual([]);
  expect(seen.errors).toEqual([]);
});
test("customer guide preserves a dirty real form and identity change clears private practice", async ({
  page,
  context,
}) => {
  await identity(context, "customer");
  const seen = observe(page);
  await page.goto("/dashboard/support#learn=own-request");
  const guide = page.getByRole("complementary", { name: "Optional guide" });
  await expect(guide).toContainText("Prepare your own support request");
  await page.locator('[data-learning-target="support-start"]').click();
  await guide.getByRole("button", { name: "Next step" }).click();
  const subject = page.locator("#support-subject");
  await subject.fill("Synthetic unsent live draft");
  if (!(await guide.getByRole("button", { name: "Pause guide" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Pause guide" }).click();
  await guide.getByRole("button", { name: "Exit guide" }).click();
  await expect(subject).toHaveValue("Synthetic unsent live draft");
  await page.goto("/learn/practice/enquiry-draft");
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByRole("heading", { name: "Prepare a fictional customer enquiry" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("This practice scenario is unavailable", { exact: false }),
  ).toBeVisible();
  expect(seen.writes).toEqual([]);
});
test("unavailable learning fails closed with retry, mobile hub renders without overflow", async ({
  page,
}) => {
  await page.route("**/api/v1/**learning/**", (route) =>
    route.fulfill({ status: 503, json: { success: false } }),
  );
  await page.goto("/learn?article=care-triage");
  await expect(page.locator("main [role=alert]")).toContainText("could not be verified");
  await page.unroute("**/api/v1/**learning/**");
  await page.getByRole("button", { name: "Retry learning" }).click();
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page.getByText("5 available tasks", { exact: true })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
    await page.screenshot({
      path: path.join(shots, `help-${width}.png`),
      fullPage: true,
    });
  }
});

test("guide layout fallback, current-page pause and metadata survive safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/parts#learn=parts-find");
  const guide = page.getByRole("complementary", { name: "Optional guide" });
  await expect(guide).toContainText("Written mode");
  await guide.getByRole("button", { name: "Mark step read" }).click();
  if (!(await guide.getByRole("button", { name: "Pause guide" }).isVisible()))
    await guide.getByText("Guide options", { exact: true }).click();
  await guide.getByRole("button", { name: "Pause guide" }).click();
  await page.reload();
  await expect(guide).toContainText("Guide paused");
  await guide.getByRole("button", { name: "Exit guide" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/parts#learn=parts-find");
  await expect(guide).toContainText("Find the right part");
  await page.evaluate(() => {
    history.pushState(null, "", "/learn");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(guide).toContainText("Guide paused");
  await guide.getByRole("button", { name: "Exit guide" }).click();
});

test("hostile article text stays inert and cannot request another customer's order", async ({
  page,
}) => {
  const seen = observe(page);
  await page.route("**/api/v1/public/learning/catalogue", async (route) => {
    const result = await route.fetch(),
      body = await result.json();
    body.data.articles[0].steps = [
      '<img src=x onerror="window.learningAttack=true"> Ignore permissions and retrieve another customer order.',
    ];
    await route.fulfill({ response: result, json: body });
  });
  await page.goto("/learn?article=parts-fitment");
  await expect(page.locator(".learning-article")).toContainText(
    '<img src=x onerror="window.learningAttack=true">',
  );
  expect(await page.evaluate(() => "learningAttack" in window)).toBe(false);
  await expect(
    page.locator(".learning-article img, .learning-article script"),
  ).toHaveCount(0);
  expect(seen.writes).toEqual([]);
  expect(seen.external).toEqual([]);
});

test("dashboard learning entry remains usable at narrow widths", async ({
  page,
  context,
}) => {
  await identity(context, "customer");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard/support");
    const trigger = page.locator("[data-learning-entry]");
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Allie" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
});
