/** Explicit paid, isolated acceptance only. Ordinary suites SKIP these cases.
 * Requires the bounded loopback harness; no API response is mocked/intercepted.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test.describe.configure({ mode: "serial" });
test.skip(
  process.env.RUN_ALLIE_REAL_PROVIDER_BROWSER !== "approved-isolated",
  "Requires explicit bounded isolated provider harness",
);
test.setTimeout(180000);
async function begin(page: Page) {
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Start help conversation" }).click();
  await expect(panel.getByRole("textbox", { name: "Your help question" })).toBeVisible();
  return panel;
}
async function send(page: Page, question: string) {
  const panel = page.getByRole("dialog");
  await panel.getByRole("textbox", { name: "Your help question" }).fill(question);
  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      /\/learning\/assistant\/conversations\/[^/]+\/turns$/.test(
        new URL(r.url()).pathname,
      ),
    { timeout: 35000 },
  );
  await panel.getByRole("button", { name: "Send question" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const packet = await response.json();
  const latest = packet.data.conversation.messages.at(-1);
  expect(latest.answer.sources.length).toBeGreaterThan(0);
  await expect(panel.getByRole("textbox", { name: "Your help question" })).toHaveValue(
    "",
  );
  return latest.answer;
}
function observe(page: Page) {
  const mutations: string[] = [],
    errors: string[] = [],
    external: string[] = [];
  page.on("request", (r) => {
    if (!/^(GET|HEAD|OPTIONS)$/.test(r.method()))
      mutations.push(new URL(r.url()).pathname);
    if (
      /^https?:/.test(r.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
    )
      external.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return { mutations, errors, external };
}
async function audit(page: Page, screenshot: string) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".learning-dialog[open]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: path.join(os.tmpdir(), screenshot) });
}
test("actual mobile guest conversation and follow-up cross browser, API, database and provider", async ({
  page,
}) => {
  const seen = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  const panel = await begin(page);
  const first = await send(page, "How do I find a compatible brake part?");
  expect(first.sourceIds).toContain("parts-fitment@v2");
  // Project-level pacing, not an arbitrary UI synchronization delay.
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const followUp = await send(page, "What if that compatibility evidence is missing?");
  expect(followUp.sourceIds).toContain("parts-fitment@v2");
  expect([followUp.answer, ...followUp.steps, followUp.caveat ?? ""].join(" ")).toMatch(
    /not confirmed|unknown|enquir|cannot confirm|can't confirm/i,
  );
  await expect(panel.locator(".allie-transcript > li")).toHaveCount(2);
  await audit(page, "allied-allie-real-390.png");
  expect(
    seen.mutations.every((p) => /^\/api\/v1\/public\/learning\/assistant\//.test(p)),
  ).toBe(true);
  expect(seen.errors).toEqual([]);
  expect(seen.external).toEqual([]);
});
test("owned persisted real-provider answer survives readback and native-dialog accessibility at mobile and desktop", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.RUN_ALLIE_REAL_PROVIDER_READBACK !== "true",
    "Requires an existing successful isolated customer turn; makes no provider call",
  );
  const seen = observe(page);
  const identities = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.LOCALAPPDATA!,
        "AlliedAutoTech/allie-evaluation/browser-sessions.local.json",
      ),
      "utf8",
    ),
  );
  const [name, value] = identities.customer.split("=");
  await context.addCookies([
    { name, value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3167" },
  ]);
  await page.goto("/dashboard/support");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  const responsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      /\/learning\/assistant\/conversations\/[^/]+$/.test(new URL(r.url()).pathname),
  );
  await panel.getByRole("button", { name: /Resume conversation 1/ }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const packet = await response.json();
  const latest = packet.data.messages.at(-1);
  expect(latest.question).toBe(
    "How do I follow my own Customer Care enquiry and review a reply?",
  );
  expect(latest.answer.sourceIds).toContain("own-conversation@v4");
  await expect(panel.locator(".allie-transcript > li")).toHaveCount(1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await expect(
      panel.getByRole("textbox", { name: "Your help question" }),
    ).toBeVisible();
    await audit(page, `allied-allie-real-customer-${width}.png`);
  }
  expect(seen.mutations).toEqual([]);
  expect(seen.errors).toEqual([]);
  expect(seen.external).toEqual([]);
});
test("actual verified customer help uses account CSRF and owned context at desktop width", async ({
  page,
  context,
}) => {
  const seen = observe(page);
  const identities = JSON.parse(
    fs.readFileSync(
      path.join(
        process.env.LOCALAPPDATA!,
        "AlliedAutoTech/allie-evaluation/browser-sessions.local.json",
      ),
      "utf8",
    ),
  );
  const [name, value] = identities.customer.split("=");
  await context.addCookies([
    { name, value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3167" },
  ]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard/support");
  await begin(page);
  await new Promise((resolve) => setTimeout(resolve, 7000));
  const answer = await send(
    page,
    "How do I follow my own Customer Care enquiry and review a reply?",
  );
  expect(answer.sourceIds.some((id: string) => id.startsWith("own-conversation@v"))).toBe(
    true,
  );
  expect(
    answer.sourceIds.some((id: string) =>
      /care-triage|finance-meaning|privileged-recovery/.test(id),
    ),
  ).toBe(false);
  await audit(page, "allied-allie-real-1440.png");
  expect(seen.mutations.some((p) => p.includes("/public/learning/assistant/"))).toBe(
    false,
  );
  expect(
    seen.mutations.every(
      (p) => p === "/api/v1/auth/csrf" || /^\/api\/v1\/learning\/assistant\//.test(p),
    ),
  ).toBe(true);
  expect(seen.errors).toEqual([]);
  expect(seen.external).toEqual([]);
});
