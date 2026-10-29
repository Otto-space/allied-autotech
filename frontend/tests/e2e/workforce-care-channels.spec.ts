import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import {
  workforceEnquiriesFixture,
  enquiryFixtureId,
} from "../fixtures/workforce-enquiries";
import {
  workforceComplaintsFixture,
  complaintFixtureId,
} from "../fixtures/workforce-complaints";
import { supportChannelFixture } from "../fixtures/support-channel";
import { careCasesFixture } from "../fixtures/workforce-care-cases";
import { verifyConsole } from "../fixtures/preview-console";

async function checkChannelConsole(
  page: Page,
  errors: string[],
  warnings: string[],
  kind: "enquiries" | "complaints",
) {
  const remaining: string[] = [];
  for (const warning of warnings) {
    const match =
      /^The resource (http:\/\/[^ ]+) was preloaded using link preload but not used/.exec(
        warning,
      );
    const url = match ? new URL(match[1]) : null;
    if (
      url?.origin === new URL(page.url()).origin &&
      decodeURIComponent(url.pathname) ===
        "/_next/static/css/app/admin/workforce/[[...section]]/page.css" &&
      /^\?v=\d+$/.test(url.search)
    ) {
      // Dev query navigation can leave a second timestamped preload unused. Prove
      // the actual sheet is available and the matching workspace styling is applied.
      const response = await page.request.get(url.href);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain(`.workforce-${kind}`);
      const prefix = kind === "enquiries" ? "wfe" : "wfc";
      await expect(page.locator(`.${prefix}-results`)).toHaveCSS(
        "border-top-width",
        "1px",
      );
      await expect(page.locator(`.${prefix}-results`)).toHaveCSS("border-radius", "6px");
      test.info().annotations.push({
        type: "verified-dev-preload-warning",
        description: `${url.pathname}: response and workspace computed styles verified. Exact-lock/production warning acceptance remains separate.`,
      });
    } else remaining.push(warning);
  }
  await verifyConsole(page, errors, remaining);
}

// Isolated API interception only; never sends real support replies or availability.
for (const kind of ["enquiries", "complaints"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`managed ${kind} channel review, draft and public update at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      const warnings: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
        if (message.type() === "warning") warnings.push(message.text());
      });
      await page.setViewportSize({ width, height: 950 });
      const role = width === 390 ? "STAFF" : "ADMIN";
      const fixture =
        width === 768
          ? (
              await careCasesFixture(
                page,
                kind,
                ["CARE_VIEWER", "CARE_RESPONDER", "CARE_LIVE_AGENT"],
                "ADMIN",
              )
            ).f
          : kind === "enquiries"
            ? await workforceEnquiriesFixture(page, "CUSTOMER_SERVICE", role)
            : await workforceComplaintsFixture(page, role);
      fixture.customerId = enquiryFixtureId(900);
      const row = fixture.items[0];
      if (width === 768)
        Object.assign(row, {
          contact: {
            name: "Synthetic customer",
            email: "care-fixture@example.test",
            phone: null,
            customerId: fixture.customerId,
          },
        });
      const channel = await supportChannelFixture(page, {
        id: row.id,
        branchId: row.branchId,
        staff: true,
        kind: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
      });
      channel.caseVersion = row.version;
      const root = `/admin/workforce/${kind}`;
      await page.goto(`${root}?selected=${row.id}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/admin/workforce/${kind}\\?selected=`));
      await expect(
        page.getByRole("heading", {
          name: kind === "enquiries" ? "Enquiries" : "Complaints",
          exact: true,
          level: 1,
        }),
      ).toBeVisible({ timeout: 45_000 });
      const prefix = kind === "enquiries" ? "wfe" : "wfc";
      const table = page.locator(`.${prefix}-results table`);
      const headings =
        kind === "enquiries"
          ? ["Subject", "Customer", "Type", "Branch", "Assigned to", "Status", "Open"]
          : ["Complaint", "Customer", "Priority", "Branch", "Status", "Open"];
      await expect(table.locator("thead th")).toHaveText(headings);
      for (const rowElement of await table.locator("tbody tr").all())
        await expect(rowElement.locator(":scope > th, :scope > td")).toHaveCount(
          headings.length,
        );
      const composer = page.getByRole("textbox", { name: "Message", exact: true });
      await expect(composer).toBeEditable();
      await composer.fill("My retained unsent response");
      await page
        .getByText("Conversation queue and your availability", { exact: true })
        .click();
      const queue = page
        .getByRole("heading", { name: "Conversations in Customer Care" })
        .locator("..");
      await expect(queue.getByRole("link")).toHaveAttribute(
        "href",
        `${root}?selected=${row.id}`,
      );
      await page.getByRole("button", { name: "Join conversation", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText(
        "Customer-visible system update",
      );
      expect(channel.writes).toHaveLength(0);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect.poll(() => channel.writes.length).toBe(1);
      expect(channel.writes[0].body).toMatchObject({
        action: "claim",
        expectedVersion: 1,
      });
      expect(channel.writes[0].csrf).toBeTruthy();
      await expect(composer).toHaveValue("My retained unsent response");
      const latest =
        kind === "enquiries" ? enquiryFixtureId(901) : complaintFixtureId(901);
      fixture.messages.push({
        id: latest,
        authorType: "CUSTOMER",
        visibility: "CUSTOMER",
        body: "Synthetic new public message",
        createdAt: "2026-10-28T13:00:00.000Z",
        isOwn: false,
      });
      row.version = channel.caseVersion + 1;
      channel.caseVersion = row.version;
      channel.latest = latest;
      await composer.focus();
      await expect(
        page.getByRole("button", { name: "View latest update", exact: true }),
      ).toBeVisible();
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue("My retained unsent response");
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "View latest update", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`messageId=${latest}`));
      await expect(
        page.getByText("Synthetic new public message", { exact: true }),
      ).toBeVisible();
      expect(fixture.writes).toHaveLength(0);
      expect(fixture.base.notifications.writes).toHaveLength(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(errors).toEqual([]);
      await checkChannelConsole(page, errors, warnings, kind);
      await expect(page.locator("nextjs-portal nextjs-dialog")).toHaveCount(0);
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-w16d-${kind}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

for (const kind of ["enquiries", "complaints"] as const) {
  test(`managed ${kind} view-only Care keeps the channel queue without reply or live authority`, async ({
    page,
  }) => {
    const fixture = await careCasesFixture(page, kind, ["CARE_VIEWER"], "STAFF");
    Object.assign(fixture.row, {
      contact: {
        name: "Synthetic customer",
        email: "care@example.test",
        phone: null,
        customerId: enquiryFixtureId(900),
      },
    });
    fixture.f.customerId = enquiryFixtureId(900);
    const channel = await supportChannelFixture(page, {
      id: fixture.row.id,
      branchId: fixture.row.branchId,
      staff: true,
      kind: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
    });
    channel.caseVersion = fixture.row.version;
    Object.assign(channel.channel!, {
      canClaim: false,
      canTransfer: false,
      canEnd: false,
    });
    channel.presence.enabled = false;
    await page.setViewportSize({ width: 390, height: 950 });
    await page.goto(`/admin/workforce/${kind}?selected=${fixture.row.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: fixture.row.subject, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Queued", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Join conversation", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "End conversation", exact: true }),
    ).toHaveCount(0);
    await page
      .getByText("Conversation queue and your availability", { exact: true })
      .click();
    await expect(
      page
        .locator("#care-conversation-workspace")
        .getByRole("link", { name: /Enquiry|Complaint/ }),
    ).toHaveAttribute("href", `/admin/workforce/${kind}?selected=${fixture.row.id}`);
    expect(channel.writes).toHaveLength(0);
    expect(fixture.writes).toHaveLength(0);
    expect(fixture.f.writes).toHaveLength(0);
  });
}
