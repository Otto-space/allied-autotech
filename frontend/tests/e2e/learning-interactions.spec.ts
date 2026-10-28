import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const article = {
  id: "parts-fitment",
  page: "parts",
  title: "Find a part and understand compatibility",
  summary: "A name match does not establish compatibility.",
  steps: ["Search for a part.", "Review the compatibility evidence before enquiring."],
  href: "/parts",
  source: "Synthetic browser fixture",
  keywords: "shop fitment",
  prerequisites: "Use the available controls.",
  outcome: "You know the next step.",
  recovery: "Contact the team.",
  version: 2,
  status: "published",
  reviewedAt: "2026-10-28",
};
const catalogue = {
  accessKey: "a".repeat(64),
  audience: "public",
  contentVersion: 1,
  mode: "browse_enquiries",
  flags: { guides: true, practice: true, ai: false },
  articles: [
    {
      ...article,
      id: "home-next-step",
      page: "home",
      title: "Choose your next step",
      summary: "Choose Shop to find parts or Services for care.",
      keywords: "home products",
      href: "/services",
    },
    article,
  ],
  guides: [
    {
      id: "parts-find",
      version: 2,
      title: "Find the right part",
      articleId: article.id,
      page: "parts",
      href: "/parts",
      steps: [
        {
          id: "search",
          target: "parts-search",
          text: "Enter a part name, then use Search.",
          event: "input",
        },
        {
          id: "read",
          target: "parts-results",
          text: "Review the results without assuming compatibility.",
          event: "read",
        },
      ],
    },
  ],
  scenarios: [
    {
      id: "sample",
      title: "Sample task",
      objective: "Choose an evidence-based next step.",
      version: 1,
      articleId: article.id,
    },
  ],
};
const scenario = {
  ...catalogue.scenarios[0],
  kind: "draft",
  fields: [
    {
      id: "subject",
      label: "Subject",
      min: 2,
      max: 80,
      example: "Fictional part enquiry",
    },
  ],
  choices: [
    {
      id: "ask",
      label: "Ask for missing evidence",
      feedback: "Check unknown facts first.",
    },
    {
      id: "assume",
      label: "Assume compatibility",
      feedback: "A name match is not enough.",
    },
  ],
  expected: "ask",
  outcome: "You checked the evidence.",
  liveHref: "/parts",
};
async function fixture(page: Page) {
  const control = {
    delay: 0,
    fail: false,
    key: catalogue.accessKey,
    calls: 0,
    errors: [] as string[],
  };
  page.on("pageerror", (error) => control.errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") throw new Error("Unexpected API write");
    if (endpoint.endsWith("/auth/session"))
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "UNAUTHORIZED" } },
      });
    if (endpoint.endsWith("/learning/catalogue")) {
      control.calls++;
      if (control.delay)
        await new Promise((resolve) => setTimeout(resolve, control.delay));
      if (control.fail) return route.fulfill({ status: 503, json: { success: false } });
      return route.fulfill({
        json: {
          success: true,
          data: { ...catalogue, accessKey: control.key },
          message: "Fixture",
          meta: { requestId: "learning-test" },
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        data: endpoint.endsWith("/scenarios/sample") ? scenario : { items: [] },
        message: "Fixture",
        meta: { requestId: "learning-test" },
      },
    });
  });
  return control;
}
for (const width of [320, 390, 768, 1440]) {
  test(`Learn search, modes, clear, article disclosures and return at ${width}`, async ({
    page,
  }) => {
    const c = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/learn");
    const input = page.getByRole("searchbox", { name: "What would you like to do?" });
    await input.fill("parts");
    await expect(page.getByRole("tab", { name: /All help/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(".learning-topics li")).toHaveCount(4);
    await input.press("Enter");
    await expect(page.getByRole("tabpanel")).toBeFocused();
    expect(
      await page.getByRole("tabpanel").evaluate((el) => el.getBoundingClientRect().top),
    ).toBeGreaterThanOrEqual(68);
    await page.getByRole("tab", { name: /Guide me/ }).click();
    await expect(page.locator(".learning-topics li")).toHaveCount(1);
    await page.getByRole("button", { name: "Search all modes" }).click();
    await expect(page.getByRole("tab", { name: /All help/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(input).toBeFocused();
    await input.fill("zzzzqqq");
    await input.press("Enter");
    await expect(page.getByText("No matching topics.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Browse written answers" }).click();
    await page
      .getByRole("link", { name: "Read answer: " + article.title, exact: true })
      .click();
    await expect(page.locator(".learning-detail")).toBeFocused();
    for (const summary of ["Something not working?", "Reviewed source · version 2"]) {
      await page.getByText(summary, { exact: true }).click();
    }
    await page.getByRole("link", { name: "Back to results" }).click();
    await page.getByRole("tab", { name: /Find an answer/ }).focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: /Practise/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: /All help/ })).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
    expect(c.errors).toEqual([]);
  });
}
for (const width of [390, 1440]) {
  test(`Allie repeated questions, recovery, context, intents and navigation at ${width}`, async ({
    page,
  }) => {
    const c = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/learn");
    await page.locator(".learning-card-action").first().waitFor();
    const launcher = page.getByRole("button", { name: "Ask Allie", exact: true });
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    const input = dialog.getByLabel("What do you need help with?");
    await input.waitFor();
    await input.fill("   ");
    await dialog.getByRole("button", { name: "Find reviewed help" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Enter a question");
    for (let repeat = 0; repeat < 2; repeat++) {
      await input.fill("parts");
      await input.press("Enter");
      await expect(dialog.locator(".allie-response")).toBeFocused();
      await expect(dialog.getByRole("heading", { name: article.title })).toBeVisible();
    }
    await dialog.getByText("Did you mean another task?", { exact: true }).click();
    await dialog
      .getByRole("button", { name: "Choose your next step", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Choose your next step" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Ask another question" }).click();
    await expect(input).toBeFocused();
    await input.fill("zzzzqqq");
    await input.press("Enter");
    await expect(
      dialog.getByRole("heading", { name: "Try a related help topic" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Explain this page" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Three ways to learn" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Show me the steps" }).click();
    await expect(
      dialog.getByRole("link", { name: "Find the right part" }),
    ).toHaveAttribute("href", "/parts#learn=parts-find");
    await dialog.getByRole("button", { name: "Let me practise" }).click();
    await expect(dialog.getByRole("link", { name: "Sample task" })).toHaveAttribute(
      "href",
      "/learn/practice/sample",
    );
    expect(
      (await new AxeBuilder({ page }).include(".allie-dialog[open]").analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(launcher).toBeFocused();
    await launcher.click();
    await dialog.getByRole("link", { name: "Open full Help & Learn" }).click();
    await expect(dialog).not.toBeVisible();
    expect(c.errors).toEqual([]);
  });
  test(`Allie revalidation keeps geometry and focus, fails closed and retries at ${width}`, async ({
    page,
  }) => {
    const c = await fixture(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/learn");
    await page.locator(".learning-card-action").first().waitFor();
    await page.locator(".allie-trigger").click();
    const input = page.getByLabel("What do you need help with?");
    await input.fill("unfinished question");
    const height = await page
      .locator(".allie-dialog")
      .evaluate((el) => el.getBoundingClientRect().height);
    c.delay = 500;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator(".allie-content .learning-access-content")).toHaveAttribute(
      "inert",
      "",
    );
    expect(
      Math.abs(
        (await page
          .locator(".allie-dialog")
          .evaluate((el) => el.getBoundingClientRect().height)) - height,
      ),
    ).toBeLessThan(2);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("unfinished question");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("button", { name: "Close help", exact: true }).focus();
    await page.waitForTimeout(650);
    await expect(
      page.getByRole("button", { name: "Close help", exact: true }),
    ).toBeFocused();
    c.fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator(".allie-content [role=alert]")).toContainText(
      "could not be verified",
    );
    await expect(input).toHaveCount(0);
    c.fail = false;
    c.delay = 0;
    await page.getByRole("button", { name: "Retry help" }).click();
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
    await input.fill("old identity question");
    c.key = "b".repeat(64);
    await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
    await expect(page.locator(".allie-dialog")).not.toBeVisible();
    await page.locator(".allie-trigger").click();
    await expect(input).toHaveValue("");
    expect(c.errors).toEqual([]);
  });
}
test("Guide mobile controls, responsive transition, pause/resume, completion, hash and error recovery", async ({
  page,
}) => {
  const c = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/parts#learn=parts-find");
  const g = page.getByRole("complementary", { name: "Optional guide" });
  await expect(g).toContainText("Written mode");
  await g.getByText("Guide options", { exact: true }).click();
  await expect(g.getByRole("button", { name: "Try page controls" })).toHaveCount(0);
  await g.getByRole("button", { name: "Mark step read" }).click();
  await expect(g).toContainText("2 of 2");
  await g.getByRole("button", { name: "Back", exact: true }).click();
  await expect(g).toContainText("1 of 2");
  await g.getByRole("button", { name: "Pause guide" }).click();
  await page.reload();
  await expect(g).toContainText("Guide paused");
  await g.getByText("Guide options", { exact: true }).click();
  await g.getByRole("button", { name: "Resume guide" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(g.getByText(/Written mode/)).toHaveCount(0);
  await expect(page.locator(".learning-highlight")).toHaveCount(1);
  await page.locator('[data-learning-target="parts-search"]').fill("oil");
  await expect(g.getByRole("button", { name: "Next step" })).toBeEnabled();
  await g.getByRole("button", { name: "Use written steps" }).click();
  await g.getByRole("button", { name: "Mark step read" }).click();
  await g.getByRole("button", { name: "Mark step read" }).click();
  await expect(g).toContainText("Guide complete");
  await expect(g.getByRole("progressbar")).toHaveAttribute("value", "2");
  await g.getByRole("button", { name: "Restart guide" }).click();
  await expect(g).toContainText("1 of 2");
  await page.evaluate(() => {
    location.hash = "other";
  });
  await expect(g).toHaveCount(0);
  await page.goto("/parts#learn=parts-find");
  await expect(g).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(g).toHaveCount(0);
  await expect(page).not.toHaveURL(/#learn=/);
  c.fail = true;
  await page.goto("/parts#learn=parts-find");
  await expect(page.getByRole("button", { name: "Retry guide" })).toBeVisible();
  c.fail = false;
  await page.getByRole("button", { name: "Retry guide" }).click();
  await expect(g).toContainText("Find the right part");
  await g.getByRole("button", { name: "Exit guide" }).click();
  await page.goto("/parts#learn=missing-guide");
  await page.getByRole("link", { name: "Available learning", exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(g).toHaveCount(0);
  expect(c.errors).toEqual([]);
});
test("Practice feedback, deliberate replacement, reset, errors and return", async ({
  page,
}) => {
  const c = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn/practice/sample?mode=all&q=part");
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(page.locator(".learning-errors")).toBeFocused();
  await page.getByRole("link", { name: /Enter subject/ }).click();
  await expect(page.getByLabel("Subject (fictional)")).toBeFocused();
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await expect(page.getByLabel("Subject (fictional)")).toHaveValue(
    "Fictional part enquiry",
  );
  await page.getByLabel("Subject (fictional)").fill("My fictional edit");
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await page.getByRole("button", { name: "Keep my practice entries" }).click();
  await expect(page.getByLabel("Subject (fictional)")).toHaveValue("My fictional edit");
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await page.getByRole("button", { name: "Replace with example" }).click();
  await page.getByRole("radio", { name: "Assume compatibility" }).check();
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(page.locator('.learning-feedback[role="status"]')).toBeFocused();
  await expect(page.getByRole("heading", { name: "Practice feedback" })).toBeVisible();
  await page.getByRole("radio", { name: "Ask for missing evidence" }).check();
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(
    page.getByRole("heading", { name: "Practice review complete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset this practice" }).click();
  await expect(page.getByLabel("Subject (fictional)")).toHaveValue("");
  await page.getByRole("link", { name: "Exit practice" }).click();
  await expect(page).toHaveURL(/\/learn\?q=part&mode=all$/);
  expect(c.errors).toEqual([]);
});
