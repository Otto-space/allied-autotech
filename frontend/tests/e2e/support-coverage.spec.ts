import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { coverageFixture } from "../fixtures/support-coverage";
type Fixture = Awaited<ReturnType<typeof coverageFixture>>;
test.setTimeout(180_000);
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("coveragePageErrors", () => errors);
});
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { coveragePageErrors: () => Promise<string[]> }
        ).coveragePageErrors(),
      ),
    ).toEqual([]);
    await expect(page.locator("nextjs-portal nextjs-dialog")).toHaveCount(0);
  }
});
async function open(page: Page, state: Fixture, branch = state.first) {
  await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
  await page
    .getByText("Conversation queue and your availability", { exact: true })
    .click();
  await page.getByText("Branch support coverage (owner)", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(branch);
  await expect(
    page.getByRole("button", { name: "Review support coverage", exact: true }),
  ).toBeEnabled();
}
async function fill(page: Page) {
  await page.getByRole("button", { name: "Add support window", exact: true }).click();
  const group = page.getByRole("group", { name: "Support window 1", exact: true });
  await group.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
  await group.getByLabel("Start time", { exact: true }).fill("09:17");
  await group.getByLabel("End time", { exact: true }).fill("17:41");
  await page.getByLabel(/Allow joins during these hours/).check();
  await page
    .getByLabel(/Maximum concurrent conversations per representative/)
    .selectOption("2");
  await page.getByLabel(/Private audit reason/).fill("Synthetic approved staffing plan");
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Review support coverage", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Africa/Lagos");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
}
test("owner reviews empty coverage without invented hours at 390px", async ({ page }) => {
  const state = await coverageFixture(page);
  await page.setViewportSize({ width: 390, height: 950 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, state);
  await expect(
    page.getByRole("group", { name: "Support window 1", exact: true }),
  ).toHaveCount(0);
  await fill(page);
  await page
    .getByRole("button", { name: "Review support coverage", exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toContainText("Monday 09:17–17:41");
  await expect(page.getByRole("dialog")).toContainText(
    "Synthetic approved staffing plan",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText(/Support coverage saved\. This did not release/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].csrf).toBeTruthy();
  expect(state.writes[0].key).toMatch(/^support-reply-v1\./);
  expect(state.writes[0].body).toMatchObject({
    expectedVersion: 0,
    enabled: true,
    maxConcurrentPerAgent: 2,
    schedule: {
      timezone: "Africa/Lagos",
      windows: [{ day: 1, startMinute: 557, endMinute: 1061 }],
    },
  });
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("aat:care-coverage:v1:"),
      ),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-w16e-coverage-390.png"),
    fullPage: true,
  });
});
test("lost saved coverage survives reload with a reference-only reminder", async ({
  page,
}) => {
  const state = await coverageFixture(page);
  state.mode = "lost";
  await open(page, state);
  await fill(page);
  await save(page);
  await expect(
    page.getByRole("button", { name: "Check saved coverage action", exact: true }),
  ).toBeVisible();
  const reminders = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(([name]) =>
      name.startsWith("aat:care-coverage:v1:"),
    ),
  );
  expect(reminders).toHaveLength(1);
  expect(Object.keys(JSON.parse(reminders[0][1]))).toEqual(["operationKey"]);
  expect(JSON.stringify(reminders)).not.toContain("Synthetic approved staffing plan");
  expect(JSON.stringify(reminders)).not.toContain(state.first);
  await page.reload();
  await page
    .getByText("Conversation queue and your availability", { exact: true })
    .click();
  await page.getByText("Branch support coverage (owner)", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(state.first);
  await expect(
    page.getByRole("button", { name: "Review support coverage", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check saved coverage action", exact: true })
    .click();
  await expect(
    page.getByText("The earlier coverage change was saved. No change was resent.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("unsaved coverage requires reviewed durable cancellation before another save", async ({
  page,
}) => {
  const state = await coverageFixture(page);
  state.mode = "unsaved";
  await open(page, state);
  await fill(page);
  await save(page);
  await page
    .getByRole("button", { name: "Check saved coverage action", exact: true })
    .click();
  await expect(page.getByText(/No saved outcome is confirmed yet/)).toBeVisible();
  await page
    .getByRole("button", { name: "Review pending cancellation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not disable or undo existing coverage",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByText(/The unsaved coverage change is cancelled/)).toBeVisible();
  expect(state.receipts.get(state.writes[0].key)?.state).toBe("CANCELLED");
  state.mode = "normal";
  await save(page);
  await expect(
    page.getByText(/Support coverage saved\. This did not release/),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.method === "PUT")).toHaveLength(2);
  expect(state.writes[0].key).not.toBe(state.writes.at(-1)?.key);
});
test("populated midnight coverage retains both branch drafts and requires a fresh revision at 1440px", async ({
  page,
}) => {
  const state = await coverageFixture(page);
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page, state, state.second);
  const group = page.getByRole("group", { name: "Support window 1", exact: true });
  await expect(group.getByLabel("End time", { exact: true })).toHaveValue("24:00");
  await page.getByLabel(/Private audit reason/).fill("Retain this second branch reason");
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(state.first);
  await page.getByLabel(/Private audit reason/).fill("Retain this first branch reason");
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(state.second);
  await expect(page.getByLabel(/Private audit reason/)).toHaveValue(
    "Retain this second branch reason",
  );
  state.records.set(state.second, {
    ...state.records.get(state.second)!,
    version: 4,
    enabled: false,
  });
  await page
    .getByRole("button", { name: "Refresh current coverage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Coverage changed while you were editing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review support coverage", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Use retained settings with current revision",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Review support coverage", exact: true }),
  ).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-w16e-coverage-1440.png"),
    fullPage: true,
  });
});
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot open owner coverage or read its API`, async ({ page }) => {
    const state = await coverageFixture(page, role);
    await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
    await page
      .getByText("Conversation queue and your availability", { exact: true })
      .click();
    await expect(
      page.getByText("Branch support coverage (owner)", { exact: true }),
    ).toHaveCount(0);
    expect(state.reads).toEqual([]);
    expect(state.writes).toEqual([]);
  });
test("keyboard addition and removal keep visible focus", async ({ page }) => {
  const state = await coverageFixture(page);
  await open(page, state);
  const add = page.getByRole("button", { name: "Add support window", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  const window = page.getByRole("group", { name: "Support window 1", exact: true });
  await expect(window.getByRole("combobox", { name: "Day", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(window.getByLabel("Start time", { exact: true })).toBeFocused();
  await page.keyboard.type("09:17");
  await page.keyboard.press("Tab");
  await expect(window.getByLabel("End time", { exact: true })).toBeFocused();
  await page.keyboard.type("17:41");
  await page.keyboard.press("Tab");
  await expect(
    window.getByRole("button", { name: "Remove support window 1", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(window).toHaveCount(0);
  await expect(add).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("denied current coverage clears the private editor and retained drafts", async ({
  page,
}) => {
  const state = await coverageFixture(page);
  await open(page, state);
  await page.getByLabel(/Private audit reason/).fill("Unsent private coverage reason");
  state.denied = true;
  await page
    .getByRole("button", { name: "Refresh current coverage", exact: true })
    .click();
  await expect(
    page.getByText(
      /Current owner access to that branch's coverage could not be verified/,
    ),
  ).toBeVisible();
  await expect(page.getByLabel(/Private audit reason/)).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
