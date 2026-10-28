import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerSupportFixture } from "../fixtures/customer-support";
import { workThreadFixture, threadMessage } from "../fixtures/work-support-detail";
import { workSupportFixture } from "../fixtures/work-support";
import { supportChannelFixture } from "../fixtures/support-channel";
import path from "node:path";
import os from "node:os";

const screenshotRoot = path.join(os.tmpdir(), "allied-w16-care-ui-20261028");
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("channelRuntimeErrors", () => errors);
});
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { channelRuntimeErrors: () => Promise<string[]> }
        ).channelRuntimeErrors(),
      ),
    ).toEqual([]);
    await expect(page.locator("nextjs-portal nextjs-dialog")).toHaveCount(0);
  }
});
for (const kind of ["enquiries", "complaints"] as const) {
  test(`customer ${kind} requests the existing case channel through review`, async ({
    page,
  }) => {
    const width = kind === "enquiries" ? 390 : 1024;
    await page.setViewportSize({ width, height: 950 });
    const fixture = await customerSupportFixture(page),
      record = fixture.records[kind];
    const channel = await supportChannelFixture(page, {
      id: record.id,
      branchId: record.branchId,
      kind: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
    });
    await page.goto(`/dashboard/support/${kind}/${record.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Request a conversation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Your request is saved in this case",
    );
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeFocused();
    expect(channel.writes).toHaveLength(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Queued", { exact: true })).toBeVisible();
    expect(channel.writes).toHaveLength(1);
    expect(channel.writes[0].body).toEqual({
      target: { kind: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT", id: record.id },
      expectedCaseVersion: 0,
      expectedChannelVersion: 0,
    });
    expect(channel.writes[0].csrf).toBeTruthy();
    expect(channel.writes[0].key).toMatch(/^support-reply-v1\./);
    expect(fixture.writes).toHaveLength(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(screenshotRoot, `care-customer-${width}.png`),
      fullPage: true,
    });
  });
}
test("lost committed response survives reload and recovers without another submission", async ({
  page,
}) => {
  const fixture = await customerSupportFixture(page),
    record = fixture.records.enquiries;
  const channel = await supportChannelFixture(page, {
    id: record.id,
    branchId: record.branchId,
  });
  channel.mode = "lost";
  await page.goto(`/dashboard/support/enquiries/${record.id}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Request a conversation", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check saved action", exact: true }),
  ).toBeFocused();
  const marker = await page.evaluate(() =>
    Object.entries(sessionStorage).find(([key]) =>
      key.startsWith("aat:care-channel:v1:"),
    ),
  );
  expect(marker).toBeTruthy();
  expect(marker![1]).not.toContain(record.id);
  expect(Object.keys(JSON.parse(marker![1])).sort()).toEqual(["action", "operationKey"]);
  await page.reload();
  await page.getByRole("button", { name: "Check saved action", exact: true }).click();
  await expect(
    page.getByText(
      "The original action was saved. Current case state has been refreshed.",
    ),
  ).toBeVisible();
  expect(channel.writes).toHaveLength(1);
});
test("unsaved unknown action can be durably stopped without losing a reply draft", async ({
  page,
}) => {
  const fixture = await customerSupportFixture(page),
    record = fixture.records.enquiries;
  const channel = await supportChannelFixture(page, {
    id: record.id,
    branchId: record.branchId,
  });
  channel.mode = "unsaved";
  await page.goto(`/dashboard/support/enquiries/${record.id}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByLabel("Reply text", { exact: true })
    .fill("Keep this ordinary Care draft");
  await page.getByRole("button", { name: "Request a conversation", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page.getByRole("button", { name: "Check saved action", exact: true }).click();
  await expect(page.getByText(/No saved outcome was found/)).toBeVisible();
  await page.getByRole("button", { name: "Review stopping action", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByText(/The unsaved action was stopped/)).toBeVisible();
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
    "Keep this ordinary Care draft",
  );
  expect(channel.writes.map((write) => write.method)).toEqual(["POST", "DELETE"]);
});
for (const onCurrentPage of [false, true])
  test(`new public update ${onCurrentPage ? "already loaded" : "on another page"} offers an explicit jump while preserving position, drafts and unread state`, async ({
    page,
  }) => {
    const fixture = await customerSupportFixture(page),
      record = fixture.records.enquiries;
    const channel = await supportChannelFixture(page, {
      id: record.id,
      branchId: record.branchId,
    });
    await page.goto(`/dashboard/support/enquiries/${record.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("button", { name: "Request a conversation", exact: true }),
    ).toBeEnabled();
    await page
      .getByLabel("Reply text", { exact: true })
      .fill("Preserve my draft while checking updates");
    const message = {
      ...fixture.messages[0],
      id: "f1600000-0000-4000-8000-000000000010",
      body: "New public Care update",
    };
    // Keep the current message page unchanged until the reader chooses the anchor.
    await page.route(
      `**/api/v1/customers/support/enquiries/${record.id}/messages?**`,
      (route) => {
        const anchored = new URL(route.request().url()).searchParams.has("messageId");
        return route.fulfill({
          json: {
            success: true,
            message: "Isolated public message page",
            meta: { requestId: "channel-public-anchor" },
            data: {
              items: anchored || onCurrentPage ? [message] : fixture.messages,
              hasMore: false,
              cursor: anchored || onCurrentPage ? message.id : fixture.messages[0].id,
              pollAfterMs: 5000,
            },
          },
        });
      },
    );
    await page.getByLabel("Reply text", { exact: true }).focus();
    channel.latest = message.id;
    channel.caseVersion++;
    if (onCurrentPage)
      await expect(
        page.getByText("New public Care update", { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View latest update", exact: true }),
    ).toBeVisible();
    if (!onCurrentPage)
      await expect(page.getByText("New public Care update", { exact: true })).toHaveCount(
        0,
      );
    await expect(page.getByLabel("Reply text", { exact: true })).toBeFocused();
    await page.getByRole("button", { name: "View latest update", exact: true }).click();
    await expect(page.getByText("New public Care update", { exact: true })).toBeVisible();
    await expect(page.locator(`#support-entry-${message.id}`)).toBeFocused();
    await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
      "Preserve my draft while checking updates",
    );
    expect(fixture.writes).toHaveLength(0);
    expect(channel.writes).toHaveLength(0);
  });
test("staff public-update notice survives an appended current page and preserves the reply draft", async ({
  page,
}) => {
  const f = await workThreadFixture(page, "ADMIN");
  const c = await supportChannelFixture(page, {
    id: f.detail.record.id,
    branchId: f.detail.record.branchId,
    kind: "COMPLAINT",
    staff: true,
  });
  await page.goto(`/admin/support/complaints/${f.detail.record.id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Join conversation", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Reply text", { exact: true }).fill("Keep my staff reply draft");
  const message = { ...threadMessage(3), body: "A newly saved public follow-up" };
  f.detail.messages.push(message);
  c.latest = message.id;
  c.caseVersion++;
  await page.getByLabel("Reply text", { exact: true }).focus();
  await expect(page.getByText(message.body, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View latest update", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Reply text", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "View latest update", exact: true }).click();
  await expect(page.locator(`#support-entry-${message.id}`)).toBeFocused();
  await expect(
    page.getByRole("button", { name: "View latest update", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
    "Keep my staff reply draft",
  );
  expect(c.writes).toHaveLength(0);
  expect(f.detail.writes).toHaveLength(0);
});
for (const [role, width] of [
  ["STAFF", 360],
  ["ADMIN", 768],
  ["SUPER_ADMIN", 1440],
] as const) {
  test(`${role} joins, transfers and retains accessible existing Care at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const f = await workThreadFixture(page, role);
    const c = await supportChannelFixture(page, {
      id: f.detail.record.id,
      branchId: f.detail.record.branchId,
      kind: "COMPLAINT",
      staff: true,
    });
    await page.goto(`/admin/support/complaints/${f.detail.record.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Join conversation", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByText("Representative joined", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Transfer", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Available representative", exact: true })
      .selectOption({ label: "Approved Care representative" });
    await page
      .getByLabel("Reason · staff audit only", { exact: true })
      .fill("A specialist is taking over this case");
    await page.getByRole("button", { name: "Review transfer", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Internal audit reason");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Go back", exact: true })
      .click();
    expect(c.writes).toHaveLength(1);
    expect(f.detail.writes).toHaveLength(0);
    if (role === "SUPER_ADMIN") {
      await page.getByRole("button", { name: "Review transfer", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(c.writes).toHaveLength(2);
      expect(c.writes[1].body).toMatchObject({
        action: "transfer",
        reason: "A specialist is taking over this case",
      });
      await expect(page.locator(".wst-messages")).not.toContainText(
        "A specialist is taking over this case",
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: path.join(screenshotRoot, `care-${role.toLowerCase()}-${width}.png`),
      fullPage: true,
    });
  });
}
test("availability is explicit and the queue links to canonical cases", async ({
  page,
}) => {
  const fixture = await workSupportFixture(page, "ADMIN"),
    record = fixture.support.records.enquiries[0];
  const channel = await supportChannelFixture(page, {
    id: record.id,
    branchId: record.branchId,
    staff: true,
  });
  await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
  await page
    .getByText("Conversation queue and your availability", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your availability", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Enquiry ${record.id.slice(0, 8)}`, exact: true }),
  ).toHaveAttribute("href", `/admin/support/enquiries/${record.id}`);
  expect(channel.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Review availability", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Opt in for this session");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByText(/You opted in for this session/)).toBeVisible();
  await page
    .getByRole("button", { name: "Stop accepting conversations", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(page.getByText(/You are not accepting new conversations/)).toBeVisible();
  expect(channel.writes.map((write) => write.body.available)).toEqual([true, false]);
});
test("disabled live joining never advertises an online representative", async ({
  page,
}) => {
  const fixture = await workSupportFixture(page, "ADMIN"),
    record = fixture.support.records.enquiries[0];
  const channel = await supportChannelFixture(page, {
    id: record.id,
    branchId: record.branchId,
    staff: true,
  });
  channel.presence.enabled = false;
  await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
  await page
    .getByText("Conversation queue and your availability", { exact: true })
    .click();
  await expect(page.getByText(/Live joining is disabled for this release/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review availability", exact: true }),
  ).toHaveCount(0);
  expect(channel.writes).toHaveLength(0);
});
test("revoked channel access removes its actions without discarding the ordinary case draft", async ({
  page,
}) => {
  const fixture = await customerSupportFixture(page),
    record = fixture.records.enquiries;
  const channel = await supportChannelFixture(page, {
    id: record.id,
    branchId: record.branchId,
  });
  await page.goto(`/dashboard/support/enquiries/${record.id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("button", { name: "Request a conversation", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Reply text", { exact: true })
    .fill("Keep my permitted ordinary message draft");
  channel.denied = true;
  await page.getByRole("button", { name: "Refresh status", exact: true }).click();
  await expect(page.getByText("Updates paused", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request a conversation", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Reply text", { exact: true })).toHaveValue(
    "Keep my permitted ordinary message draft",
  );
  expect(channel.writes).toHaveLength(0);
});
