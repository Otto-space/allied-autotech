import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceJobsFixture } from "../fixtures/workforce-jobs";
const root = "/admin/workforce/jobs";
const rows = (page: Page) => page.locator(".wfj-results tbody tr");
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh jobs", exact: true });
async function ready(page: Page) {
  const state = await workforceJobsFixture(page);
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  return state;
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`workforce jobs layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Workshop jobs", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Vehicle not recorded", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Booking: Confirmed", { exact: true }).first(),
    ).toBeVisible();
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
    await page.getByLabel("Search jobs", { exact: true }).focus();
    await expect(page.getByLabel("Search jobs", { exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
for (const template of [
  "WORKSHOP_LEAD",
  "ELECTRICAL_TECHNICIAN",
  "MECHANICAL_TECHNICIAN",
] as const)
  test(`${template} sees permitted jobs`, async ({ page }) => {
    const state = await workforceJobsFixture(page, template === "WORKSHOP_LEAD");
    state.access.assignments[0].template = template;
    await page.goto(root);
    await expect(rows(page)).toHaveCount(25);
    expect(state.requests).not.toContain("/staff/bookings");
    expect(state.requests).not.toContain("/staff/payments");
  });
test("search and work status submit together across permitted records", async ({
  page,
}) => {
  const state = await ready(page),
    before = state.reads.length;
  await page.getByLabel("Search jobs", { exact: true }).fill("Toyota");
  await page.getByLabel("Work status", { exact: true }).selectOption("IN_PROGRESS");
  expect(state.reads).toHaveLength(before);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/q=Toyota&workStatus=IN_PROGRESS/);
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator(".wfj-results")).not.toContainText("Honda");
  await page.reload();
  await expect(page.getByLabel("Search jobs", { exact: true })).toHaveValue("Toyota");
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(root + "$"));
  await expect(rows(page)).toHaveCount(25);
});
test("clear filters resets an unsent draft even on the unfiltered URL", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Search jobs", { exact: true }).fill("Unsent draft");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByLabel("Search jobs", { exact: true })).toHaveValue("");
});
test("paging survives reload, previous, browser Back and job-detail return", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByRole("button", { name: "Next jobs", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  const nextURL = page.url();
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await page
    .getByRole("link", { name: state.jobs[25].workOrder!.workOrderNumber, exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: state.jobs[25].workOrder!.workOrderNumber,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to jobs", exact: true }).click();
  await expect(page).toHaveURL(nextURL);
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page.goBack();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "First page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
});
test("work-order-not-created filter preserves the booking state", async ({ page }) => {
  await ready(page);
  await page.getByLabel("Work status", { exact: true }).selectOption("NOT_CREATED");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Not created");
  await expect(rows(page)).toContainText("Booking: Confirmed");
});
test("empty scope and unmatched search have distinct helpful states", async ({
  page,
}) => {
  const state = await workforceJobsFixture(page);
  state.jobs = [];
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "No jobs in your current scope" }),
  ).toBeVisible();
  await page.getByLabel("Search jobs", { exact: true }).fill("Missing");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No jobs match these filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next jobs", exact: true }),
  ).toBeDisabled();
});
test("loading and denied reads show no records", async ({ page }) => {
  const state = await workforceJobsFixture(page);
  state.holdJobs = true;
  await page.goto(root);
  await expect(page.getByText("Checking permitted jobs…", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  state.holdJobs = false;
  state.deniedJobs = true;
  state.releaseJobs?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Job access unavailable",
  );
  await expect(rows(page)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("foreground and background failures hide retained records and retry recovers", async ({
  page,
}) => {
  const state = await ready(page);
  state.fail = true;
  await refresh(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Jobs could not be refreshed",
  );
  await expect(rows(page)).toHaveCount(0);
  state.fail = false;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(25);
  state.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Jobs could not be refreshed",
  );
});
test("background refresh preserves the unsent search draft", async ({ page }) => {
  const state = await ready(page),
    before = state.reads.length;
  await page.getByLabel("Search jobs", { exact: true }).fill("Unsent diagnostics");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.reads.length).toBeGreaterThan(before);
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByLabel("Search jobs", { exact: true })).toHaveValue(
    "Unsent diagnostics",
  );
});
test("invalid URLs never send a jobs request and can be reset", async ({ page }) => {
  const state = await workforceJobsFixture(page);
  for (const query of [
    "q=a&q=b",
    "workStatus=toString",
    "cursor=not-a-cursor",
    "branchId=foreign",
  ]) {
    await page.goto(root + "?" + query);
    await expect(
      page.getByRole("heading", { name: "Job filters unavailable" }),
    ).toBeVisible();
  }
  expect(state.reads).toEqual([]);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
});
test("mismatched access versions cannot render job data", async ({ page }) => {
  const state = await workforceJobsFixture(page);
  state.responseAccess = structuredClone(state.access);
  state.responseAccess.version++;
  await page.goto(root);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your responsibilities changed",
  );
  await expect(rows(page)).toHaveCount(0);
  state.responseAccess = state.access;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(25);
});
test("malformed and foreign-branch responses fail closed", async ({ page }) => {
  const state = await workforceJobsFixture(page);
  state.malformed = true;
  await page.goto(root);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Jobs could not be refreshed",
  );
  state.malformed = false;
  state.jobs[0].branchId = "b6000000-0000-4000-8000-000000000999";
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Jobs could not be refreshed",
  );
});
test("revoked responsibility removes retained jobs and queue access", async ({
  page,
}) => {
  const state = await ready(page);
  state.access.assignments = [];
  state.access.permissions = [];
  state.access.version++;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});
test("a nontechnical responsibility cannot read the jobs queue", async ({ page }) => {
  const state = await workforceJobsFixture(page);
  state.access.permissions = ["FINANCE_READ"];
  state.access.assignments[0].template = "ACCOUNTANT";
  await page.goto(root);
  await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();
  expect(state.reads).toEqual([]);
});
test("long job and vehicle labels wrap at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const state = await workforceJobsFixture(page);
  state.jobs[0].service.name = "D".repeat(180);
  state.jobs[0].vehicle!.registrationNumber = "R".repeat(100);
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByText("D".repeat(180), { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("all work status options apply their corresponding server filter", async ({
  page,
}) => {
  await ready(page);
  for (const [status, label] of Object.entries({
    DRAFT: "Draft",
    APPROVED: "Approved",
    IN_PROGRESS: "In progress",
    AWAITING_PARTS: "Awaiting parts",
    QUALITY_CHECK: "Quality check",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NOT_CREATED: "Not created",
  })) {
    await page.getByLabel("Work status", { exact: true }).selectOption(status);
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`workStatus=${status}`));
    await expect(page.locator(".wfj-status").first()).toHaveText(label);
    expect(
      (await page.locator(".wfj-status").allTextContents()).every(
        (value) => value === label,
      ),
    ).toBe(true);
  }
});
test("temporary assignment expiry removes the jobs queue without interaction", async ({
  page,
}) => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  await page.clock.install({ time: now });
  const state = await workforceJobsFixture(page);
  state.access.assignments[0].temporary = true;
  state.access.assignments[0].expiresAt = new Date(now.getTime() + 10000).toISOString();
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  state.access.assignments = [];
  state.access.permissions = [];
  await page.clock.fastForward(10100);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`concern-only workforce job opens from queue at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const state = await workforceJobsFixture(page, true),
      job = state.jobs[0];
    job.service = null;
    job.customerConcern = "Engine rattles when starting from cold.";
    job.status = "REQUESTED";
    job.workOrder = null;
    await page.goto(root);
    await expect(rows(page)).toHaveCount(25);
    await expect(rows(page).first()).toContainText("Vehicle concern");
    await rows(page)
      .first()
      .getByRole("link", {
        name: "Open Work order pending — Vehicle concern",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/workforce/jobs/${job.id}`));
    await expect(page.getByText(job.customerConcern, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Synthetic customer note", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".workforce-job-detail").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`concern-workforce-${width}.png`),
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByText(job.customerConcern, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
