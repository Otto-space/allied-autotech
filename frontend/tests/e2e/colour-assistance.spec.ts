import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// A single reviewed PUBLIC article, mirrored for browser isolation. The private
// backend corpus is deliberately not imported into the frontend or this bundle.
const article = {
  id: "vehicle-enquiry",
  title: "Enquire about a vehicle or inspection",
  summary:
    "An enquiry or preferred inspection time is not a reservation or confirmed appointment.",
  prerequisites: "Use only the actions available to your current account.",
  steps: [
    "Open Vehicles and use the available filters.",
    "Open a listing to review its actual condition and details, or use the supported requirements enquiry if no listing suits you.",
    "Review the enquiry before sending. The team confirms any inspection separately.",
  ],
  outcome:
    "You understand the next permitted step. Reading help does not change a live record.",
  recovery:
    "If the required control is unavailable, refresh your access or use Contact support. Do not bypass a restriction or repeat an uncertain submission.",
  keywords: "car sale inspection reservation",
  page: "vehicles",
  href: "/vehicles",
  source: "Vehicle discovery and listing-less enquiry contracts",
  version: 2,
  status: "published",
  reviewedAt: "2026-10-26",
};

test("practice keeps checked, error and feedback states isolated from live work", async ({
  page,
}) => {
  const scenario = {
    id: "corolla-fitment",
    version: 1,
    title: "Find fictional Corolla brake pads",
    articleId: "parts-fitment",
    kind: "fitment",
    objective:
      "Compare compatible, incompatible and unknown sample evidence for a fictional Toyota Corolla 2018. These results do not certify a real part.",
    fields: [
      {
        id: "make",
        label: "Vehicle make",
        example: "Toyota",
        min: 1,
        max: 30,
        options: ["Toyota"],
      },
      {
        id: "model",
        label: "Vehicle model",
        example: "Corolla",
        min: 1,
        max: 30,
        options: ["Corolla"],
        dependsOn: "make",
      },
      {
        id: "year",
        label: "Vehicle year",
        example: "2018",
        min: 4,
        max: 4,
        options: ["2018"],
        dependsOn: "model",
      },
      { id: "query", label: "Part search", example: "Brake pads", min: 2, max: 100 },
    ],
    choices: [
      {
        id: "ask",
        label: "Ask for details when fitment is unknown",
        feedback:
          "Correct: unknown is not compatible. Check the missing technical evidence before a real purchase.",
      },
      {
        id: "buy",
        label: "Treat every matching name as a verified fit",
        feedback:
          "A matching name is not evidence of compatibility. Compare the three fictional outcomes.",
      },
    ],
    expected: "ask",
    outcome:
      "Fictional search and evidence review complete. No stock, cart, order or payment changed.",
    liveHref: "/parts",
  };
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!/^(GET|HEAD|OPTIONS)$/.test(r.method())) writes.push(r.url());
  });
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 401, json: { success: false } }),
  );
  await page.route("**/api/v1/public/learning/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: route.request().url().endsWith("catalogue")
          ? {
              accessKey: "a".repeat(64),
              audience: "public",
              contentVersion: 1,
              mode: "browse_enquiries",
              flags: { guides: true, practice: true, ai: false },
              articles: [],
              guides: [],
              scenarios: [scenario],
            }
          : scenario,
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto("/learn/practice/corolla-fitment");
  await expect(page.getByRole("heading", { name: scenario.title })).toBeVisible();
  await expect(page.locator(".learning-mode-label")).toHaveCount(1);
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(page.locator(".learning-errors")).toBeFocused();
  await page.getByRole("button", { name: "Fill sample data" }).click();
  await expect(page.getByLabel("Vehicle make", { exact: false })).toHaveValue("Toyota");
  await page.getByRole("button", { name: "Search fictional catalogue" }).click();
  await page.getByRole("radio", { name: scenario.choices[0].label }).check();
  await page.getByRole("button", { name: "Review fictional work" }).click();
  await expect(page.getByRole("status")).toContainText("Practice review complete");
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-colour-20261026/practice-390.png"),
    fullPage: false,
  });
  expect(writes).toEqual([]);
});
for (const width of [390, 1440]) {
  test(`Allie branded portal, failure recovery, answer and keyboard close ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    let fail = true;
    const writes: string[] = [];
    page.on("request", (r) => {
      if (!/^(GET|HEAD|OPTIONS)$/.test(r.method())) writes.push(r.url());
    });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({ status: 401, json: { success: false } }),
    );
    await page.route("**/api/v1/public/learning/catalogue", (route) =>
      fail
        ? route.fulfill({ status: 503, json: { success: false } })
        : route.fulfill({
            json: {
              success: true,
              data: {
                accessKey: "a".repeat(64),
                audience: "public",
                contentVersion: 1,
                mode: "browse_enquiries",
                flags: { guides: true, practice: true, ai: false },
                articles: [article],
                guides: [],
                scenarios: [],
              },
            },
          }),
    );
    await page.goto("/about");
    const trigger = page.getByRole("button", { name: "Ask Allie", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Allie", exact: true });
    await expect(dialog.getByRole("button", { name: "Retry help" })).toBeVisible();
    fail = false;
    await dialog.getByRole("button", { name: "Retry help" }).click();
    const question = dialog.getByRole("textbox", { name: "What do you need help with?" });
    await question.fill("vehicle inspection");
    await question.press("Enter");
    await expect(dialog.getByText(article.summary, { exact: true })).toBeVisible();
    await expect(dialog.locator(".learning-dialog-head")).toHaveCSS(
      "color",
      "rgb(255, 255, 255)",
    );
    await question.click();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Find reviewed help" }),
    ).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Find reviewed help" })).toHaveCSS(
      "outline-width",
      "3px",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".allie-dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    const dir = path.join(os.tmpdir(), "allied-colour-20261026");
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `allie-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
}
