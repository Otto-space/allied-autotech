import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workforceComplaintsFixture,
  complaintFixtureId,
} from "../fixtures/workforce-complaints";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
const root = "/admin/workforce/complaints";
const rows = (page: Page) => page.locator(".wfc-results tbody tr");
const detail = (page: Page) =>
  page.getByRole("region", { name: "Selected complaint", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh records", exact: true });
async function ready(page: Page) {
  const state = await workforceComplaintsFixture(page);
  await page.goto(root + "?selected=" + complaintFixtureId(1));
  await expect(rows(page)).toHaveCount(2);
  await expect(
    detail(page).getByRole("heading", {
      name: "Follow-up after brake service",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  return state;
}
for (const width of [320, 375, 430, 768, 1024, 1280, 1440])
  test(`complaint layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Complaints", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(detail(page)).toContainText("The warning appears when I start the car.");
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
    expect(errors).toEqual([]);
    if ([430, 768, 1280, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({
        path: `C:/Users/PC/.codex/workforce-complaints-final-${width}.png`,
        fullPage: true,
      });
    }
  });
test("search applies together, empty state, clear, reload and selected URL", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Search complaints", { exact: true }).fill("Collection");
  await page.getByLabel("Priority", { exact: true }).selectOption("MEDIUM");
  await page.getByLabel("Status", { exact: true }).selectOption("OPEN");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "View complaint: Collection update requested",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp("selected=" + complaintFixtureId(2)));
  await expect(
    detail(page).getByRole("heading", {
      name: "Collection update requested",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    detail(page).getByRole("heading", {
      name: "Collection update requested",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Search complaints", { exact: true })).toHaveValue(
    "Collection",
  );
  await page.getByLabel("Search complaints", { exact: true }).fill("No such complaint");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByText("No complaints match these filters", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(root + "$"));
});
test("queue and message paging survive reload and Back", async ({ page }) => {
  const state = await workforceComplaintsFixture(page);
  for (let i = 3; i <= 27; i++)
    state.items.push({
      ...state.items[0],
      id: complaintFixtureId(i),
      subject: `Vehicle complaint ${i}`,
    });
  for (let i = 3; i <= 27; i++)
    state.messages.push({
      ...state.messages[1],
      id: complaintFixtureId(100 + i),
      body: `Customer message ${i}`,
      createdAt: new Date(Date.parse("2026-10-19T08:10:00Z") + i * 60000).toISOString(),
    });
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await page.getByRole("button", { name: "Next complaints", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page
    .getByRole("button", {
      name: "View complaint: Follow-up after brake service",
      exact: true,
    })
    .click();
  await expect(page.locator(".wfc-messages li")).toHaveCount(25);
  await page.getByRole("button", { name: "Older messages", exact: true }).click();
  await expect(page.locator(".wfc-messages li")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".wfc-messages li")).toHaveCount(2);
  await page.goBack();
  await expect(page.locator(".wfc-messages li")).toHaveCount(25);
});
test("reply reviews exact text, records once, clears draft and displays receipt success", async ({
  page,
}) => {
  const state = await ready(page);
  const text = "We will confirm availability with the inspection team.";
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(text);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(
    page.getByText("Your reply was recorded in the customer conversation.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await expect(page.locator(".wfc-messages")).toContainText(text);
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toMatch(/\/replies$/);
  expect(state.writes[0].body.expectedLatestMessageId).toBe(complaintFixtureId(102));
});
test("refresh preserves drafts; a new customer message requires explicit review", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByLabel("Message", { exact: true }).fill("Retained reply");
  await refresh(page).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Retained reply");
  state.messages.push({
    ...state.messages[1],
    id: complaintFixtureId(200),
    body: "My appointment time changed.",
    createdAt: "2026-10-19T09:00:00.000Z",
  });
  await refresh(page).click();
  await expect(
    page.getByText("The conversation has changed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Retained reply");
  await page
    .getByRole("button", {
      name: "Use retained draft with latest conversation",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
});
test("fresh preflight rejects a conversation changed after review", async ({ page }) => {
  const state = await ready(page);
  await page.getByLabel("Message", { exact: true }).fill("Reply being reviewed");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  state.messages.push({
    ...state.messages[1],
    id: complaintFixtureId(200),
    body: "New customer reply",
    createdAt: "2026-10-19T09:00:00.000Z",
  });
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("The conversation changed.");
  expect(state.writes).toHaveLength(0);
});
for (const mode of [
  "lostResponse",
  "malformedReceipt",
  "timeoutResponse",
  "throttledResponse",
] as const)
  test(`${mode} stays locked through reload and requires reconciliation without replay`, async ({
    page,
  }) => {
    const state = await ready(page);
    state[mode] = true;
    await page.getByLabel("Message", { exact: true }).fill("Receipt uncertain reply");
    await page.getByRole("button", { name: "Review reply", exact: true }).click();
    await page.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "The outcome could not be confirmed.",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Review an earlier complaint change",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Inspect current complaint", exact: true })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
    await page
      .getByRole("button", { name: "Finish reconciliation", exact: true })
      .click();
    await expect(
      page.getByText(
        "Reconciliation recorded for this browser session. No change was resent.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });
test("failed list/detail refresh hides private facts and preserves a draft until successful refresh", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByLabel("Message", { exact: true }).fill("Retained while unavailable");
  state.detailFailure = true;
  await refresh(page).click();
  await expect(
    page.getByText("Complaint could not be verified", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wfc-messages")).toHaveCount(0);
  state.detailFailure = false;
  await refresh(page).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Retained while unavailable",
  );
  state.listFailure = true;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator(".wfc-messages")).toHaveCount(0);
});
test("closed complaint shows recorded resolution and history without reply actions", async ({
  page,
}) => {
  const state = await workforceComplaintsFixture(page);
  state.items[0].status = "CLOSED";
  state.items[0].resolution =
    "The workshop rechecked the brakes and confirmed the repair.";
  state.items[0].resolvedAt = "2026-10-19T10:00:00.000Z";
  state.items[0].closedAt = "2026-10-19T11:00:00.000Z";
  await page.goto(root + "?selected=" + complaintFixtureId(1));
  await expect(page.locator(".wfc-messages li")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change assignee", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recorded resolution" })).toBeVisible();
  await expect(page.locator(".wfc-resolution")).toContainText(state.items[0].resolution!);
});
test("invalid queries make no complaint requests and denied workforce cannot open queue", async ({
  page,
}) => {
  const state = await workforceComplaintsFixture(page);
  await page.goto(root + "?selected=invalid");
  await expect(
    page.getByText("Complaint filters unavailable", { exact: true }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.unrouteAll({ behavior: "wait" });
  await workforceNotificationsFixture(page, "MECHANICAL_TECHNICIAN");
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
});

test("denied detail clears a private draft and scope mismatch hides queue and conversation", async ({
  page,
}) => {
  const state = await ready(page);
  await page
    .getByLabel("Message", { exact: true })
    .fill("Private draft cleared on denial");
  state.detailDenied = true;
  await refresh(page).click();
  await expect(
    page.getByText("Complaint access unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
  state.detailDenied = false;
  await refresh(page).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  state.listMismatch = true;
  await refresh(page).click();
  await expect(
    page.getByText("Your responsibilities changed", { exact: true }),
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator(".wfc-messages")).toHaveCount(0);
});

test("loading hides the conversation until scoped detail verification settles", async ({
  page,
}) => {
  await workforceComplaintsFixture(page);
  let release: (() => void) | undefined;
  await page.route(
    "**/api/v1/staff/workforce/complaints/" + complaintFixtureId(1) + "?*",
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fallback();
    },
  );
  await page.goto(root + "?selected=" + complaintFixtureId(1));
  try {
    await expect(page.getByText(/^Checking the selected complaint/)).toBeVisible();
    await expect(page.locator(".wfc-messages")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toHaveCount(0);
  } finally {
    release?.();
  }
  await expect(page.locator(".wfc-messages li")).toHaveCount(2);
});

test("response tracking is read-only and empty replies have associated validation", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Response tracking", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wfc-tracking")).toContainText("Not recorded");
  await expect(
    page.getByRole("button", {
      name: /^(Acknowledge|Resolve|Escalate|Change assignee)$/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  const input = page.getByLabel("Message", { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", /wfc-action-error/);
});

test("320px long complaint and keyboard review stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await workforceComplaintsFixture(page);
  state.items[0].subject = "Complaint".repeat(22);
  state.items[0].description = "Description".repeat(80);
  await page.goto(root + "?selected=" + complaintFixtureId(1));
  const input = page.getByLabel("Message", { exact: true });
  await expect(input).toBeVisible();
  await input.fill("Please return so we can inspect the warning light.");
  await page.getByRole("button", { name: "Review reply", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
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
  expect(state.writes).toHaveLength(0);
});
