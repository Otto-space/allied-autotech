import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type { StaffPayment, RefundRecord } from "@/lib/api/staff-payment-schemas";
const id = (value: number) =>
  `a0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const paymentFixture = (): StaffPayment => ({
  id: id(1),
  paymentNumber: "ISOLATED-PAYMENT-001",
  amountKobo: "1234567890123456",
  currency: "NGN",
  status: "REQUIRES_REVIEW",
  purpose: "ORDER_PAYMENT",
  expiresAt: "2027-01-01T00:00:00Z",
  orderId: id(3),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  createdAt: "2026-09-17T09:00:00Z",
  succeededAt: null,
  attempts: [
    {
      id: id(2),
      attemptNumber: 1,
      provider: "MANUAL",
      method: "BANK_TRANSFER",
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      amountKobo: "1234567890123456",
      currency: "NGN",
      initiatedAt: "2026-09-17T09:00:00Z",
      paidAt: null,
      verifiedAt: null,
      manualReview: {
        status: "PENDING",
        bankReference: "ISOLATED-REFERENCE",
        payerName: "Isolated payer",
        transferredAt: "2026-09-17T08:30:00Z",
        evidenceSha256: "a".repeat(64),
        submittedAt: "2026-09-17T09:00:00Z",
        reviewedAt: null,
      },
    },
  ],
});
const refundFixture = (): RefundRecord => ({
  id: id(20),
  refundNumber: "ISOLATED-REFUND-001",
  paymentAttemptId: id(2),
  requestedByUserId: id(21),
  approvedByUserId: null,
  amountKobo: "12345",
  currency: "NGN",
  status: "REQUESTED",
  reason: "Isolated approved return",
  providerStatus: null,
  failureCode: null,
  requestedAt: "2026-09-17T09:30:00Z",
  approvedAt: null,
  processedAt: null,
  failedAt: null,
  updatedAt: "2026-09-17T09:30:00Z",
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      meta: { requestId: "payment-test" },
      data,
    },
  });
async function fixture(
  page: Page,
  handler: (route: Route, endpoint: string) => Promise<boolean | void>,
  role = "ADMIN",
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        mfaRequired: true,
        mfaVerifiedAt: "2026-09-17T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
        user: { id: id(11), email: "payments@example.test", role },
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-payment-csrf-".repeat(4) });
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
test("refund cancellation preserves its note and failed queue loading is not an empty result", async ({
  page,
}) => {
  const refund = refundFixture();
  let failed = true;
  const queries: string[] = [];
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-refunds") {
      queries.push(new URL(route.request().url()).search);
      if (failed)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      else await reply(route, { items: [refund], nextCursor: id(30) });
      return true;
    }
    if (endpoint.endsWith("/decision")) {
      writes.push(route.request().postDataJSON());
      refund.status = "CANCELLED";
      await reply(route, refund);
      return true;
    }
  });
  await page.goto("/admin/refunds");
  await expect(
    page.getByRole("button", { name: "Refresh refund records" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "No refund records on this page" }),
  ).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Refresh refund records" }).click();
  await page
    .getByRole("navigation", { name: "Refund requests pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)).toContain(`cursor=${id(30)}`);
  await page.getByLabel("Refund status filter").selectOption("REQUESTED");
  await expect.poll(() => queries.at(-1)).toBe("?limit=25&status=REQUESTED");
  await page
    .getByLabel("Refund cancellation note (optional)")
    .fill("  Isolated duplicate request cancelled  ");
  await page.getByRole("button", { name: "Review refund decision" }).click();
  await expect(page.getByRole("dialog")).toContainText("without returning money");
  await expect(page.getByRole("dialog")).toContainText(
    "Isolated duplicate request cancelled",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("CANCELLED");
  expect(writes).toEqual([
    { decision: "CANCELLED", note: "Isolated duplicate request cancelled" },
  ]);
  await expect(page.getByRole("button", { name: "Review refund decision" })).toHaveCount(
    0,
  );
});

test("an interrupted refund approval stays locked across queue filters until reconciled", async ({
  page,
}) => {
  const refund = refundFixture();
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-refunds") {
      await reply(route, { items: [refund] });
      return true;
    }
    if (endpoint.endsWith("/decision")) {
      writes++;
      await route.abort("failed");
      return true;
    }
  });
  await page.goto("/admin/refunds");
  await page.getByLabel("Refund decision", { exact: true }).selectOption("APPROVED");
  await page.getByRole("button", { name: "Review refund decision" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await page.getByLabel("Refund status filter").selectOption("REQUESTED");
  await expect(
    page.getByRole("button", { name: "Review refund decision" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  refund.status = "PENDING";
  await page.getByRole("button", { name: "Refresh refund records" }).click();
  await expect(page.locator(".status")).toHaveText("PENDING");
  await expect(page.getByRole("button", { name: "Review refund decision" })).toHaveCount(
    0,
  );
  refund.status = "SUCCEEDED";
  refund.processedAt = "2026-09-17T10:00:00Z";
  await page.getByRole("button", { name: "Refresh refund records" }).click();
  await expect(page.locator(".status")).toHaveText("SUCCEEDED");
  expect(writes).toBe(1);
});

test("a hidden invalid cancellation note cannot block approval and is never sent", async ({
  page,
}) => {
  const refund = refundFixture();
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-refunds") {
      await reply(route, { items: [refund] });
      return true;
    }
    if (endpoint.endsWith("/decision")) {
      writes.push(route.request().postDataJSON());
      refund.status = "PENDING";
      await reply(route, refund);
      return true;
    }
  });
  await page.goto("/admin/refunds");
  await page.getByLabel("Refund cancellation note (optional)").fill("Invalid\tcontrol");
  await page.getByRole("button", { name: "Review refund decision" }).click();
  await expect(page.getByLabel("Refund cancellation note (optional)")).toBeFocused();
  await page.getByLabel("Refund decision", { exact: true }).selectOption("APPROVED");
  await page.getByRole("button", { name: "Review refund decision" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("PENDING");
  expect(writes).toEqual([{ decision: "APPROVED" }]);
});

test("administrator payment filters validate references and reset paging", async ({
  page,
}) => {
  const payment = paymentFixture();
  const queries: string[] = [];
  let failed = true;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint !== "/staff/payments") return;
      queries.push(new URL(route.request().url()).search);
      if (failed)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      else await reply(route, { items: [payment], nextCursor: id(30) });
      return true;
    },
    "ADMIN",
  );
  await page.goto("/admin/payments");
  await expect(page.getByText("No payment records on this page")).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Refresh payment records" }).click();
  await expect(page.getByRole("heading", { name: payment.paymentNumber })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review manual payment decision" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Review refund requests", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Staff payments pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)).toContain(`cursor=${id(30)}`);
  await page.getByLabel("Customer profile reference (optional)").fill("invalid");
  await page.getByRole("button", { name: "Apply payment filters" }).click();
  await expect(page.getByLabel("Customer profile reference (optional)")).toBeFocused();
  await page.getByLabel("Customer profile reference (optional)").fill(id(40));
  await page.getByLabel("Payment provider filter").selectOption("MANUAL");
  await page.getByRole("button", { name: "Apply payment filters" }).click();
  await expect.poll(() => queries.at(-1)).toContain(`customerId=${id(40)}`);
  expect(queries.at(-1)).toContain("provider=MANUAL");
  expect(queries.at(-1)).not.toContain("cursor=");
  expect(page.url()).not.toContain(id(40));
  await page.getByRole("button", { name: "Clear payment filters" }).click();
  await expect.poll(() => queries.at(-1)).toBe("?limit=25");
});
test("administrator manual approval requires a note and shows only server-confirmed settlement", async ({
  page,
}) => {
  const payment = paymentFixture();
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/payments") {
      await reply(route, { items: [payment] });
      return true;
    }
    if (endpoint.endsWith("/review")) {
      writes.push(route.request().postDataJSON());
      payment.status = "SUCCEEDED";
      payment.attempts[0].status = "SUCCESSFUL";
      payment.attempts[0].verificationStatus = "VERIFIED";
      payment.attempts[0].manualReview!.status = "APPROVED";
      await reply(route, payment);
      return true;
    }
  });
  await page.goto("/admin/payments");
  await page.getByLabel("Manual payment decision").selectOption("APPROVED");
  await page.getByRole("button", { name: "Review manual payment decision" }).click();
  await expect(page.getByLabel("Manual payment reviewer note")).toBeFocused();
  await page
    .getByLabel("Manual payment reviewer note")
    .fill("Isolated bank reconciliation completed");
  await page.getByRole("button", { name: "Review manual payment decision" }).click();
  await expect(page.getByRole("dialog")).toContainText("independently verified");
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(page.locator(".status")).toHaveText("SUCCEEDED");
  expect(writes[0]).toEqual({
    decision: "APPROVED",
    reviewerNote: "Isolated bank reconciliation completed",
  });
  await expect(
    page.getByRole("button", { name: "Review manual payment decision" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Request a refund for this attempt", { exact: true }),
  ).toBeVisible();
});
test("an unconfirmed manual rejection cannot be resent after filtering or reopening the record", async ({
  page,
}) => {
  const payment = paymentFixture();
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/staff/payments") {
      await reply(route, { items: [payment] });
      return true;
    }
    if (endpoint.endsWith("/review")) {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        decision: "REJECTED",
        reviewerNote: "Isolated evidence mismatch",
      });
      await route.abort("failed");
      return true;
    }
  });
  await page.goto("/admin/payments");
  await page
    .getByLabel("Manual payment reviewer note")
    .fill("Isolated evidence mismatch");
  await page.getByRole("button", { name: "Review manual payment decision" }).click();
  await expect(page.getByRole("dialog")).toContainText("does not return funds");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Confirm change" }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page.getByRole("button", { name: "Review manual payment decision" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear payment filters" }).click();
  await expect(
    page.getByRole("button", { name: "Review manual payment decision" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  payment.attempts[0].manualReview!.status = "REJECTED";
  payment.attempts[0].status = "FAILED";
  payment.status = "REQUIRES_PAYMENT";
  await page.getByRole("button", { name: "Refresh payment records" }).click();
  await expect(page.locator(".status")).toHaveText("REQUIRES PAYMENT");
  await expect(
    page.getByRole("button", { name: "Review manual payment decision" }),
  ).toHaveCount(0);
});
test("refund request preserves exact kobo and its idempotency key across a lost response", async ({
  page,
}) => {
  const payment = paymentFixture();
  payment.status = "SUCCEEDED";
  payment.attempts[0].status = "SUCCESSFUL";
  payment.attempts[0].verificationStatus = "VERIFIED";
  payment.attempts[0].manualReview = null;
  const refund = refundFixture();
  const writes: { key: string | undefined; body: unknown }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/staff/payments") {
        await reply(route, { items: [payment] });
        return true;
      }
      if (endpoint === "/staff/payments/refunds") {
        writes.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postDataJSON(),
        });
        if (writes.length === 1) await route.abort("failed");
        else await reply(route, { refund, replayed: true });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/payments");
  await expect(page).toHaveTitle(/Manage payment records/);
  await page.getByText("Request a refund for this attempt", { exact: true }).click();
  await page.getByLabel("Refund amount (NGN)").fill("12345678901234.57");
  await page.getByLabel("Refund reason", { exact: true }).fill(refund.reason);
  await page.getByRole("button", { name: "Review refund request", exact: true }).click();
  await expect(page.getByLabel("Refund amount (NGN)")).toBeFocused();
  await page.getByLabel("Refund amount (NGN)").fill("123.45");
  await page.setViewportSize({ width: 320, height: 740 });
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
  await page.getByRole("button", { name: "Review refund request", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "no money is returned by this request",
  );
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Go back" }),
  ).toBeFocused();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-refund-request-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Retry same request" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear payment filters" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Refund amount (NGN)")).toBeDisabled();
  await page.getByRole("button", { name: "Review same refund request" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByText(`Refund ${refund.refundNumber}:`, { exact: false }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].key).toBeTruthy();
  expect(writes[0].body).toEqual({
    paymentAttemptId: id(2),
    amountKobo: "12345",
    reason: refund.reason,
  });
  await expect(
    page.getByText("A different administrator must review", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("refund queue enforces different-operator decisions and separates attention from successful refunds", async ({
  page,
}) => {
  const own = {
    ...refundFixture(),
    id: id(22),
    refundNumber: "ISOLATED-OWN-REFUND",
    requestedByUserId: id(11),
  };
  const refund = refundFixture();
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-refunds") {
      await reply(route, { items: [own, refund] });
      return true;
    }
    if (endpoint.endsWith("/decision")) {
      writes.push(route.request().postDataJSON());
      refund.status = "NEEDS_ATTENTION";
      refund.providerStatus = "OFFLINE_PROCESSING_REQUIRED";
      await reply(route, refund);
      return true;
    }
  });
  await page.goto("/admin/refunds");
  const self = page.getByRole("region", { name: own.refundNumber, exact: true });
  await expect(self).toContainText("A different administrator must approve or cancel");
  await expect(self.getByRole("button", { name: "Review refund decision" })).toHaveCount(
    0,
  );
  const section = page.getByRole("region", { name: refund.refundNumber, exact: true });
  await section
    .getByLabel("Refund cancellation note (optional)")
    .fill("Not sent on approval");
  await section.getByLabel("Refund decision", { exact: true }).selectOption("APPROVED");
  await section.getByRole("button", { name: "Review refund decision" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "may submit the refund to the payment provider",
  );
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change" }).click();
  await expect(section.locator(".status")).toHaveText("NEEDS ATTENTION");
  await expect(section).toContainText("Do not assume funds were returned");
  expect(writes[0]).toEqual({ decision: "APPROVED" });
  await expect(
    section.getByRole("button", { name: "Review refund decision" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.mouse.move(0, 0);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-refund-attention-desktop.png"),
    fullPage: false,
  });
});
test("staff cannot load the administrator refund queue", async ({ page }) => {
  let reads = 0;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/admin/operations/payment-refunds") {
        reads++;
        await reply(route, { items: [] });
        return true;
      }
    },
    "STAFF",
  );
  await page.goto("/admin/refunds");
  await expect(
    page.getByText("Administrator access is required to review refund requests."),
  ).toBeVisible();
  expect(reads).toBe(0);
});
test("manual evidence requires an explicit authorized temporary access request", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires the isolated storage allowlist.",
  );
  const payment = paymentFixture();
  let requests = 0;
  await fixture(
    page,
    async (route, endpoint) => {
      if (endpoint === "/staff/payments") {
        await reply(route, { items: [payment] });
        return true;
      }
      if (endpoint.endsWith("/evidence-access")) {
        requests++;
        expect(route.request().method()).toBe("POST");
        expect(route.request().postDataJSON()).toEqual({});
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        await reply(route, {
          url: "https://storage.invalid/evidence/payment?signature=isolated",
          expiresInSeconds: 60,
        });
        return true;
      }
    },
    "ADMIN",
  );
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("button", { name: "Request payment evidence" }),
  ).toBeEnabled();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Request payment evidence" }).click();
  await expect(
    page.getByRole("link", { name: "Download payment evidence" }),
  ).toHaveAttribute(
    "href",
    "https://storage.invalid/evidence/payment?signature=isolated",
  );
  expect(requests).toBe(1);
});
