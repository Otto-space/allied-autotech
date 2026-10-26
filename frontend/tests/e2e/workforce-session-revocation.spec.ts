import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workforceAccessFixture, id } from "../fixtures/workforce-access";
const jobPath = `/admin/workforce/jobs/${id(20)}`;
const recheck = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("aat:workforce-recheck")));
const explanation =
  "Your current responsibilities do not permit that page. You can continue with the tools available here.";

for (const width of [390, 1440])
  test(`revocation clears an open review, private work and draft, then redirects at ${width}px`, async ({
    page,
  }) => {
    const state = await workforceAccessFixture(page, true, undefined, true);
    const errors: string[] = [];
    const consoleIssues: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        consoleIssues.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(jobPath);
    await page
      .getByLabel("Diagnosis", { exact: true })
      .fill("Unsent synthetic private workshop findings");
    await page
      .getByRole("button", { name: "Review technical update", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(
      ({ user, path }) => {
        sessionStorage.setItem(
          "aat:form-draft:v1:" + JSON.stringify([user + ":STAFF", path, "technical"]),
          JSON.stringify({ diagnosis: "Unsent synthetic private workshop findings" }),
        );
        sessionStorage.setItem(
          "aat:form-draft:v1:" + JSON.stringify([user + ":STAFF", "/parts", "enquiry"]),
          JSON.stringify({ part: "Preserved public enquiry" }),
        );
      },
      { user: id(1), path: jobPath },
    );
    state.access.assignments = [];
    state.access.permissions = [];
    state.access.version++;
    await recheck(page);
    await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
    await expect(page.getByText(explanation, { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain(
      "Unsent synthetic private workshop findings",
    );
    const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain("Unsent synthetic private workshop findings");
    expect(storage).toContain("Preserved public enquiry");
    expect(state.writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(consoleIssues).toEqual([]);
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
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-workforce-revoked-${width}.png`),
      fullPage: false,
    });
  });

test("a late record response cannot restore a page after responsibility removal", async ({
  page,
}) => {
  const state = await workforceAccessFixture(page, true, undefined, true);
  let release: (() => void) | undefined;
  await page.route(`**/api/v1/staff/workforce/jobs/${id(20)}`, async (route) => {
    // An old, independently valid response was captured before access changed.
    const response = {
      ...state.job,
      access: structuredClone(state.access),
      generatedAt: new Date().toISOString(),
      branch: { id: id(2), name: "Synthetic workforce branch" },
      assignedStaff: { id: id(5), firstName: "Ada", lastName: "Okoro" },
    };
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await route.fulfill({
        json: {
          success: true,
          data: response,
          message: "Held fixture",
          meta: { requestId: "held-record" },
        },
      });
    } catch {
      /* Aborted routes cannot deliver data. */
    }
  });
  await page.goto(jobPath);
  await expect.poll(() => !!release).toBe(true);
  state.access.permissions = [];
  state.access.assignments = [];
  state.access.version++;
  await recheck(page);
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  release!();
  await expect(page.getByText(explanation, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Technical work", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Engine noise reported", { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("two open tabs recheck current access from a data-free broadcast without signing out", async ({
  page,
  context,
}) => {
  const state = await workforceAccessFixture(page, true, undefined, true),
    second = await context.newPage();
  await workforceAccessFixture(second, true, state, true);
  await page.goto(jobPath);
  await second.goto(jobPath);
  await expect(second.getByLabel("Diagnosis", { exact: true })).toBeVisible();
  state.access.permissions = [];
  state.access.assignments = [];
  state.access.version++;
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-workforce");
    channel.postMessage({ type: "recheck", source: "isolated-fixture-document" });
    channel.close();
  });
  for (const tab of [page, second]) {
    await expect(tab).toHaveURL(/\/admin\?workAccess=updated$/);
    await expect(tab.getByText(explanation, { exact: true })).toBeVisible();
    await expect(
      tab.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await expect(tab.getByLabel("Diagnosis", { exact: true })).toHaveCount(0);
  }
  expect(state.writes).toEqual([]);
});

test("adding responsibilities reveals tools without changing tier or opening a module", async ({
  page,
}) => {
  const state = await workforceAccessFixture(page, true, undefined, true);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Operational overview", exact: true }),
  ).toBeVisible();
  state.access.assignments.push({
    ...state.access.assignments[0],
    id: id(30),
    template: "CUSTOMER_SERVICE",
    scope: "BRANCH",
  });
  state.access.permissions.push(
    "CUSTOMER_ENQUIRIES",
    "COMPLAINTS",
    "BOOKINGS_READ",
    "ORDERS_READ",
  );
  state.access.version++;
  await recheck(page);
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(nav.getByText("Customers & Enquiries", { exact: true })).toBeVisible();
  await nav.getByText("Customers & Enquiries", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "Enquiries", exact: true })).toBeVisible();
  await nav.getByText("Workshop", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "My jobs", exact: true })).toBeVisible();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("branch changes invalidate an open detail even with the same assignment ID and version", async ({
  page,
}) => {
  const state = await workforceAccessFixture(page, true, undefined, true);
  await page.route(`**/api/v1/staff/workforce/jobs/${id(20)}`, (route) =>
    state.access.assignments[0]?.branchId === id(2)
      ? route.fallback()
      : route.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        }),
  );
  await page.goto(jobPath);
  await expect(page.getByLabel("Diagnosis", { exact: true })).toBeVisible();
  state.access.assignments[0].branchId = id(99);
  await recheck(page);
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Engine noise reported", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Job details", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("a foreign current-access projection never mounts private records", async ({
  page,
}) => {
  const state = await workforceAccessFixture(page, true);
  await page.route("**/api/v1/staff/workforce/access", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Foreign isolated fixture",
        meta: { requestId: "foreign-access" },
        data: {
          ...state.access,
          userId: id(99),
          assignments: state.access.assignments.map((a) => ({ ...a, userId: id(99) })),
        },
      },
    }),
  );
  await page.goto(jobPath);
  await expect(
    page.getByRole("heading", { name: "Work access unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your current work access could not be verified. Retry before continuing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveCount(0);
  expect(state.reads).not.toContain(`/staff/workforce/jobs/${id(20)}`);
  expect(state.writes).toEqual([]);
});
