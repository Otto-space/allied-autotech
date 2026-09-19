import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import type {
  OperationalJob,
  PaymentAnomaly,
  PaymentDispute,
} from "@/lib/api/operations-schemas";
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
const jobFixture = (): OperationalJob => ({
  id: id(1),
  source: "OUTBOX",
  eventId: id(2),
  aggregateType: "ORDER",
  aggregateId: id(3),
  eventType: "ISOLATED_NOTIFICATION",
  status: "FAILED",
  attempts: 3,
  availableAt: time,
  lockedAt: null,
  createdAt: time,
  updatedAt: time,
});
const anomalyFixture = (): PaymentAnomaly => ({
  id: id(5),
  paymentId: id(6),
  paymentAttemptId: id(7),
  refundId: null,
  disputeId: null,
  type: "AMOUNT_MISMATCH",
  status: "OPEN",
  summary: "Isolated amount mismatch",
  resolutionNote: null,
  resolvedAt: null,
  resolvedByUserId: null,
  detectedAt: time,
  updatedAt: time,
});
const disputeFixture = (): PaymentDispute => ({
  id: id(8),
  paymentAttemptId: id(7),
  provider: "PAYSTACK",
  providerDisputeId: "ISOLATED-DISPUTE",
  status: "AWAITING_RESPONSE",
  category: "FRAUD",
  amountKobo: "1234567890123456",
  currency: "NGN",
  responseDueAt: "2026-09-20T10:00:00Z",
  openedAt: time,
  respondedAt: null,
  resolvedAt: null,
  hasEvidence: true,
  updatedAt: time,
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "operations-test" },
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
        user: { id: id(11), email: "operations@example.test", role },
        mfaRequired: true,
        mfaVerifiedAt: time,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-operation-csrf-".repeat(4) });
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });

test("operations overview uses real zero counts and links to the exception and job screens", async ({
  page,
}) => {
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/status") {
      await reply(route, {
        queues: [{ queue: "outbox", status: "FAILED", count: 2 }],
        openPaymentAnomalies: 0,
        lastReconciliation: null,
      });
      return true;
    }
    if (endpoint === "/admin/operations/jobs") {
      await reply(route, { items: [jobFixture()] });
      return true;
    }
  });
  await page.goto("/admin");
  await expect(page.getByText("0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review exceptions", exact: true }),
  ).toHaveAttribute("href", "/admin/payment-exceptions");
  await expect(
    page.getByRole("link", { name: "Review disputes", exact: true }),
  ).toHaveAttribute("href", "/admin/payment-disputes");
  await page.getByRole("link", { name: "Review processing jobs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Processing jobs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ISOLATED_NOTIFICATION" }),
  ).toBeVisible();
});

for (const route of ["processing-jobs", "payment-exceptions", "payment-disputes"])
  test(`staff cannot read administrator ${route}`, async ({ page }) => {
    let calls = 0;
    await fixture(
      page,
      async (request, endpoint) => {
        if (endpoint.startsWith("/admin/operations/")) {
          calls++;
          await reply(request, { items: [] });
          return true;
        }
      },
      "STAFF",
    );
    await page.goto(`/admin/${route}`);
    await expect(
      page.getByText("Administrator access is required to view these records."),
    ).toBeVisible();
    expect(calls).toBe(0);
  });

test("job retry validates its reason, guards changed attempts and does not offer broken cursor navigation", async ({
  page,
}) => {
  const job = jobFixture();
  let failed = true;
  let retried = false;
  const queries: string[] = [];
  const writes: unknown[] = [];
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/jobs") {
      queries.push(new URL(route.request().url()).search);
      if (failed)
        await route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      else
        await reply(route, {
          items: retried ? [] : [{ ...job, lastError: "PRIVATE_BACKEND_DETAIL" }],
          nextCursor: id(20),
        });
      return true;
    }
    if (endpoint.endsWith("/retry")) {
      writes.push(route.request().postDataJSON());
      retried = true;
      expect(endpoint).toBe(`/admin/operations/jobs/outbox/${job.id}/retry`);
      expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
      await reply(route, {
        id: job.id,
        source: "outbox",
        status: "RETRY_REQUESTED",
        attempts: 4,
      });
      return true;
    }
  });
  await page.goto("/admin/processing-jobs");
  await expect(page.getByText("temporarily unavailable", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matching records" })).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Refresh processing jobs" }).click();
  await expect(page.getByRole("heading", { name: job.eventType })).toBeVisible();
  await expect(
    page.getByText("More matching records exist.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await expect(page.getByText("PRIVATE_BACKEND_DETAIL", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Review job retry" }).click();
  await expect(page.getByLabel("Job retry reason")).toBeFocused();
  await page.getByLabel("Job retry reason").fill("Isolated previous delivery reconciled");
  if (job.source === "OUTBOX") job.attempts = 4;
  await page.getByRole("button", { name: "Refresh processing jobs" }).click();
  await expect(page.getByRole("button", { name: "Reload action fields" })).toBeVisible();
  await expect(page.getByLabel("Job retry reason")).toHaveValue(
    "Isolated previous delivery reconciled",
  );
  await expect(page.getByRole("button", { name: "Review job retry" })).toBeDisabled();
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await page.getByLabel("Job retry reason").fill("Isolated fourth attempt reconciled");
  await page.getByRole("button", { name: "Review job retry" }).click();
  await expect(page.getByRole("dialog")).toContainText("can send a notification");
  expect(writes).toHaveLength(0);
  await confirm(page).click();
  await expect(page.getByRole("heading", { name: "No matching records" })).toBeVisible();
  expect(writes).toEqual([
    { expectedAttempts: 4, reason: "Isolated fourth attempt reconciled" },
  ]);
  expect(queries.every((query) => !query.includes("cursor="))).toBe(true);
});

test("unknown webhook retry is locked across filters and processing jobs never offer retries", async ({
  page,
}) => {
  const job: OperationalJob = {
    id: id(1),
    source: "PAYMENT_WEBHOOK",
    eventType: "ISOLATED_PAYMENT_EVENT",
    status: "DEAD_LETTER",
    processingAttempts: 5,
    nextAttemptAt: null,
    receivedAt: time,
    lockedAt: null,
    updatedAt: time,
  };
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/jobs") {
      await reply(route, {
        items:
          new URL(route.request().url()).searchParams.get("source") === "PAYMENT_WEBHOOK"
            ? [job]
            : [],
      });
      return true;
    }
    if (endpoint.endsWith("/retry")) {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        expectedAttempts: 5,
        reason: "Isolated webhook reconciliation",
      });
      await route.abort("failed");
      return true;
    }
  });
  await page.goto("/admin/processing-jobs");
  await page.getByLabel("Job source").selectOption("PAYMENT_WEBHOOK");
  await page.getByLabel("Job retry reason").fill("Isolated webhook reconciliation");
  await page.getByRole("button", { name: "Review job retry" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "may update financial or fulfilment records",
  );
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await page.getByLabel("Job source").selectOption("OUTBOX");
  await page.getByLabel("Job source").selectOption("PAYMENT_WEBHOOK");
  await expect(page.getByRole("button", { name: "Review job retry" })).toBeDisabled();
  expect(writes).toBe(1);
  job.status = "PROCESSING";
  await page.getByRole("button", { name: "Refresh processing jobs" }).click();
  await expect(
    page.getByText("Processing is already in progress.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review job retry" })).toHaveCount(0);
});

for (const status of ["RESOLVED", "IGNORED"] as const)
  test(`exceptions require investigation before ${status} and retain exact expected status`, async ({
    page,
  }) => {
    const anomaly = anomalyFixture();
    const writes: unknown[] = [];
    const queries: string[] = [];
    await fixture(page, async (route, endpoint) => {
      if (endpoint === "/admin/operations/payment-anomalies") {
        queries.push(new URL(route.request().url()).search);
        await reply(route, { items: [anomaly], nextCursor: id(20) });
        return true;
      }
      if (endpoint.endsWith("/status")) {
        const body = route.request().postDataJSON();
        writes.push(body);
        anomaly.status = body.status;
        anomaly.resolutionNote = body.resolutionNote;
        if (body.status !== "INVESTIGATING") {
          anomaly.resolvedAt = time;
          anomaly.resolvedByUserId = id(11);
        }
        await reply(route, anomaly);
        return true;
      }
    });
    await page.goto("/admin/payment-exceptions");
    await page
      .getByRole("navigation", { name: "Payment exceptions pages" })
      .getByRole("button", { name: "Next" })
      .click();
    await expect.poll(() => queries.at(-1)).toContain(`cursor=${id(20)}`);
    await page.getByLabel("Exception type").selectOption("AMOUNT_MISMATCH");
    await expect.poll(() => queries.at(-1)).not.toContain("cursor=");
    await expect(page.getByLabel("New exception status")).toHaveCount(0);
    await page
      .getByLabel("Exception update reason")
      .fill("Isolated investigation opened");
    await page.getByRole("button", { name: "Review exception update" }).click();
    await confirm(page).click();
    await expect(page.locator(".status")).toHaveText("INVESTIGATING");
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await page.getByLabel("New exception status").selectOption(status);
    await page
      .getByLabel("Exception update reason")
      .fill("Isolated reconciliation documented");
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
    await page.getByRole("button", { name: "Review exception update" }).click();
    await expect(page.getByRole("dialog")).toContainText("does not verify a payment");
    await page.screenshot({
      path: path.join(os.tmpdir(), "allied-exception-review-mobile.png"),
    });
    await confirm(page).click();
    await expect(page.locator(".status")).toHaveText(status);
    expect(writes).toEqual([
      {
        expectedStatus: "OPEN",
        status: "INVESTIGATING",
        resolutionNote: "Isolated investigation opened",
      },
      {
        expectedStatus: "INVESTIGATING",
        status,
        resolutionNote: "Isolated reconciliation documented",
      },
    ]);
    await expect(
      page.getByRole("button", { name: "Review exception update" }),
    ).toHaveCount(0);
  });

test("malformed exception update responses cannot be replayed as successful decisions", async ({
  page,
}) => {
  const anomaly = anomalyFixture();
  let writes = 0;
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-anomalies") {
      await reply(route, { items: [anomaly] });
      return true;
    }
    if (endpoint.endsWith("/status")) {
      writes++;
      await reply(route, {});
      return true;
    }
  });
  await page.goto("/admin/payment-exceptions");
  await page.getByLabel("Exception update reason").fill("Isolated investigation");
  await page.getByRole("button", { name: "Review exception update" }).click();
  await confirm(page).click();
  await expect(confirm(page)).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("button", { name: "Review exception update" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});

test("dispute filters reset paging and show precise amounts, Lagos deadlines and evidence availability", async ({
  page,
}) => {
  const dispute = disputeFixture();
  const queries: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, async (route, endpoint) => {
    if (endpoint === "/admin/operations/payment-disputes") {
      queries.push(new URL(route.request().url()).search);
      await reply(route, { items: [dispute], nextCursor: id(20) });
      return true;
    }
  });
  await page.goto("/admin/payment-disputes");
  await expect(page).toHaveTitle(/Payment disputes/);
  await expect(page.getByText("12,345,678,901,234.56", { exact: false })).toBeVisible();
  await expect(page.getByText("20 Sept 2026, 11:00 (Lagos time)")).toBeVisible();
  await expect(page.getByText("Yes", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /evidence|accept dispute/i }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Payment disputes pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect.poll(() => queries.at(-1)).toContain("cursor=");
  await page.getByLabel("Dispute category").selectOption("FRAUD");
  await expect.poll(() => queries.at(-1)).toContain("category=FRAUD");
  expect(queries.at(-1)).not.toContain("cursor=");
  dispute.responseDueAt = null;
  dispute.hasEvidence = false;
  await page.getByRole("button", { name: "Refresh payment disputes" }).click();
  await expect(page.getByText("Not recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("No", { exact: true })).toBeVisible();
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(os.tmpdir(), "allied-disputes-desktop.png") });
  expect(errors).toEqual([]);
});
