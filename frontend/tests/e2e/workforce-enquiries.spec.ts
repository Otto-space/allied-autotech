import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workforceEnquiriesFixture,
  enquiryFixtureId,
} from "../fixtures/workforce-enquiries";
import { workforceNotificationsFixture } from "../fixtures/workforce-notifications";
const root = "/admin/workforce/enquiries";
const rows = (page: Page) => page.locator(".wfe-results tbody tr");
const detail = (page: Page) =>
  page.getByRole("region", { name: "Selected enquiry", exact: true });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh enquiries", exact: true });
async function ready(
  page: Page,
  template:
    "CUSTOMER_SERVICE" | "SALES_SUPERVISOR" | "SALES_CASHIER" = "SALES_SUPERVISOR",
) {
  const state = await workforceEnquiriesFixture(page, template);
  await page.goto(root + "?selected=" + enquiryFixtureId(1));
  await expect(rows(page)).toHaveCount(2);
  await expect(
    detail(page).getByRole("heading", { name: "Toyota Corolla inspection", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  return state;
}
for (const width of [360, 390, 430, 768, 1024, 1280, 1440])
  test(`enquiry layout and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Enquiries", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb", exact: true }),
    ).toHaveCount(1);
    await expect(detail(page)).toContainText("Would 10:00 work?");
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
    if ([430, 768, 1280, 1440].includes(width))
      await page.screenshot({
        path: `C:/Users/PC/.codex/workforce-enquiries-final-${width}.png`,
        fullPage: true,
      });
  });
for (const template of ["CUSTOMER_SERVICE", "SALES_SUPERVISOR", "SALES_CASHIER"] as const)
  test(`${template} sees only available enquiry actions`, async ({ page }) => {
    const state = await ready(page, template);
    await expect(
      page.getByRole("button", { name: "Change assignee", exact: true }),
    ).toHaveCount(template === "SALES_SUPERVISOR" ? 1 : 0);
    await expect(page.locator("#wfe-type option")).toHaveCount(
      template === "CUSTOMER_SERVICE" ? 7 : 3,
    );
    expect(state.base.requests.some((p) => p.startsWith("/staff/enquiries"))).toBe(false);
  });
test("search applies together, empty state, clear, reload and selected URL", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Search enquiries", { exact: true }).fill("Brake");
  await page.getByLabel("Enquiry type", { exact: true }).selectOption("PRODUCT");
  await page.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByRole("button", { name: "View enquiry: Brake pad compatibility", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("selected=" + enquiryFixtureId(2)));
  await expect(
    detail(page).getByRole("heading", { name: "Brake pad compatibility", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    detail(page).getByRole("heading", { name: "Brake pad compatibility", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Search enquiries", { exact: true })).toHaveValue("Brake");
  await page.getByLabel("Search enquiries", { exact: true }).fill("No such enquiry");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(
    page.getByText("No enquiries match these filters", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(root + "$"));
});
test("queue and message paging survive reload and Back", async ({ page }) => {
  const state = await workforceEnquiriesFixture(page);
  for (let i = 3; i <= 27; i++)
    state.items.push({
      ...state.items[0],
      id: enquiryFixtureId(i),
      subject: `Vehicle enquiry ${i}`,
    });
  for (let i = 3; i <= 27; i++)
    state.messages.push({
      ...state.messages[1],
      id: enquiryFixtureId(100 + i),
      body: `Customer message ${i}`,
      createdAt: new Date(Date.parse("2026-10-19T08:10:00Z") + i * 60000).toISOString(),
    });
  await page.goto(root);
  await expect(rows(page)).toHaveCount(25);
  await page.getByRole("button", { name: "Next enquiries", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  await page
    .getByRole("button", { name: "View enquiry: Toyota Corolla inspection", exact: true })
    .click();
  await expect(page.locator(".wfe-messages li")).toHaveCount(25);
  await page.getByRole("button", { name: "Older messages", exact: true }).click();
  await expect(page.locator(".wfe-messages li")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".wfe-messages li")).toHaveCount(2);
  await page.goBack();
  await expect(page.locator(".wfe-messages li")).toHaveCount(25);
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
  await expect(page.getByText("Enquiry change recorded.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await expect(page.locator(".wfe-messages")).toContainText(text);
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toMatch(/\/replies$/);
  expect(state.writes[0].body.expectedLatestMessageId).toBe(enquiryFixtureId(102));
});
test("assignment searches colleagues, requires reason, prevents current assignee and records exact receipt", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByRole("button", { name: "Change assignee", exact: true }).click();
  await page.getByRole("radio", { name: /Ada Okoro/ }).check();
  await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
  await expect(
    page.getByText("Choose a different eligible sales colleague.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search eligible staff", exact: true })
    .fill("Chidi");
  await page.getByRole("button", { name: "Search staff", exact: true }).click();
  await page.getByRole("radio", { name: /Chidi Eze/ }).check();
  await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
  await expect(page.getByLabel("Reassignment reason", { exact: true })).toBeFocused();
  await page
    .getByLabel("Reassignment reason", { exact: true })
    .fill("Covering the inspection desk this afternoon.");
  await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(enquiryFixtureId(4));
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByText("Enquiry change recorded.", { exact: true })).toBeVisible();
  await expect(page.locator(".wfe-facts")).toContainText("Chidi Eze");
  expect(state.writes).toHaveLength(1);
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
    id: enquiryFixtureId(200),
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
    id: enquiryFixtureId(200),
    body: "New customer reply",
    createdAt: "2026-10-19T09:00:00.000Z",
  });
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("The conversation changed.");
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["lostResponse", "malformedReceipt"] as const)
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
        name: "Review an earlier enquiry change",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Inspect current enquiry", exact: true })
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
    page.getByText("Enquiry could not be verified", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wfe-messages")).toHaveCount(0);
  state.detailFailure = false;
  await refresh(page).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Retained while unavailable",
  );
  state.listFailure = true;
  await refresh(page).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator(".wfe-messages")).toHaveCount(0);
});
test("closed enquiry has history but no reply or assignment form", async ({ page }) => {
  const state = await workforceEnquiriesFixture(page);
  state.items[0].status = "CLOSED";
  await page.goto(root + "?selected=" + enquiryFixtureId(1));
  await expect(page.locator(".wfe-messages li")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change assignee", exact: true }),
  ).toHaveCount(0);
});
test("invalid queries make no enquiry requests and denied workforce cannot open queue", async ({
  page,
}) => {
  const state = await workforceEnquiriesFixture(page);
  await page.goto(root + "?selected=invalid");
  await expect(
    page.getByText("Enquiry filters unavailable", { exact: true }),
  ).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await page.unrouteAll({ behavior: "wait" });
  await workforceNotificationsFixture(page, "MECHANICAL_TECHNICIAN");
  await page.goto(root);
  await expect(
    page.getByRole("heading", { name: "Access unavailable", exact: true }),
  ).toBeVisible();
});

for (const width of [320, 1440])
  test(`expanded assignment long content and keyboard ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await ready(page);
    state.candidates[1].firstName = "Chidi".repeat(20);
    await page.getByRole("button", { name: "Change assignee", exact: true }).click();
    await expect(page.getByRole("radio")).toHaveCount(2);
    await page.getByRole("radio").last().focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio").last()).toBeChecked();
    await page
      .getByLabel("Reassignment reason", { exact: true })
      .fill("Covering the inspection desk during the afternoon shift.");
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
      path: `C:/Users/PC/.codex/workforce-enquiries-assignment-${width}.png`,
      fullPage: true,
    });
  });
test("staff paging retains selection and fresh eligibility blocks a removed colleague", async ({
  page,
}) => {
  const state = await ready(page);
  for (let i = 5; i <= 30; i++)
    state.candidates.push({
      id: enquiryFixtureId(i),
      firstName: "Colleague",
      lastName: String(i),
    });
  await page.getByRole("button", { name: "Change assignee", exact: true }).click();
  await expect(page.getByRole("radio")).toHaveCount(25);
  await page.getByRole("radio", { name: /Chidi Eze/ }).check();
  await page.getByRole("button", { name: "Next staff", exact: true }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.locator(".wfe-selected-staff")).toContainText("Chidi Eze");
  await page.getByRole("button", { name: "First staff", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Chidi Eze/ })).toBeChecked();
  await page
    .getByLabel("Reassignment reason", { exact: true })
    .fill("Please handle this vehicle enquiry.");
  await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
  state.candidates.splice(1, 1);
  await page.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "The selected colleague is no longer eligible.",
  );
  expect(state.writes).toHaveLength(0);
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
    page.getByText("Enquiry access unavailable", { exact: true }),
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
  await expect(page.locator(".wfe-messages")).toHaveCount(0);
});

test("loading hides the conversation until scoped detail verification settles", async ({
  page,
}) => {
  await workforceEnquiriesFixture(page);
  let release: (() => void) | undefined;
  await page.route(
    "**/api/v1/staff/workforce/enquiries/" + enquiryFixtureId(1) + "?*",
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fallback();
    },
  );
  await page.goto(root + "?selected=" + enquiryFixtureId(1));
  try {
    await expect(page.getByText(/^Checking the selected enquiry/)).toBeVisible();
    await expect(page.locator(".wfe-messages")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review reply", exact: true }),
    ).toHaveCount(0);
  } finally {
    release?.();
  }
  await expect(page.locator(".wfe-messages li")).toHaveCount(2);
});
test("staff options expose empty, failure, retry and mismatched revision states", async ({
  page,
}) => {
  const state = await ready(page);
  await page.getByRole("button", { name: "Change assignee", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search eligible staff", exact: true })
    .fill("No eligible colleague");
  await page.getByRole("button", { name: "Search staff", exact: true }).click();
  await expect(
    page.getByText("No eligible staff match this search.", { exact: true }),
  ).toBeVisible();
  state.candidateFailure = true;
  await page
    .getByRole("searchbox", { name: "Search eligible staff", exact: true })
    .fill("Chidi");
  await page.getByRole("button", { name: "Search staff", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry staff options", exact: true }),
  ).toBeVisible();
  state.candidateFailure = false;
  await page.getByRole("button", { name: "Retry staff options", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Chidi Eze/ })).toBeVisible();
  state.candidateMismatch = true;
  await page.getByRole("button", { name: "Search staff", exact: true }).click();
  await expect(
    page.getByText("Staff options changed. Refresh the enquiry before assigning.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});
