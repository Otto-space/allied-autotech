import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workThreadFixture,
  threadMessage,
  bookingId,
} from "../fixtures/work-support-detail";
const btn = (p: Page, name: string) =>
    p.getByRole("button", {
      name:
        name === "Review support change"
          ? /^Review (status|assignment|priority) change$/
          : name,
      exact: true,
    }),
  confirm = (p: Page) =>
    p.getByRole("dialog").getByRole("button", {
      name: /^(Confirm (status|assignment|priority) change|Send reply|Save internal note)$/,
    }),
  messages = (p: Page) => p.locator(".wst-messages .support-timeline-entry");
async function open(p: Page, kind = "complaints", q = "") {
  await p.goto(
    `/admin/support/${kind}/${bookingId(kind === "complaints" ? 60000 : 50000)}${q}`,
  );
  await expect(
    p.getByRole("heading", {
      name:
        kind === "complaints" ? "Engine repair follow-up" : "Service estimate request",
      exact: true,
    }),
  ).toBeVisible();
  await expect(messages(p)).toHaveCount(3);
}
async function reviewReply(p: Page, visibility = "CUSTOMER") {
  await p
    .getByRole("radio", {
      name: visibility === "INTERNAL" ? "Internal staff note" : "Customer-visible reply",
      exact: true,
    })
    .check();
  await p
    .getByLabel("Reply text", { exact: true })
    .fill("Reviewed conversation response\nSecond line");
  await btn(
    p,
    visibility === "INTERNAL" ? "Review internal note" : "Review reply",
  ).click();
  await expect(p.getByRole("dialog")).toContainText("Reviewed conversation response");
}
for (const role of ["ADMIN", "SUPER_ADMIN", "STAFF"])
  test(`${role} reads complete scoped facts and dedicated visible/internal history`, async ({
    page,
  }) => {
    await workThreadFixture(page, role);
    await open(page);
    await expect(page.locator("#conversation-details")).toContainText(bookingId(60000));
    await expect(page.locator("#conversation-details")).toContainText("Amina Okafor");
    await expect(page.locator("#conversation-details")).toContainText("10:00:00.123");
    await expect(page.locator("#conversation-details")).toContainText("Ada Okoro");
    await expect(messages(page).nth(1)).toContainText("Internal note");
    await expect(page.getByRole("main")).not.toContainText("Embedded private fields");
  });
test("own-profile gate prevents premature private reads and recovers", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  f.state.profileMode = "hold";
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  await expect(
    page.getByText("Checking conversation access…", { exact: true }),
  ).toBeVisible();
  expect(f.detail.reads).toBe(0);
  expect(f.detail.messageReads).toHaveLength(0);
  f.state.profileMode = "error";
  f.state.held?.();
  await expect(btn(page, "Retry conversation access")).toBeVisible();
  f.state.profileMode = "normal";
  await btn(page, "Retry conversation access").click();
  await expect(messages(page)).toHaveCount(3);
});
for (const mode of ["malformed", "mismatch", "denied", "missing"])
  test(`${mode} detail reveals no contacts or messages`, async ({ page }) => {
    const f = await workThreadFixture(page);
    f.detail.mode = mode;
    await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
    await expect(btn(page, "Retry conversation")).toBeVisible();
    await expect(page.locator("#conversation-details")).toHaveCount(0);
    expect(f.detail.messageReads).toHaveLength(0);
  });
test("foreign Staff record is rejected before history reads", async ({ page }) => {
  const f = await workThreadFixture(page, "STAFF");
  f.detail.record.branchId = bookingId(102);
  f.detail.record.branch!.id = bookingId(102);
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  await expect(btn(page, "Retry conversation")).toBeVisible();
  await expect(page.locator("#conversation-details")).toHaveCount(0);
  expect(f.detail.messageReads).toHaveLength(0);
});
test("50+3 oldest-first message pages survive reload and Back", async ({ page }) => {
  const f = await workThreadFixture(page);
  f.detail.messages = Array.from({ length: 53 }, (_, n) => threadMessage(n));
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  await expect(messages(page)).toHaveCount(50);
  const nav = page.getByRole("navigation", {
    name: "Conversation messages pages",
    exact: true,
  });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(messages(page)).toHaveCount(3);
  await expect(page).toHaveURL(/cursor=/);
  await page.reload();
  await expect(messages(page)).toHaveCount(3);
  await nav.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(messages(page)).toHaveCount(50);
  await page.goBack();
  await expect(messages(page)).toHaveCount(3);
});
for (const q of ["?cursor=bad", "?search=reply", "?cursor=x&cursor=y"])
  test(`invalid message query ${q} performs no history read`, async ({ page }) => {
    const f = await workThreadFixture(page);
    await page.goto(`/admin/support/complaints/${bookingId(60000)}${q}`);
    await expect(
      page.getByRole("heading", { name: "Message filters unavailable" }),
    ).toBeVisible();
    expect(f.detail.messageReads).toHaveLength(0);
    await expect(btn(page, "Review reply")).toBeDisabled();
    await btn(page, "Reset message filters").click();
    await expect(messages(page)).toHaveCount(3);
  });
test("review cancellation sends nothing; held internal note is single-flight and exactly confirmed", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  await reviewReply(page, "INTERNAL");
  await expect(page.getByRole("dialog")).toContainText("Staff only");
  await btn(page, "Go back").click();
  expect(f.detail.writes).toHaveLength(0);
  await btn(page, "Review internal note").click();
  f.detail.writeMode = "hold";
  await confirm(page).click();
  await expect(btn(page, "Submitting…")).toBeDisabled();
  await expect.poll(() => f.detail.writes.length).toBe(1);
  await expect(page.getByLabel("Action", { exact: true })).toBeDisabled();
  f.detail.writeMode = "normal";
  f.detail.held?.();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".wst-confirmed")).toContainText("Internal note");
  await expect(page.locator(".wst-confirmed")).toContainText(
    "Reviewed conversation response",
  );
  expect(f.detail.record.version).toBe(3);
  expect(f.detail.writes[0].body).toEqual({
    message: "Reviewed conversation response\nSecond line",
    visibility: "INTERNAL",
  });
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue("");
});
test("management writes exact independent versions and full reviewed resolution", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  await page.getByLabel("Action", { exact: true }).selectOption("priority");
  await page.getByLabel("New priority", { exact: true }).selectOption("URGENT");
  await btn(page, "Review support change").click();
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes[0].body).toEqual({ expectedVersion: 3, priority: "URGENT" });
  await page.getByLabel("New status", { exact: true }).selectOption("RESOLVED");
  await page
    .getByLabel("Status update explanation", { exact: true })
    .fill("Exact reviewed complaint resolution");
  await btn(page, "Review support change").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Exact reviewed complaint resolution",
  );
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.detail.writes[1].body).toEqual({
    expectedVersion: 4,
    status: "RESOLVED",
    resolution: "Exact reviewed complaint resolution",
  });
  await expect(page.locator("#conversation-details")).toContainText(
    "Exact reviewed complaint resolution",
  );
  await expect(page.locator(".wst-confirmed")).toContainText(
    "Exact reviewed complaint resolution",
  );
});
test("changed management version preserves unsaved fields until explicit reload", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  await page
    .getByLabel("Status update explanation", { exact: true })
    .fill("Kept management draft");
  f.detail.record.version++;
  await btn(page, "Refresh conversation").click();
  await expect(btn(page, "Reload management fields")).toBeVisible();
  await expect(page.getByLabel("Status update explanation", { exact: true })).toHaveValue(
    "Kept management draft",
  );
  await expect(btn(page, "Review support change")).toBeDisabled();
  await btn(page, "Reload management fields").click();
  await expect(page.getByLabel("Status update explanation", { exact: true })).toHaveValue(
    "",
  );
  expect(f.detail.writes).toHaveLength(0);
});
test("fresh closure preflight blocks a reviewed reply without sending", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  await reviewReply(page);
  f.detail.record.status = "CLOSED";
  f.detail.record.version++;
  f.detail.record.closedAt = "2026-10-18T10:00:37.123Z";
  await confirm(page).click();
  await expect(page.getByRole("dialog")).toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(
    page.getByText("This record is closed. The reply form is unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(btn(page, "Review acknowledgement")).toHaveCount(0);
  expect(f.detail.writes).toHaveLength(0);
});
for (const race of [false, true])
  test(`acknowledgement ${race ? "race keeps existing response" : "saves exact first response"}`, async ({
    page,
  }) => {
    const f = await workThreadFixture(page);
    f.detail.ackRace = race;
    await open(page);
    await page
      .getByLabel("Acknowledgement response", { exact: true })
      .fill("Reviewed acknowledgement with full customer-visible text");
    await btn(page, "Review acknowledgement").click();
    await expect(page.getByRole("dialog")).toContainText(
      "Reviewed acknowledgement with full customer-visible text",
    );
    await btn(page, "Record acknowledgement").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(btn(page, "Review acknowledgement")).toHaveCount(0);
    expect(f.detail.record.version).toBe(3);
    if (race) {
      await expect(
        page.getByText(
          "This complaint was already acknowledged. Your response was not added.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.locator(".wst-confirmed")).toHaveCount(0);
    } else
      await expect(page.locator(".wst-confirmed")).toContainText(
        "Reviewed acknowledgement with full customer-visible text",
      );
  });
for (const mode of ["lost", "malformed", "wrong-thread", "wrong-body", "throttle"])
  test(`${mode} reply remains locked across reload; explicit current read never replays`, async ({
    page,
  }) => {
    const f = await workThreadFixture(page);
    f.detail.writeMode = mode;
    await open(page);
    await reviewReply(page);
    await confirm(page).click();
    await expect(btn(page, "Close & review record")).toBeVisible();
    await btn(page, "Close & review record").click();
    await expect(btn(page, "Load current conversation")).toBeVisible();
    await expect(btn(page, "Review reply")).toBeDisabled();
    const markers = await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:staff-conversation:v1:"),
      ),
    );
    expect(markers).toHaveLength(1);
    expect(markers[0][1]).not.toContain("Reviewed conversation");
    await page.reload();
    await expect(btn(page, "Load current conversation")).toBeVisible();
    await btn(page, "Load current conversation").click();
    await expect(btn(page, "Load current conversation")).toHaveCount(0);
    await expect(
      page.getByText("Current conversation and message page loaded.", { exact: false }),
    ).toContainText("previous request outcome is not proven");
    await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue("");
    expect(f.detail.writes).toHaveLength(1);
  });
test("denied reconciliation clears protected facts and retains the no-replay lock", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  f.detail.writeMode = "lost";
  await open(page);
  await reviewReply(page);
  await confirm(page).click();
  await btn(page, "Close & review record").click();
  f.detail.mode = "denied";
  await btn(page, "Load current conversation").click();
  await expect(page.locator("#conversation-details")).toHaveCount(0);
  await expect(messages(page)).toHaveCount(0);
  await expect(btn(page, "Load current conversation")).toBeVisible();
  expect(f.detail.writes).toHaveLength(1);
});

test("definite API rejection preserves draft and differs from an unsent preflight", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  f.detail.writeMode = "reject";
  await open(page);
  await reviewReply(page);
  await confirm(page).click();
  await expect(btn(page, "Go back")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("No change was sent");
  await btn(page, "Go back").click();
  await expect(btn(page, "Load current conversation")).toHaveCount(0);
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
    "Reviewed conversation response\nSecond line",
  );
  expect(f.detail.writes).toHaveLength(1);
});
test("summary outage keeps labelled facts read-only and denial clears history", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  f.detail.mode = "error";
  await btn(page, "Refresh conversation").click();
  await expect(btn(page, "Retry conversation")).toBeVisible();
  await page.getByRole("link", { name: "Details", exact: true }).click();
  await expect(page.locator("#conversation-details")).toBeVisible();
  await expect(btn(page, "Review support change")).toBeDisabled();
  f.detail.mode = "denied";
  await btn(page, "Retry conversation").click();
  await expect(page.locator("#conversation-details")).toHaveCount(0);
  await expect(messages(page)).toHaveCount(0);
});
test("message outage keeps labelled history; denied history removes the whole private conversation", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  await open(page);
  f.detail.messagesMode = "error";
  await btn(page, "Refresh messages").click();
  await expect(btn(page, "Retry messages")).toBeVisible();
  await expect(messages(page)).toHaveCount(3);
  await expect(btn(page, "Review reply")).toBeDisabled();
  f.detail.messagesMode = "denied";
  await btn(page, "Retry messages").click();
  await expect(page.locator("#conversation-details")).toHaveCount(0);
  await expect(messages(page)).toHaveCount(0);
  f.detail.messagesMode = "normal";
  await btn(page, "Retry conversation").click();
  await expect(messages(page)).toHaveCount(3);
});
test("seven responsive widths, long original text and full review pass accessibility", async ({
  page,
}) => {
  const f = await workThreadFixture(page);
  f.detail.record.description = "D".repeat(4000);
  f.detail.record.email = "e".repeat(100) + "@example.test";
  await open(page);
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual(
      [],
    );
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await reviewReply(page, "INTERNAL");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
