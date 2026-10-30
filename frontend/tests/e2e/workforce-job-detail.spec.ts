import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workforceJobDetailFixture } from "../fixtures/workforce-job-detail";
const button = (page: Page) =>
  page.getByRole("button", { name: "Review technical update", exact: true });
async function ready(page: Page, lead = false) {
  const state = await workforceJobDetailFixture(page, lead);
  await page.goto(`/admin/workforce/jobs/${state.job.id}?q=Engine`);
  await expect(
    page.getByRole("heading", { name: "WO-2026-0124", exact: true }),
  ).toBeVisible();
  await expect(button(page)).toBeEnabled();
  return state;
}
async function reviewUpdate(page: Page) {
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Ignition circuit tested and findings recorded.");
  await button(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function confirm(page: Page) {
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`workforce job detail layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Stadium Road", { exact: true })).toBeVisible();
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
    await page.getByLabel("Diagnosis", { exact: true }).focus();
    await expect(page.getByLabel("Diagnosis", { exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
test("technical review displays exact changes, cancels without writes and saves only changed fields", async ({
  page,
}) => {
  const state = await ready(page);
  await reviewUpdate(page);
  await expect(page.getByRole("dialog")).toContainText(
    "Ignition circuit tested and findings recorded.",
  );
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(button(page)).toBeEnabled();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Ignition circuit tested and findings recorded.",
  );
  await button(page).click();
  await confirm(page);
  await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
  expect(state.writes).toEqual([
    {
      kind: "work",
      body: {
        expectedVersion: 3,
        diagnosis: "Ignition circuit tested and findings recorded.",
      },
    },
  ]);
  await expect(page.locator(".wjd-notes")).toContainText(
    "Ignition circuit tested and findings recorded.",
  );
  await expect(
    page.getByRole("link", { name: "Back to jobs", exact: true }),
  ).toHaveAttribute("href", "/admin/workforce/jobs?q=Engine");
});
test("unchanged updates and clearing existing notes are rejected before confirmation", async ({
  page,
}) => {
  const state = await ready(page);
  await button(page).click();
  await expect(page.locator(".workforce-job-detail").getByRole("alert")).toContainText(
    "Change a note",
  );
  await page.getByLabel("Diagnosis", { exact: true }).fill(" ");
  await button(page).click();
  await expect(page.locator(".workforce-job-detail").getByRole("alert")).toContainText(
    "cannot be cleared",
  );
  await expect(page.getByLabel("Diagnosis", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveAccessibleDescription(
    /cannot be cleared/,
  );
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
for (const initial of ["APPROVED", "AWAITING_PARTS"])
  test(`start or resume work from ${initial}`, async ({ page }) => {
    const state = await workforceJobDetailFixture(page);
    state.job.workOrder!.status = initial;
    state.job.status = initial === "APPROVED" ? "CONFIRMED" : "IN_PROGRESS";
    await page.goto(`/admin/workforce/jobs/${state.job.id}`);
    await expect(button(page)).toBeEnabled();
    await page.getByLabel("Progress", { exact: true }).selectOption("IN_PROGRESS");
    await button(page).click();
    await confirm(page);
    await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
    expect(state.job.status).toBe("IN_PROGRESS");
    expect(state.job.workOrder!.status).toBe("IN_PROGRESS");
  });
for (const status of ["AWAITING_PARTS", "QUALITY_CHECK"])
  test(`technician moves in-progress work to ${status}`, async ({ page }) => {
    const state = await ready(page);
    await page.getByLabel("Progress", { exact: true }).selectOption(status);
    await button(page).click();
    await confirm(page);
    await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
    expect(state.job.workOrder!.status).toBe(status);
    if (status === "QUALITY_CHECK")
      await expect(
        page.getByRole("button", { name: "Review quality approval", exact: true }),
      ).toHaveCount(0);
  });
test("lead independently approves quality and completed jobs have no editing or assignment controls", async ({
  page,
}) => {
  const state = await workforceJobDetailFixture(page, true);
  state.job.workOrder!.status = "QUALITY_CHECK";
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await page
    .getByLabel("Review findings", { exact: true })
    .fill("Independent test drive and ignition readings verified.");
  await page
    .getByRole("button", { name: "Review quality approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Complete the work order and booking",
  );
  await confirm(page);
  await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
  expect(state.writes[0].kind).toBe("quality");
  expect(state.job.workOrder!.qualityApprovedByUserId).toBe(state.base.access.userId);
  await expect(
    page.getByRole("button", { name: "Review quality approval", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Assign technician", exact: true }),
  ).toHaveCount(0);
});
test("quality review rejects self-review and unattributed work", async ({ page }) => {
  const state = await workforceJobDetailFixture(page, true);
  state.job.workOrder!.status = "QUALITY_CHECK";
  state.job.workOrder!.workedByUserIds = [state.base.access.userId];
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await expect(page.getByText(/You cannot approve work you performed/)).toBeVisible();
  await expect(page.getByLabel("Review findings", { exact: true })).toHaveCount(0);
  state.job.workOrder!.workedByUserIds = [];
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(page.getByText(/You cannot approve work you performed/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("assignment supports complete paging, search and retained selection with exact review", async ({
  page,
}) => {
  const state = await ready(page, true);
  await expect(page.locator(".wjd-options input")).toHaveCount(25);
  await page.getByRole("button", { name: "Next technicians", exact: true }).click();
  await expect(page.locator(".wjd-options input")).toHaveCount(2);
  await page.getByRole("radio", { name: /^Zara Okafor\s*Staff reference:/ }).check();
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(page.locator(".wjd-options input")).toHaveCount(25);
  await page
    .getByRole("searchbox", { name: "Search technicians", exact: true })
    .fill("Zara");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".wjd-options input")).toHaveCount(1);
  await expect(
    page.getByRole("radio", { name: /^Zara Okafor\s*Staff reference:/ }),
  ).toBeChecked();
  await page
    .getByLabel("Assignment reason", { exact: true })
    .fill("Transfer the job to the available technician.");
  await page.getByRole("button", { name: "Review job assignment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Zara Okafor");
  await confirm(page);
  await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
  expect(state.job.assignedStaffId).toBe(state.candidates[26].id);
  expect(state.writes).toHaveLength(1);
});
test("harmless refresh preserves drafts and changed versions require explicit replacement", async ({
  page,
}) => {
  const state = await ready(page);
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Unsent retained diagnostic findings.");
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(button(page)).toBeEnabled();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Unsent retained diagnostic findings.",
  );
  state.job.workOrder!.version++;
  state.job.workOrder!.diagnosis = "Another technician recorded this.";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "The job has changed", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Unsent retained diagnostic findings.",
  );
  await expect(button(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Load latest values into draft", exact: true })
    .click();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Another technician recorded this.",
  );
});
test("preflight detects a newer job and sends no mutation", async ({ page }) => {
  const state = await ready(page);
  await reviewUpdate(page);
  state.job.workOrder!.version++;
  await confirm(page);
  await expect(page.getByRole("dialog")).toContainText("The job changed");
  expect(state.writes).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
});
test("definite rejection retains the draft and does not leave an uncertain lock", async ({
  page,
}) => {
  const state = await ready(page);
  state.reject = true;
  await reviewUpdate(page);
  await confirm(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(button(page)).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Review an earlier job change", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Ignition circuit tested and findings recorded.",
  );
  expect(state.writes).toHaveLength(1);
});
test("a committed lost response remains locked through refresh and reload until independent reconciliation", async ({
  page,
}) => {
  const state = await ready(page);
  state.loseResponse = true;
  await reviewUpdate(page);
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Close & review record", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close & review record", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review an earlier job change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review an earlier job change", exact: true }),
  ).toBeVisible();
  await expect(button(page)).toBeDisabled();
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(button(page)).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Inspect current job", exact: true }).click();
  await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
  await page.getByRole("button", { name: "Finish reconciliation", exact: true }).click();
  await expect(page.getByText(/No change was resent/)).toBeVisible();
  await expect(button(page)).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});
test("malformed mutation receipts cannot show success or enable a retry", async ({
  page,
}) => {
  const state = await ready(page);
  state.malformed = true;
  await reviewUpdate(page);
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Close & review record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm change", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Job change recorded.", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
test("failed background reads hide retained facts and retry preserves unsent notes", async ({
  page,
}) => {
  const state = await ready(page);
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Unsent retained diagnostic findings.");
  state.fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".workforce-job-detail").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Job overview", exact: true }),
  ).toHaveCount(0);
  state.fail = false;
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(button(page)).toBeEnabled();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveValue(
    "Unsent retained diagnostic findings.",
  );
});
test("loading, missing work order and denied detail expose no mutation form", async ({
  page,
}) => {
  const state = await workforceJobDetailFixture(page);
  state.hold = true;
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await expect(page.getByText("Checking job access…", { exact: true })).toBeVisible();
  await expect(button(page)).toHaveCount(0);
  state.job.workOrder = null;
  state.job.vehicle = null;
  state.hold = false;
  state.release?.();
  await expect(page.getByText("Vehicle not recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A work order has not been prepared for this booking.", {
      exact: true,
    }),
  ).toBeVisible();
  state.denied = true;
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(page.locator(".workforce-job-detail").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Job overview", exact: true }),
  ).toHaveCount(0);
});
test("scope mismatch and revoked responsibility hide job facts", async ({ page }) => {
  const state = await ready(page);
  state.detailAccess = structuredClone(state.base.access);
  state.detailAccess.version++;
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(page.locator(".workforce-job-detail").getByRole("alert")).toContainText(
    "job access changed",
  );
  await expect(
    page.getByRole("heading", { name: "Job overview", exact: true }),
  ).toHaveCount(0);
  state.base.denied = true;
  await page.getByRole("button", { name: "Refresh job", exact: true }).click();
  await expect(page.getByText(/responsibilit|access/i).first()).toBeVisible();
  await expect(button(page)).toHaveCount(0);
});
test("assignment preflight rejects a technician who lost eligibility without sending", async ({
  page,
}) => {
  const state = await ready(page, true);
  await page.getByRole("radio", { name: /^Technician 01 Test Staff reference:/ }).check();
  await page
    .getByLabel("Assignment reason", { exact: true })
    .fill("Move this job to the available technician.");
  await page.getByRole("button", { name: "Review job assignment", exact: true }).click();
  state.candidates.shift();
  await confirm(page);
  await expect(page.getByRole("dialog")).toContainText("no longer eligible");
  expect(state.writes).toHaveLength(0);
});
test("unrecognized states render safe labels and no mutation controls", async ({
  page,
}) => {
  const state = await workforceJobDetailFixture(page);
  state.job.status = "toString";
  state.job.workOrder!.status = "constructor";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await expect(page.locator(".wjd-states")).toContainText("Status unavailable");
  await expect(button(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
for (const width of [430, 1440])
  test(`lead quality and assignment accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const state = await workforceJobDetailFixture(page, true);
    state.job.workOrder!.status = "QUALITY_CHECK";
    await page.goto(`/admin/workforce/jobs/${state.job.id}`);
    await expect(page.locator(".wjd-options input")).toHaveCount(25);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("technician search exposes empty and failed states with a working retry", async ({
  page,
}) => {
  const state = await ready(page, true);
  await expect(page.locator(".wjd-options input")).toHaveCount(25);
  await page
    .getByRole("searchbox", { name: "Search technicians", exact: true })
    .fill("Absent candidate");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No technicians match this search.", { exact: true }),
  ).toBeVisible();
  state.candidatesFail = true;
  await page.getByRole("searchbox", { name: "Search technicians", exact: true }).fill("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry technician search", exact: true }),
  ).toBeVisible();
  state.candidatesFail = false;
  await page
    .getByRole("button", { name: "Retry technician search", exact: true })
    .click();
  await expect(page.locator(".wjd-options input")).toHaveCount(25);
});
test("temporary responsibility expiry hides the job and unsent notes automatically", async ({
  page,
}) => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  await page.clock.install({ time: now });
  const state = await workforceJobDetailFixture(page);
  state.base.access.assignments[0].temporary = true;
  state.base.access.assignments[0].expiresAt = new Date(
    now.getTime() + 10000,
  ).toISOString();
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await expect(button(page)).toBeEnabled();
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Unsent private diagnostic findings.");
  state.base.access.assignments = [];
  state.base.access.permissions = [];
  await page.clock.fastForward(10100);
  await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
  await expect(
    page.getByText(
      "Your current responsibilities do not permit that page. You can continue with the tools available here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Diagnosis", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Job overview", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("identical technician names remain distinguishable in selection and confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await workforceJobDetailFixture(page, true);
  state.candidates[1].firstName = state.candidates[0].firstName;
  state.candidates[1].lastName = state.candidates[0].lastName;
  const target = state.candidates[1];
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await page
    .getByRole("radio", {
      name: `Technician 01 Test Staff reference: ${target.id}`,
      exact: true,
    })
    .check();
  await expect(page.locator(".wjd-selected")).toContainText(target.id);
  await page
    .getByLabel("Assignment reason", { exact: true })
    .fill("Assign the verified second technician with this name.");
  await page.getByRole("button", { name: "Review job assignment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(target.id);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await confirm(page);
  await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
  expect(state.writes[0].body.staffId).toBe(target.id);
});

test("trimmed quality and assignment errors identify and focus the affected field", async ({
  page,
}) => {
  const state = await workforceJobDetailFixture(page, true);
  state.job.workOrder!.status = "QUALITY_CHECK";
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  const findings = page.getByLabel("Review findings", { exact: true });
  await findings.fill("           ");
  await page
    .getByRole("button", { name: "Review quality approval", exact: true })
    .click();
  await expect(findings).toBeFocused();
  await expect(findings).toHaveAttribute("aria-invalid", "true");
  await expect(findings).toHaveAccessibleDescription(/Enter a reason/);
  await findings.fill("Independent checks completed.");
  await expect(findings).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("radio", { name: /^Technician 01 Test Staff reference:/ }).check();
  const reason = page.getByLabel("Assignment reason", { exact: true });
  await reason.fill("           ");
  await page.getByRole("button", { name: "Review job assignment", exact: true }).click();
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAccessibleDescription(/Enter a reason/);
  expect(state.writes).toHaveLength(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("long technical data and names wrap at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await workforceJobDetailFixture(page);
  state.job.workOrder!.workOrderNumber = "W".repeat(40);
  state.job.branch!.name = "LongBranchName".repeat(15);
  state.job.customerNotes = "LongReportedSymptom".repeat(100);
  await page.goto(`/admin/workforce/jobs/${state.job.id}`);
  await expect(button(page)).toBeEnabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

for (const width of [390, 1440])
  test(`lead classifies a concern during assignment at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const state = await workforceJobDetailFixture(page, true);
    state.job.service = null;
    state.job.status = "REQUESTED";
    state.job.workOrder = null;
    state.job.customerConcern = "Engine rattles on cold start.";
    await page.route("**/api/v1/public/services?**", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic classification services",
          meta: { requestId: "classification-services" },
          data: {
            items: [
              {
                ...state.classificationService,
                durationMinutes: 60,
                pricingType: "QUOTE_REQUIRED",
                priceKobo: null,
              },
            ],
          },
        },
      }),
    );
    await page.goto(`/admin/workforce/jobs/${state.job.id}`);
    await page
      .getByRole("radio", { name: /^Technician 01 Test Staff reference:/ })
      .check();
    await page
      .getByLabel("Service for this concern", { exact: true })
      .selectOption(state.classificationService.id);
    await page
      .getByLabel("Assignment reason", { exact: true })
      .fill("Reviewed concern and technician suitability.");
    await page
      .getByRole("button", { name: "Review job assignment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      state.classificationService.name,
    );
    await expect(page.getByRole("dialog")).toContainText(
      "Remains requested; no payment or confirmation",
    );
    expect(state.writes).toHaveLength(0);
    expect(
      (await new AxeBuilder({ page }).include(".mutation-review").analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`concern-classification-${width}.png`),
    });
    await confirm(page);
    await expect(page.getByText("Job change recorded.", { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body.serviceId).toBe(state.classificationService.id);
    expect(state.job.status).toBe("REQUESTED");
    await expect(
      page.getByText(state.job.customerConcern, { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
