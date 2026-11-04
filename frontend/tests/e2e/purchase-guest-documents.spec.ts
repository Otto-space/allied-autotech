import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { purchaseFixture, guestProduct } from "../fixtures/purchase-guest";
import { id } from "../fixtures/public-account-actions";

async function fixture(page: Parameters<typeof purchaseFixture>[0]) {
  const buyer = await purchaseFixture(page);
  const state = { readFailure: false, invalidPdf: false, denied: false, downloads: 0 };
  const paper = {
    schemaVersion: 1,
    id: id(91),
    invoiceNumber: "INV-SYNTHETIC-91",
    currency: "NGN",
    status: "ISSUED",
    version: 0,
    issuedAt: new Date().toISOString(),
    dueAt: null,
    paidAt: null,
    issuer: {
      name: "Allied AutoTech",
      address: "Synthetic test branch address",
      paymentTerms: "Collection only",
    },
    billTo: {
      name: "Synthetic guest buyer",
      address: null,
      reference: buyer.buyerReference,
    },
    source: {
      type: "ORDER",
      id: buyer.order.id,
      reference: buyer.order.orderNumber,
      description: "Parts order",
    },
    lines: [
      {
        description: guestProduct.name,
        quantity: 2,
        unitPriceKobo: "10000",
        subtotalKobo: "20000",
      },
    ],
    discountKobo: "0",
    deliveryKobo: "0",
    detailBasis: "SNAPSHOT",
    subtotalKobo: "20000",
    taxKobo: "1500",
    depositCreditKobo: "0",
    totalKobo: "21500",
    receipts: [],
    paymentRequests: [],
  };
  await page.route("**/api/v1/purchase/invoices/**", async (route) => {
    if (state.denied)
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "AUTHENTICATION_FAILED" } },
      });
    if (route.request().url().endsWith("/document"))
      return route.fulfill({
        status: state.readFailure ? 503 : 200,
        json: state.readFailure
          ? { success: false, error: { code: "DATABASE_UNAVAILABLE" } }
          : {
              success: true,
              message: "Synthetic invoice",
              meta: { requestId: "guest-document" },
              data: paper,
            },
      });
    state.downloads++;
    return route.fulfill({
      contentType: "application/pdf",
      headers: {
        "X-Document-Id": paper.id,
        "X-Document-Type": "invoice",
        "Content-Disposition": 'attachment; filename="invoice-SYNTHETIC-91.pdf"',
      },
      body: state.invalidPdf
        ? "<html>not a PDF</html>"
        : "%PDF-synthetic-browser-document",
    });
  });
  return { state, buyer, paper };
}
for (const width of [320, 768, 1366]) {
  test(`guest invoice download and private sharing at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    await page.goto(`/purchase/invoices/${f.paper.id}`);
    await expect(
      page.getByRole("heading", { name: f.paper.invoiceNumber }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download invoice", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("invoice-SYNTHETIC-91.pdf");
    await page.getByRole("button", { name: "Share invoice", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share invoice" });
    await expect(dialog.getByLabel("Private purchase link")).toHaveValue(
      new RegExp(`/purchase/invoices/${f.paper.id}$`),
    );
    await expect(dialog).toContainText("does not grant access");
    await dialog.getByRole("button", { name: "Close sharing" }).focus();
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close sharing" })).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).include(".document-share").analyze()).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share invoice", exact: true }),
    ).toBeFocused();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`synthetic-guest-invoice-${width}.png`),
      fullPage: false,
    });
    expect(f.buyer.writes).toEqual([]);
  });
}
test("failed invoice read retries without blocking owned history", async ({ page }) => {
  const f = await fixture(page);
  f.state.readFailure = true;
  await page.goto(`/purchase/invoices/${f.paper.id}`);
  await expect(
    page.getByText("This invoice could not be opened", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download invoice" })).toHaveCount(0);
  f.state.readFailure = false;
  await page.getByRole("button", { name: "Retry invoice" }).click();
  await expect(page.getByRole("heading", { name: f.paper.invoiceNumber })).toBeVisible();
  await page.getByRole("link", { name: "View order details" }).click();
  await expect(page).toHaveURL(new RegExp(`/purchase/orders/${f.buyer.order.id}$`));
});
test("invalid PDF cannot open sharing and a valid retry succeeds", async ({ page }) => {
  const f = await fixture(page);
  f.state.invalidPdf = true;
  await page.goto(`/purchase/invoices/${f.paper.id}`);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(
    page.getByText("We could not prepare this document.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  f.state.invalidPdf = false;
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Share invoice" })).toBeVisible();
});
test("buyer change closes an already prepared private document", async ({ page }) => {
  const f = await fixture(page);
  await page.goto(`/purchase/invoices/${f.paper.id}`);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  f.buyer.buyerReference = id(93);
  f.buyer.email = "another-synthetic-buyer@example.test";
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "aat:purchase-access:changed",
        newValue: "changed",
      }),
    ),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Synthetic guest buyer", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("This invoice could not be opened", { exact: false }),
  ).toBeVisible();
});

test("mismatched billing identity never renders an invoice or export controls", async ({
  page,
}) => {
  const f = await fixture(page);
  f.paper.billTo.reference = id(96);
  await page.goto(`/purchase/invoices/${f.paper.id}`);
  await expect(
    page.getByText("This invoice could not be opened", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download invoice" })).toHaveCount(0);
  await expect(page.getByText("Synthetic guest buyer", { exact: true })).toHaveCount(0);
});
test("revocation clears the private invoice before preparing a share", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto(`/purchase/invoices/${f.paper.id}`);
  await expect(page.getByRole("heading", { name: f.paper.invoiceNumber })).toBeVisible();
  f.buyer.access = false;
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Continue with your email" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.state.downloads).toBe(0);
});
test("verified guest payment offers a private receipt without claiming collection readiness", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const buyer = await purchaseFixture(page);
  buyer.payment.status = "SUCCEEDED";
  buyer.order.paidAt = new Date().toISOString();
  await page.route(
    `**/api/v1/purchase/payments/${buyer.payment.id}/receipt/download`,
    (route) =>
      route.fulfill({
        contentType: "application/pdf",
        headers: {
          "X-Document-Id": buyer.payment.id,
          "X-Document-Type": "receipt",
          "Content-Disposition": 'attachment; filename="receipt-SYNTHETIC-83.pdf"',
        },
        body: "%PDF-synthetic-receipt",
      }),
  );
  await page.goto(`/purchase/payments/${buyer.payment.id}`);
  await expect(page.getByRole("heading", { name: "Payment receipt" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("receipt-SYNTHETIC-83.pdf");
  await expect(
    page.getByText("Wait for a ready-for-collection confirmation", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(buyer.writes).toEqual([]);
});
