import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { PaymentRecord } from "@/lib/api/payment-schemas";
const id = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const paymentFixture = (): PaymentRecord => ({
  id: id(1),
  paymentNumber: "ISOLATED-MANUAL-001",
  amountKobo: "1234567890123456",
  currency: "NGN",
  status: "REQUIRES_PAYMENT",
  purpose: "ORDER_PAYMENT",
  expiresAt: "2027-01-01T00:00:00Z",
  orderId: id(2),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [],
});
function record(payment: PaymentRecord) {
  payment.status = "REQUIRES_REVIEW";
  payment.attempts = [
    {
      id: id(3),
      provider: "MANUAL",
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      initiatedAt: "2026-09-17T10:00:00Z",
      paidAt: null,
    },
  ];
}
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "manual-test" },
    },
  });
async function fixture(
  page: Page,
  payment: PaymentRecord,
  handler: (route: Route, endpoint: string) => Promise<boolean | void> = async () => {},
) {
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (await handler(route, endpoint)) return;
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(11), email: "manual@example.test", role: "CUSTOMER" },
        mfaRequired: false,
        mfaVerifiedAt: null,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-manual-csrf-".repeat(4) });
    if (endpoint === `/customers/payments/${payment.id}`) return reply(route, payment);
    await route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
}
async function fill(page: Page, method = "BANK_TRANSFER") {
  await page.getByLabel("Payment method", { exact: true }).selectOption(method);
  await page.getByLabel("Payer name", { exact: true }).fill("Isolated payer");
  await page.getByLabel("Payment date and time (Lagos)").fill("2026-09-17T09:15");
}
const reviewButton = (page: Page) =>
  page.getByRole("button", { name: "Review payment details", exact: true });
const confirm = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true });

test("manual payment review validates fields, preserves cancelled input and records only the submitted method", async ({
  page,
}) => {
  const payment = paymentFixture();
  const writes: unknown[] = [];
  await fixture(page, payment, async (route, endpoint) => {
    if (endpoint.endsWith("/manual")) {
      writes.push(route.request().postDataJSON());
      record(payment);
      await reply(route, payment);
      return true;
    }
  });
  await page.goto(`/dashboard/payments/${payment.id}`);
  if (process.env.RUN_ASSET_BROWSER_TESTS !== "true") {
    await expect(page.getByLabel("Payment evidence (optional)")).toBeDisabled();
    await expect(
      page.getByText("Document uploads are unavailable.", { exact: false }),
    ).toBeVisible();
  }
  await reviewButton(page).click();
  await expect(page.getByLabel("Payer name", { exact: true })).toBeFocused();
  await fill(page, "CASH");
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toContainText("does not transfer money");
  await expect(page.getByRole("dialog")).toContainText("12,345,678,901,234.56");
  expect(writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel("Payer name", { exact: true })).toHaveValue(
    "Isolated payer",
  );
  await reviewButton(page).click();
  await confirm(page).click();
  await expect(page.locator(".status")).toHaveText("REQUIRES REVIEW");
  expect(writes).toEqual([
    {
      method: "CASH",
      payerName: "Isolated payer",
      transferredAt: "2026-09-17T09:15:00+01:00",
    },
  ]);
  await expect(
    page.getByText("Your payment details were recorded.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Paystack" })).toHaveCount(
    0,
  );
  payment.status = "REQUIRES_PAYMENT";
  payment.attempts[0].status = "FAILED";
  await page.getByRole("button", { name: "Refresh payment status" }).click();
  await page.getByRole("button", { name: "Prepare corrected payment details" }).click();
  await expect(page.getByLabel("Payer name", { exact: true })).toHaveValue("");
  await expect(reviewButton(page)).toBeEnabled();
});

test("an uncertain submission without evidence reuses the same body and key and blocks another payment", async ({
  page,
}) => {
  const payment = paymentFixture();
  const writes: { key?: string; body: unknown }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, payment, async (route, endpoint) => {
    if (!endpoint.endsWith("/manual")) return;
    writes.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    if (writes.length === 1) await route.abort("failed");
    else {
      record(payment);
      await reply(route, { ...payment, replayed: true });
    }
    return true;
  });
  await page.goto(`/dashboard/payments/${payment.id}`);
  await fill(page, "POS");
  await page.getByLabel("Bank or receipt reference (optional)").fill("ISOLATED-POS");
  await reviewButton(page).click();
  await confirm(page).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Retry same request" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close & review record" })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with Paystack" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Payer name", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review the same payment submission" }).click();
  await confirm(page).click();
  await expect(page.locator(".status")).toHaveText("REQUIRES REVIEW");
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].key).toBeTruthy();
  expect(errors).toEqual([]);
  expect(page.url()).not.toContain("ISOLATED-POS");
});

for (const status of [
  "PROCESSING",
  "REQUIRES_REVIEW",
  "SUCCEEDED",
  "CANCELLED",
  "EXPIRED",
] as const)
  test(`manual details are unavailable for ${status}`, async ({ page }) => {
    const payment = paymentFixture();
    payment.status = status;
    await fixture(page, payment);
    await page.goto(`/dashboard/payments/${payment.id}`);
    await expect(page.locator(".status")).toHaveText(status.replaceAll("_", " "));
    await expect(reviewButton(page)).toHaveCount(0);
  });

test("a pending provider attempt blocks manual details and a passed deadline blocks new checkout", async ({
  page,
}) => {
  const payment = paymentFixture();
  payment.attempts = [
    {
      id: id(3),
      provider: "PAYSTACK",
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      initiatedAt: "2026-09-17T10:00:00Z",
      paidAt: null,
    },
  ];
  await fixture(page, payment);
  await page.goto(`/dashboard/payments/${payment.id}`);
  await expect(page.getByRole("button", { name: "Check with provider" })).toBeVisible();
  await expect(reviewButton(page)).toHaveCount(0);
  payment.attempts = [];
  payment.expiresAt = "2020-01-01T00:00:00Z";
  await page.getByRole("button", { name: "Refresh payment status" }).click();
  await expect(
    page.getByText("The payment deadline has passed.", { exact: false }),
  ).toBeVisible();
  await expect(reviewButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Paystack" })).toHaveCount(
    0,
  );
});

test.describe("configured manual evidence", () => {
  test.skip(
    process.env.RUN_ASSET_BROWSER_TESTS !== "true",
    "Requires an isolated approved storage host",
  );
  const pdf = Buffer.from("%PDF-1.4\nIsolated payment receipt");
  const token = "isolated-manual-evidence-ticket-".repeat(4);
  async function upload(page: Page) {
    await page.getByLabel("Payment evidence (optional)").setInputFiles({
      name: "isolated-receipt.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
    await expect(
      page.getByText("File uploaded. Ready to attach", { exact: false }),
    ).toBeVisible();
  }
  async function storage(page: Page, uploads: string[]) {
    await page.route("https://storage.invalid/**", async (route) => {
      const headers = {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-methods": "PUT, OPTIONS",
        "access-control-allow-headers":
          "content-type,x-amz-checksum-sha256,x-amz-server-side-encryption",
      };
      if (route.request().method() === "PUT") {
        uploads.push(route.request().method());
        expect(route.request().postDataBuffer()).toEqual(pdf);
        expect(route.request().headers()["cookie"]).toBeUndefined();
        expect(route.request().headers()["x-csrf-token"]).toBeUndefined();
      }
      await route.fulfill({ status: 200, body: "", headers });
    });
  }
  async function instructions(route: Route) {
    expect(route.request().postDataJSON()).toEqual({
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      checksumSha256: createHash("sha256").update(pdf).digest("hex"),
    });
    await reply(route, {
      evidenceToken: token,
      upload: {
        method: "PUT",
        url: "https://storage.invalid/manual/evidence",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        headers: {
          "content-type": "application/pdf",
          "x-amz-checksum-sha256": createHash("sha256").update(pdf).digest("base64"),
          "x-amz-server-side-encryption": "AES256",
        },
      },
    });
  }
  test("uploaded evidence is private, optional and attached only after reviewed confirmation", async ({
    page,
  }) => {
    const payment = paymentFixture();
    const uploads: string[] = [];
    const writes: unknown[] = [];
    await storage(page, uploads);
    await fixture(page, payment, async (route, endpoint) => {
      if (endpoint.endsWith("/manual-evidence/upload")) {
        await instructions(route);
        return true;
      }
      if (endpoint.endsWith("/manual")) {
        writes.push(route.request().postDataJSON());
        record(payment);
        await reply(route, payment);
        return true;
      }
    });
    await page.goto(`/dashboard/payments/${payment.id}`);
    await fill(page);
    await page.getByLabel("Payment evidence (optional)").setInputFiles({
      name: "wrong.webp",
      mimeType: "image/webp",
      buffer: Buffer.from("RIFF"),
    });
    await expect(page.getByText("Choose a PDF, JPEG or PNG file.")).toBeVisible();
    await reviewButton(page).click();
    await expect(page.getByLabel("Payment evidence (optional)")).toBeFocused();
    await upload(page);
    expect(writes).toHaveLength(0);
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
    await reviewButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("isolated-receipt.pdf");
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Go back" }),
    ).toBeFocused();
    const heading = await page.getByRole("dialog").getByRole("heading").boundingBox();
    const action = await confirm(page).boundingBox();
    expect(heading && heading.y >= 0 && heading.y + heading.height <= 740).toBe(true);
    expect(action && action.y >= 0 && action.y + action.height <= 740).toBe(true);
    await page.keyboard.press("Shift+Tab");
    const details = page.getByRole("region", { name: "Review details", exact: true });
    await expect(details).toBeFocused();
    await page.keyboard.press("End");
    await expect
      .poll(() => details.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Home");
    await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: path.join(os.tmpdir(), "allied-manual-payment-mobile.png"),
    });
    await confirm(page).click();
    await expect(page.locator(".status")).toHaveText("REQUIRES REVIEW");
    expect(uploads).toHaveLength(1);
    expect(writes).toEqual([
      {
        method: "BANK_TRANSFER",
        payerName: "Isolated payer",
        transferredAt: "2026-09-17T09:15:00+01:00",
        evidenceToken: token,
      },
    ]);
    expect(
      await page.evaluate(() =>
        JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
      ),
    ).not.toContain(token);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(os.tmpdir(), "allied-manual-payment-review-desktop.png"),
    });
  });
  test("evidence expiry while reviewing prevents submission and allows a fresh upload before any attempt", async ({
    page,
  }) => {
    const payment = paymentFixture();
    const uploads: string[] = [];
    let writes = 0;
    await storage(page, uploads);
    await fixture(page, payment, async (route, endpoint) => {
      if (endpoint.endsWith("/manual-evidence/upload")) {
        await instructions(route);
        return true;
      }
      if (endpoint.endsWith("/manual")) {
        writes++;
        await reply(route, payment);
        return true;
      }
    });
    await page.clock.install();
    await page.goto(`/dashboard/payments/${payment.id}`);
    await fill(page);
    await upload(page);
    await reviewButton(page).click();
    await page.clock.fastForward(61000);
    await confirm(page).click();
    await expect(
      page.getByText("The evidence authorisation expired before submission.", {
        exact: false,
      }),
    ).toBeAttached();
    expect(writes).toBe(0);
    await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();
    await expect(
      page.getByRole("button", { name: "Upload selected file again" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Remove selected file" }).click();
    await reviewButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("No attachment");
  });
  test("session invalidation cancels evidence preparation before any storage transfer", async ({
    page,
  }) => {
    const payment = paymentFixture();
    const uploads: string[] = [];
    let inactive = false;
    let prepared = false;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await storage(page, uploads);
    await fixture(page, payment, async (route, endpoint) => {
      if (inactive && endpoint === "/auth/session") {
        await route.fulfill({
          status: 401,
          json: { success: false, error: { code: "SESSION_EXPIRED" } },
        });
        return true;
      }
      if (endpoint.endsWith("/manual-evidence/upload")) {
        prepared = true;
        await gate;
        await instructions(route);
        return true;
      }
    });
    await page.goto(`/dashboard/payments/${payment.id}`);
    await page.getByLabel("Payment evidence (optional)").setInputFiles({
      name: "isolated-receipt.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.getByRole("button", { name: "Upload selected file", exact: true }).click();
    await expect.poll(() => prepared).toBe(true);
    inactive = true;
    await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
    await expect(page.getByLabel("Payment evidence (optional)")).toHaveCount(0);
    release?.();
    await expect(
      page.getByRole("link", { name: "Go to sign in", exact: true }),
    ).toBeVisible();
    expect(uploads).toHaveLength(0);
  });

  test("an unknown evidence submission recovers only the original body and key after ticket expiry", async ({
    page,
  }) => {
    const payment = paymentFixture();
    const uploads: string[] = [];
    const writes: { key?: string; body: unknown }[] = [];
    await page.clock.install();
    await storage(page, uploads);
    await fixture(page, payment, async (route, endpoint) => {
      if (endpoint.endsWith("/manual-evidence/upload")) {
        await instructions(route);
        return true;
      }
      if (endpoint.endsWith("/manual")) {
        writes.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postDataJSON(),
        });
        if (writes.length === 1) await route.abort("failed");
        else {
          record(payment);
          await reply(route, { ...payment, replayed: true });
        }
        return true;
      }
    });
    await page.goto(`/dashboard/payments/${payment.id}`);
    await fill(page);
    await upload(page);
    await reviewButton(page).click();
    await confirm(page).click();
    await expect(page.getByRole("button", { name: "Retry same request" })).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close & review record" })
      .click();
    await expect(
      page.getByRole("button", { name: "Continue with Paystack" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Remove selected file" }),
    ).toBeDisabled();
    await page.clock.fastForward(61000);
    await page
      .getByRole("button", { name: "Review the same payment submission" })
      .click();
    await confirm(page).click();
    await expect(page.locator(".status")).toHaveText("REQUIRES REVIEW");
    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
    expect(writes[0].key).toBeTruthy();
    expect(uploads).toEqual(["PUT"]);
  });
});
