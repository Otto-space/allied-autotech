import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workAuditFixture, id } from "../fixtures/work-audit";
import { accessHistoryRows } from "../fixtures/access-history";

for (const [width, height] of [
  [320, 720],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1440, 900],
] as const)
  test(`recorded access history fits ${width}`, async ({ page }, info) => {
    const f = await workAuditFixture(page);
    f.rows = accessHistoryRows();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.goto("/admin/team/history");
    await expect(
      page.getByRole("heading", { name: "Access change history", exact: true }),
    ).toBeVisible();
    const first = page.locator(".wa-event").first();
    await expect(
      first.getByRole("heading", { name: "Temporary cover added", exact: true }),
    ).toBeVisible();
    await expect(first).toContainText("Current Person");
    await expect(first).toContainText("Current Operator");
    await first.getByRole("heading").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("history-overview.png") });
    await first.getByText("Event details", { exact: true }).click();
    const facts = first.getByRole("region", {
      name: "Recorded access change",
      exact: true,
    });
    await expect(facts).toContainText("Customer Service Officer");
    await expect(facts).toContainText("Current workshop name (current name)");
    await expect(facts).toContainText("Lagos time");
    await expect(facts).toContainText("Synthetic recorded cover reason");
    await expect(first.locator("pre")).toHaveCount(0);
    await facts.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("history-facts.png") });
    await first.getByText("Recorded values", { exact: true }).click();
    await expect(first.getByRole("region", { name: "After", exact: true })).toContainText(
      '"proof": false',
    );
    await expect(first.getByRole("region", { name: "After", exact: true })).toContainText(
      '"count": 0',
    );
    expect(
      await page.evaluate(() => [
        innerWidth,
        innerHeight,
        document.documentElement.scrollWidth <= innerWidth,
      ]),
    ).toEqual([width, height, true]);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("recorded-history.png") });
    expect(
      f.reads.every((url) => url.searchParams.get("view") === "ACCESS_CHANGES"),
    ).toBe(true);
    expect(f.writes).toEqual([]);
    expect(errors).toEqual([]);
  });

test("missing historical facts stay missing while current names remain explicitly current", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = accessHistoryRows();
  await page.goto("/admin/team/history");
  const removed = page
    .locator(".wa-event")
    .filter({ has: page.getByRole("heading", { name: "Duty removed", exact: true }) });
  await expect(removed).toContainText("Other duties or account-level access may remain");
  await removed.getByText("Event details", { exact: true }).click();
  await expect(
    removed.getByRole("region", { name: "Recorded access change", exact: true }),
  ).toContainText("Not recorded in this event");
  const position = page.locator(".wa-event").filter({
    has: page.getByRole("heading", { name: "Job position changed", exact: true }),
  });
  await position.getByText("Event details", { exact: true }).click();
  await expect(position).toContainText("SessionsNot recorded in this event");
  const role = page.locator(".wa-event").filter({
    has: page.getByRole("heading", { name: "Account level changed", exact: true }),
  });
  await role.getByText("Event details", { exact: true }).click();
  await expect(role).toContainText("BeforeStaff");
  await expect(role).toContainText("AfterAdministrator");
  await expect(
    page.getByText(/Names and branch names are current records/),
  ).toBeVisible();
  expect(f.writes).toEqual([]);
});

test("history filters retain the scoped view and full audit keeps the original response", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = accessHistoryRows();
  await page.goto("/admin/team/history");
  await page.getByLabel("Action", { exact: true }).selectOption("ROLE_CHANGE");
  await page.getByRole("button", { name: "Apply history filters", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(1);
  expect(f.reads.at(-1)!.searchParams.get("view")).toBe("ACCESS_CHANGES");
  expect(f.reads.at(-1)!.searchParams.get("action")).toBe("ROLE_CHANGE");
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Clear history filters", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(6);
  await page.getByRole("link", { name: "Open full audit log", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit log", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wa-event")).toHaveCount(6);
  expect(f.reads.at(-1)!.searchParams.has("view")).toBe(false);
});

test("an unrelated server event is rejected instead of being counted as an access change", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = accessHistoryRows();
  f.rows[0]!.action = "READ";
  await page.goto("/admin/team/history");
  await expect(
    page.getByText("We could not read this information. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".wa-event")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});

test("denial clears recorded identities and ordinary staff never fetches history", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = accessHistoryRows();
  await page.goto("/admin/team/history");
  await expect(page.locator(".wa-event")).toHaveCount(6);
  f.mode = "denied";
  await page.getByRole("button", { name: "Refresh history", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(0);
  await expect(page.getByText("Current Person", { exact: true })).toHaveCount(0);
});

test("ordinary staff cannot fetch the history view", async ({ page }) => {
  const f = await workAuditFixture(page, "STAFF");
  f.rows = accessHistoryRows();
  await page.goto("/admin/team/history");
  await expect(
    page.getByText("Administrator access is required to view these records.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.reads).toEqual([]);
  expect(f.writes).toEqual([]);
});

for (const width of [320, 1440])
  test(`long current names and enlarged history text preserve keyboard inspection at ${width}`, async ({
    page,
  }, info) => {
    const f = await workAuditFixture(page);
    f.rows = accessHistoryRows();
    f.rows[0]!.currentContext!.subject!.name = "Synthetic long current person name "
      .repeat(5)
      .trim();
    f.rows[0]!.currentContext!.actor!.name = "Synthetic long current operator name "
      .repeat(4)
      .trim();
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    await page.goto("/admin/team/history");
    const first = page.locator(".wa-event").first();
    await expect(
      first.getByRole("heading", { name: "Temporary cover added", exact: true }),
    ).toBeVisible();
    await page
      .locator(".wa-current-people dd, .wa-change-overview > p, .wa-recorded-change dd")
      .evaluateAll((elements) => {
        for (const element of elements)
          if (element instanceof HTMLElement) {
            element.style.fontSize = "28px";
            element.style.lineHeight = "1.5";
            element.style.letterSpacing = ".12em";
            element.style.wordSpacing = ".16em";
          }
      });
    const disclosure = first.locator(".wa-event-details > summary");
    await disclosure.focus();
    await expect(disclosure).toBeFocused();
    expect(
      await disclosure.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit !== null && element.contains(hit);
      }),
    ).toBe(true);
    await disclosure.press("Enter");
    await expect(
      first.getByRole("region", { name: "Recorded access change", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await first.getByRole("heading").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("long-current-name.png") });
    expect(f.writes).toEqual([]);
  });

test("the owner can open the current history destination", async ({ page }) => {
  const f = await workAuditFixture(page, "SUPER_ADMIN");
  f.rows = accessHistoryRows();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/team/history");
  await expect(
    page.getByRole("heading", { name: "Access change history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Change history", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".wa-event")).toHaveCount(6);
  expect(f.writes).toEqual([]);
});

test("history cursor paging retains its scoped view without putting references in the URL", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  const row = accessHistoryRows()[0]!;
  f.rows = Array.from({ length: 28 }, (_, n) => ({
    ...row,
    id: id(330000 + n),
    createdAt: new Date(Date.parse(row.createdAt) - n * 1000).toISOString(),
  }));
  await page.goto("/admin/team/history");
  await expect(page.locator(".wa-event")).toHaveCount(25);
  const pages = page.getByRole("navigation", {
    name: "Access change history pages",
    exact: true,
  });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(3);
  expect(f.reads.at(-1)!.searchParams.get("view")).toBe("ACCESS_CHANGES");
  expect(f.reads.at(-1)!.searchParams.get("cursor")).toBe(id(330024));
  await pages.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(25);
  expect(f.reads.at(-1)!.searchParams.has("cursor")).toBe(false);
  expect(f.reads.at(-1)!.searchParams.get("view")).toBe("ACCESS_CHANGES");
  expect(new URL(page.url()).search).toBe("");
  expect(f.writes).toEqual([]);
});

test("history distinguishes an unavailable read from no recorded changes and recovers", async ({
  page,
}) => {
  const f = await workAuditFixture(page);
  f.rows = accessHistoryRows();
  await page.goto("/admin/team/history");
  await expect(page.locator(".wa-event")).toHaveCount(6);
  f.mode = "error";
  await page.getByRole("button", { name: "Refresh history", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(0);
  await expect(
    page.getByText("No access changes on this page", { exact: true }),
  ).toHaveCount(0);
  f.mode = "empty";
  await page.getByRole("button", { name: "Refresh history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No access changes on this page", exact: true }),
  ).toBeVisible();
  f.mode = "normal";
  await page.getByRole("button", { name: "Refresh history", exact: true }).click();
  await expect(page.locator(".wa-event")).toHaveCount(6);
  expect(f.writes).toEqual([]);
});
