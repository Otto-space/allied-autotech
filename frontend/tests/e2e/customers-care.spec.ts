import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { workCustomersFixture } from "../fixtures/work-customers";
import { workThreadFixture, bookingId } from "../fixtures/work-support-detail";
import { workCustomerDetailFixture } from "../fixtures/work-customer-detail";
import { customerSupportFixture } from "../fixtures/customer-support";
import {
  workforceEnquiriesFixture,
  enquiryFixtureId,
} from "../fixtures/workforce-enquiries";
import AxeBuilder from "@axe-core/playwright";
const shots = path.join(os.tmpdir(), "allied-customers-care-20261025");
test("fixture layout evidence", async ({ page }) => {
  fs.mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await workCustomersFixture(page);
  await page.goto("/admin/customers");
  await expect(page.locator(".wc-record")).toHaveCount(25);
  await page.screenshot({
    path: path.join(
      shots,
      `${process.env.AAT_BASELINE ? "before" : "after"}-customers-1440.png`,
    ),
  });
  await workCustomerDetailFixture(page);
  await page.goto(`/admin/customers/${bookingId(30000)}`);
  await expect(
    page.getByRole("heading", { name: "Amina Okafor", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(
      shots,
      `${process.env.AAT_BASELINE ? "before" : "after"}-customer-detail.png`,
    ),
  });
  await workThreadFixture(page);
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  await expect(
    page.getByRole("heading", { name: "Engine repair follow-up", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wst-messages .support-timeline-entry")).toHaveCount(3);
  await page.screenshot({
    path: path.join(
      shots,
      `${process.env.AAT_BASELINE ? "before" : "after"}-care-1440.png`,
    ),
  });
});

for (const width of [360, 390, 768, 1024, 1440])
  test(`semantic customer table, copy and care layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await workCustomersFixture(page);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as unknown as { lastCopied: string }).lastCopied = value;
          },
        },
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/admin/customers");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(25);
    const first = page.locator("tbody tr").first();
    await first.hover();
    const before = await first.boundingBox();
    await first.getByRole("button", { name: "Copy customer email", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(first.getByRole("status").filter({ hasText: "Copied" })).toHaveText(
      "Copied",
    );
    expect(
      await page.evaluate(() => (window as unknown as { lastCopied: string }).lastCopied),
    ).toBe("directory-0@example.test");
    expect(new URL(page.url()).pathname).toBe("/admin/customers");
    expect((await first.boundingBox())!.width).toBe(before!.width);
    await page.screenshot({ path: path.join(shots, `customers-${width}.png`) });
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth,
      scrollX,
      document: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll("body *")]
        .filter((el) => {
          if (
            el.getBoundingClientRect().right <= innerWidth + 1 ||
            getComputedStyle(el).clipPath !== "none"
          )
            return false;
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (
              ["auto", "scroll", "hidden", "clip"].includes(
                getComputedStyle(parent).overflowX,
              )
            )
              return false;
            parent = parent.parentElement;
          }
          return true;
        })
        .slice(0, 12)
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          x: el.getBoundingClientRect().x,
          right: el.getBoundingClientRect().right,
          position: getComputedStyle(el).position,
        })),
      parts: [
        ...document.querySelectorAll(
          ".dashboard-content,.work-customers,.wc-records,.wi-filters,.wc-filter-grid,.wi-header,.wi-band,.wi-pagination",
        ),
      ].map((el) => ({
        class: el.className,
        width: el.getBoundingClientRect().width,
        scroll: el.scrollWidth,
        min: getComputedStyle(el).minWidth,
        display: getComputedStyle(el).display,
      })),
    }));
    expect(bounds.document, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.viewport);
    await workThreadFixture(page);
    await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
    await expect(page.locator(".wst-messages .support-timeline-entry")).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: "Write a reply / internal note" }),
    ).toBeVisible();
    await expect(
      page.getByText("Case details, workflow and technical references", { exact: true }),
    ).toBeVisible();
    const reply = await page.locator("#conversation-reply").boundingBox(),
      technical = await page.locator(".care-secondary").first().boundingBox();
    expect(reply!.y).toBeLessThan(technical!.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: path.join(shots, `care-${width}.png`) });
    expect(errors).toEqual([]);
    if (width === 1440) {
      const result = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    }
  });

test("clipboard rejection keeps manual selection and never reports success", async ({
  page,
}) => {
  await workCustomersFixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("Blocked fixture");
        },
      },
    }),
  );
  await page.goto("/admin/customers");
  const row = page.locator("tbody tr").first();
  await row.hover();
  await row.getByRole("button", { name: "Copy customer email" }).click();
  await expect(
    row.getByRole("status").filter({ hasText: "Copy unavailable" }),
  ).toContainText("Copy unavailable");
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(
    "directory-0@example.test",
  );
  expect(new URL(page.url()).pathname).toBe("/admin/customers");
});

for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reviews authoritative suspension/reactivation without row navigation`, async ({
    page,
  }) => {
    const f = await workCustomersFixture(page, role);
    let writes = 0;
    await page.route("**/api/v1/auth/csrf", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic care response",
          meta: { requestId: "care-fixture" },
          data: { csrfToken: "fixture-token-".repeat(6) },
        },
      }),
    );
    await page.route("**/api/v1/admin/customers/*/account-status", async (route) => {
      writes++;
      const body = route.request().postDataJSON();
      expect(body.reason).toBe("Reviewed synthetic account reason");
      expect(body.status).not.toBe(body.expectedStatus);
      f.customers.records[0].status = body.status;
      await route.fulfill({
        json: {
          success: true,
          message: "Synthetic care response",
          meta: { requestId: "care-fixture" },
          data: {
            customerId: f.customers.records[0].id,
            status: body.status,
            revokedSessions: 1,
          },
        },
      });
    });
    await page.goto("/admin/customers");
    let first = page.locator("tbody tr").first();
    await first.getByText("Account", { exact: true }).click();
    await first.getByRole("button", { name: /Suspend account/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("financial obligations are preserved");
    expect(writes).toBe(0);
    await dialog
      .getByLabel("Reason (required)")
      .fill("Reviewed synthetic account reason");
    await dialog.getByRole("button", { name: "Suspend account", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    first = page.locator("tbody tr").first();
    await expect(first).toContainText("Suspended");
    expect(writes).toBe(1);
    await first.getByText("Account", { exact: true }).click();
    await first.getByRole("button", { name: /Reactivate account/ }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Reason (required)")
      .fill("Reviewed synthetic account reason");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reactivate account", exact: true })
      .click();
    await expect(first).toContainText("Active");
    expect(writes).toBe(2);
    expect(new URL(page.url()).pathname).toBe("/admin/customers");
  });

test("directory filters and paging survive explicit detail return and reload", async ({
  page,
}) => {
  await workCustomersFixture(page);
  await page.goto("/admin/customers?sort=oldest");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const query = new URL(page.url()).search;
  await page
    .locator("tbody tr")
    .first()
    .getByRole("link", { name: /View details/ })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Synthetic Customer",
  );
  await page.getByRole("link", { name: "Back to customers", exact: true }).click();
  await expect.poll(() => new URL(page.url()).search).toBe(query);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});

const emailNotice = (n = 1) => ({
  id: bookingId(99000 + n),
  status: "FAILED",
  reason: "RETRY_EXHAUSTED",
  createdAt: "2026-10-25T09:00:00Z",
  sentAt: null,
  attempts: 3,
  nextRetryAt: null,
  providerStatus: null,
  providerUpdatedAt: null,
  noticeEligible: true,
  noticeDismissed: false,
  noticeRevision: "a".repeat(64),
});
test("persistent delivery dismissal retains failure indicators and resurfaces changed revision", async ({
  page,
}) => {
  await workThreadFixture(page);
  let items = [emailNotice(), emailNotice(2)];
  let reject = false;
  await page.route(
    "**/api/v1/staff/support/complaints/*/email-deliveries**",
    async (route) => {
      if (route.request().method() === "POST") {
        if (reject)
          return route.fulfill({
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          });
        const body = route.request().postDataJSON();
        items = items.map((item) => ({
          ...item,
          noticeDismissed:
            body.notices.some(
              (n: { id: string; revision: string }) =>
                n.id === item.id && n.revision === item.noticeRevision,
            ) || item.noticeDismissed,
        }));
      }
      await route.fulfill({
        json: {
          success: true,
          message: "Synthetic care response",
          meta: { requestId: "care-fixture" },
          data: { items },
        },
      });
    },
  );
  await page.goto(`/admin/support/complaints/${bookingId(60000)}`);
  const notices = page.getByLabel("Visible delivery notices");
  await expect(notices).toContainText("2 email updates");
  await notices.getByRole("button", { name: "Dismiss visible delivery notices" }).click();
  await expect(notices).toHaveCount(0);
  await expect(page.getByText("2 failed email updates", { exact: true })).toBeVisible();
  await page.reload();
  await expect(notices).toHaveCount(0);
  await page.getByText(/Email delivery history \(/).click();
  await expect(page.locator(".support-delivery-list li")).toHaveCount(2);
  items[0] = {
    ...items[0],
    attempts: 4,
    noticeRevision: "b".repeat(64),
    noticeDismissed: false,
  };
  await page.getByRole("button", { name: "Refresh email delivery", exact: true }).click();
  await expect(notices).toBeVisible();
  reject = true;
  await notices.getByRole("button", { name: /Dismiss delivery notice/ }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Delivery notices could not be confirmed" }),
  ).toContainText("could not be confirmed");
  await expect(notices).toBeVisible();
});

test("customer creation is focused, drafts survive close/reopen, and staff metadata stays out", async ({
  page,
}) => {
  const state = await customerSupportFixture(page);
  await page.goto("/dashboard/support");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Enquiry type")).not.toBeVisible();
  await page.getByText("New enquiry", { exact: true }).click();
  await page.getByLabel("Subject", { exact: true }).fill("Retained synthetic enquiry");
  await page.getByText("New enquiry", { exact: true }).click();
  await page.getByText("New enquiry", { exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Retained synthetic enquiry",
  );
  await page.getByLabel("Subject", { exact: true }).press("Enter");
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Record category").selectOption("complaints");
  await page.getByText("Make a complaint", { exact: true }).click();
  await page.getByLabel("Subject", { exact: true }).fill("Separate complaint draft");
  await page.reload();
  await page.getByText("New enquiry", { exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Retained synthetic enquiry",
  );
  await page.getByLabel("Record category").selectOption("complaints");
  await page.getByText("Make a complaint", { exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Separate complaint draft",
  );
  expect(state.writes).toHaveLength(0);
  await page.screenshot({ path: path.join(shots, "customer-care-create.png") });
});

test("managed Customer Service keeps scoped conversation and next action ahead of delivery history", async ({
  page,
}) => {
  const state = await workforceEnquiriesFixture(page, "CUSTOMER_SERVICE");
  state.emailDeliveries.items = [emailNotice() as never];
  await page.goto("/admin/workforce/enquiries?selected=" + enquiryFixtureId(1));
  await expect(
    page.getByRole("heading", { name: "Toyota Corolla inspection", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Write a reply", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review reply", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Suspend account/ })).toHaveCount(0);
  await expect(page.getByText("Synthetic customer", { exact: true })).toBeVisible();
  const notice = page.getByLabel("Visible delivery notices");
  await notice.getByRole("button", { name: /Dismiss delivery notice/ }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Toyota Corolla inspection", exact: true }),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
  await expect(page.getByText("1 failed email update", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(shots, "managed-care.png") });
});

test("short desktop, long contacts and 200 percent reflow emulation retain table containment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const state = await workCustomersFixture(page);
  state.customers.records[0].firstName =
    "Synthetic long customer name with several family names";
  state.customers.records[0].email = "long.".repeat(20) + "customer@example.test";
  state.customers.records[0].phone = "";
  await page.goto("/admin/customers");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await page.screenshot({ path: path.join(shots, "customers-1366-long.png") });
  const desktop = await page.locator(".wc-filter-grid").evaluate((el) => ({
    columns: getComputedStyle(el).gridTemplateColumns,
    height: el.getBoundingClientRect().height,
  }));
  expect(
    (await page.locator("tbody tr").nth(2).boundingBox())!.y,
    JSON.stringify(desktop),
  ).toBeLessThan(768);
  await expect(page.locator("tbody tr").first()).toContainText("Not provided");
  const tones = await page.locator("tbody tr [data-status]").evaluateAll((nodes) =>
    nodes.slice(0, 3).map((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor];
    }),
  );
  const lum = (rgb: string) => {
    const values = rgb
      .match(/\d+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  for (const [ink, fill] of tones)
    expect(
      (Math.max(lum(ink), lum(fill)) + 0.05) / (Math.min(lum(ink), lum(fill)) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: path.join(shots, "customers-1366-long.png") });
  // Desktop browser zoom halves the CSS viewport and doubles raster scale.
  // CSS zoom alone retains desktop media queries and is not that reflow model.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 683,
    height: 384,
    deviceScaleFactor: 2,
    mobile: false,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole("region", { name: "Customer results" }).focus();
  await expect(page.getByRole("region", { name: "Customer results" })).toBeFocused();
});

test.describe("touch copy discoverability", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("copy and account controls are available without hovering", async ({ page }) => {
    await workCustomersFixture(page);
    await page.goto("/admin/customers");
    const first = page.locator("tbody tr").first();
    const copy = first.getByRole("button", { name: "Copy customer email" });
    await expect(copy).toHaveCSS("opacity", "1");
    await first.getByText("Account", { exact: true }).tap();
    await expect(first.getByRole("button", { name: /Suspend account/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      first.getByRole("button", { name: /Suspend account/ }),
    ).not.toBeVisible();
  });
});
