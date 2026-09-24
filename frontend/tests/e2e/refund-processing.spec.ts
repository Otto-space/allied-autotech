import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { ProcessingRefund } from "@/lib/api/refund-processing";
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: { success: true, data, message: "Isolated", meta: { requestId: "refund-qa" } },
  });
const refund = (): ProcessingRefund => ({
  id: id(20),
  refundNumber: "ISOLATED-REFUND-020",
  paymentAttemptId: id(30),
  paymentAttempt: { provider: "MANUAL" },
  authorizationKind: "HUMAN",
  amountKobo: "20000",
  currency: "NGN",
  status: "REQUESTED",
  requestedByUserId: id(1),
  approvedByUserId: null,
  requestedAt: "2026-09-17T09:00:00Z",
  approvedAt: null,
  updatedAt: "2026-09-17T09:00:00Z",
  processedAt: null,
  failedAt: null,
  providerStatus: null,
  failureCode: null,
  reason: "Synthetic approved return",
  dueAt: null,
  clockStatus: "NOT_STARTED",
  transferredByUserId: null,
  transferRecordedAt: null,
  bankTransferAt: null,
  checkedByUserId: null,
  checkedAt: null,
});
async function fixture(page: Page, grants: string[], row = refund()) {
  const state = {
    grants,
    row,
    fail: false,
    reads: 0,
    profiles: 0,
    writes: [] as string[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(50),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(10), email: "refunds@example.test", role: "STAFF" },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-csrf-".repeat(8) });
    if (endpoint === "/staff/profile") {
      state.profiles++;
      return reply(route, {
        id: id(10),
        email: "refunds@example.test",
        role: "STAFF",
        status: "ACTIVE",
        staffProfile: null,
        capabilities: state.grants,
      });
    }
    if (endpoint === "/staff/refunds") {
      state.reads++;
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      return reply(route, { items: [state.row] });
    }
    state.writes.push(endpoint);
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
async function open(page: Page) {
  await page.goto("/admin/refunds");
  await expect(page).toHaveTitle(/Manage refund requests/);
  await expect(
    page.getByRole("heading", { name: "Refund requests", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review refund actions" }).click();
}

test("delegated refund access and sidebar disappear together when the grant is revoked", async ({
  page,
}) => {
  const state = await fixture(page, ["REFUND_APPROVE"]);
  await open(page);
  const nav = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(
    nav.getByRole("link", { name: "Refund requests", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Refund decision", { exact: true })).toBeVisible();
  expect(state.profiles).toBe(1);
  state.grants = [];
  await page.getByRole("button", { name: "Refresh refund permissions" }).click();
  await expect(
    page.getByText(
      "An active refund approval, transfer or checking permission is required.",
    ),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Refund requests", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(state.row.refundNumber, { exact: true })).toHaveCount(0);
  expect(state.profiles).toBe(2);
  expect(state.writes).toEqual([]);
});

test("an ungranted staff member never requests either refund queue", async ({ page }) => {
  const state = await fixture(page, []);
  await page.goto("/admin/refunds");
  await expect(
    page.getByText(
      "An active refund approval, transfer or checking permission is required.",
    ),
  ).toBeVisible();
  expect(state.reads).toBe(0);
  expect(state.writes).toEqual([]);
});

test("a mismatched approval response locks writes through failed and recovered reads", async ({
  page,
}) => {
  const state = await fixture(page, ["REFUND_APPROVE"]);
  let writes = 0;
  await page.route("**/staff/refunds/*/decision", async (route) => {
    writes++;
    expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
    expect(route.request().postDataJSON()).toEqual({ decision: "APPROVED" });
    await reply(route, {
      ...state.row,
      id: id(999),
      status: "NEEDS_ATTENTION",
      approvedByUserId: id(10),
      approvedAt: "2026-09-17T10:00:00Z",
    });
  });
  await open(page);
  await page.getByLabel("Refund decision", { exact: true }).selectOption("APPROVED");
  await page.getByRole("button", { name: "Review refund decision" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  state.fail = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(page.getByRole("heading", { name: state.row.refundNumber })).toHaveCount(
    0,
  );
  state.fail = false;
  await page.getByRole("button", { name: "Refresh refund records" }).click();
  await expect(
    page.getByRole("button", { name: "Review refund decision" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});

for (const mismatch of ["record", "amount", "time", "host"])
  test(`private evidence with an unexpected ${mismatch} cannot be used for completion`, async ({
    page,
  }) => {
    const row = {
      ...refund(),
      status: "PROCESSING" as const,
      approvedByUserId: id(2),
      approvedAt: "2026-09-17T09:30:00Z",
      transferredByUserId: id(3),
      bankTransferAt: "2026-09-17T10:00:00Z",
    };
    const state = await fixture(page, ["REFUND_CHECK"], row);
    let access = 0;
    await page.route("**/staff/refunds/*/evidence-access", async (route) => {
      access++;
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      await reply(route, {
        id: mismatch === "record" ? id(99) : row.id,
        amountKobo: mismatch === "amount" ? "1" : row.amountKobo,
        transferredAt: mismatch === "time" ? "2026-09-17T11:00:00Z" : row.bankTransferAt,
        url: "https://unapproved.invalid/private",
        bankReference: "SYNTHETIC-REF",
        beneficiary: {
          bankName: "Synthetic bank",
          accountName: "Synthetic customer",
          accountNumber: "0123456789",
        },
      });
    });
    await open(page);
    expect(access).toBe(0);
    await page.getByRole("button", { name: "Load private transfer evidence" }).click();
    await expect(
      page.getByText(
        "The private refund evidence could not be verified. Refresh the record before checking it.",
      ),
    ).toBeVisible();
    await expect(page.getByText("0123456789", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review independent check" }),
    ).toHaveCount(0);
    expect(access).toBe(1);
    expect(state.writes).toEqual([]);
  });

test("transfer operators cannot record their own approved refund", async ({ page }) => {
  await fixture(page, ["REFUND_TRANSFER"], {
    ...refund(),
    status: "NEEDS_ATTENTION",
    approvedByUserId: id(10),
    approvedAt: "2026-09-17T09:30:00Z",
  });
  await open(page);
  await expect(
    page.getByText(
      "An authorized transfer operator other than the requester and approver must record the bank transfer.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Recipient account number")).toHaveCount(0);
});

test("transfer form validates Lagos time and clears recipient details on session change", async ({
  page,
}) => {
  await fixture(page, ["REFUND_TRANSFER"], {
    ...refund(),
    status: "NEEDS_ATTENTION",
    approvedByUserId: id(2),
    approvedAt: "2026-09-17T09:30:00Z",
  });
  await open(page);
  await page.getByLabel("Bank transfer reference").fill("SYNTHETIC-BANK-REF");
  await page.getByLabel("Transfer time (Lagos time)").fill("2026-09-17T09:00");
  await page.getByLabel("Recipient bank", { exact: true }).fill("Synthetic bank");
  await page.getByLabel("Recipient account name").fill("Synthetic private recipient");
  await page.getByLabel("Recipient account number").fill("0123456789");
  await page.getByRole("button", { name: "Review transfer record" }).click();
  await expect(page.getByLabel("Transfer time (Lagos time)")).toBeFocused();
  await expect(
    page.getByText(
      "Enter the actual transfer time in Lagos, after approval and not in the future.",
    ),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByLabel("Recipient account number")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("refund transfer layout remains usable from 320 to 1920 pixels", async ({
  page,
}) => {
  const pageErrors: string[] = [],
    consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(message.text());
  });
  await fixture(page, ["REFUND_TRANSFER"], {
    ...refund(),
    status: "NEEDS_ATTENTION",
    approvedByUserId: id(2),
    approvedAt: "2026-09-17T09:30:00Z",
  });
  await open(page);
  await expect(
    page.locator("nextjs-portal").getByText("Runtime Error", { exact: true }),
  ).toHaveCount(0);
  for (const width of [320, 360, 375, 390, 414, 768, 844, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await expect(page.getByLabel("Recipient account number")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `overflow at ${width}`,
    ).toBe(true);
    if (width === 390 || width === 1440) {
      await page
        .getByRole("heading", { name: "Record a completed bank transfer" })
        .evaluate((element) =>
          element.scrollIntoView({ block: "start", behavior: "instant" }),
        );
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-refund-transfer-${width}.png`),
        fullPage: false,
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
