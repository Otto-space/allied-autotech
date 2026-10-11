import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { InvoiceDocument } from "../../lib/api/document-schemas";
const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const initialDocument = (): InvoiceDocument => ({
  schemaVersion: 1,
  id: id(1),
  invoiceNumber: "AA-INV-2041",
  currency: "NGN",
  status: "ISSUED",
  version: 1,
  issuedAt: "2026-10-08T09:00:00Z",
  dueAt: "2099-10-15T09:00:00Z",
  paidAt: null,
  issuer: {
    name: "Allied AutoTech",
    address: "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    paymentTerms: "",
  },
  billTo: {
    name: "Synthetic Customer",
    address: "Port Harcourt, Nigeria",
    reference: id(2),
  },
  source: {
    type: "BOOKING",
    id: id(3),
    reference: "AA-QUOTE-2041",
    description: "Service booking",
  },
  lines: [
    {
      description: "Diagnostic inspection",
      quantity: 1,
      unitPriceKobo: "2500000",
      subtotalKobo: "2500000",
    },
    {
      description: "Maintenance labour",
      quantity: 1,
      unitPriceKobo: "6000000",
      subtotalKobo: "6000000",
    },
  ],
  discountKobo: "0",
  deliveryKobo: "0",
  detailBasis: "SNAPSHOT",
  subtotalKobo: "8500000",
  taxKobo: "637500",
  depositCreditKobo: "0",
  totalKobo: "9137500",
  receipts: [],
  paymentRequests: [],
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic document",
      data,
      meta: { requestId: "invoice-quality" },
    },
  });
async function fixture(page: Page) {
  const state = {
    document: initialDocument(),
    reads: 0,
    writes: [] as { key?: string; body: unknown }[],
    downloads: [] as string[],
    mode: "success",
    readStatus: 200,
    documentStatus: 200,
    downloadStatus: 200,
    role: "CUSTOMER",
    signedIn: true,
    mismatch: false,
    changeOnReview: false,
    paid: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return state.signedIn
        ? reply(route, {
            id: id(11),
            mfaRequired: false,
            mfaVerifiedAt: null,
            user: { id: id(2), email: "invoice@example.test", role: state.role },
          })
        : route.fulfill({
            status: 401,
            json: { success: false, error: { code: "UNAUTHORIZED" } },
          });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "synthetic-invoice-csrf-".repeat(4) });
    if (endpoint === `/customers/invoices/${id(1)}`) {
      state.reads++;
      if (state.readStatus !== 200)
        return route.fulfill({
          status: state.readStatus,
          json: {
            success: false,
            error: {
              code: state.readStatus === 404 ? "NOT_FOUND" : "DATABASE_UNAVAILABLE",
              message: "private diagnostic",
            },
          },
        });
      return reply(route, {
        ...state.document,
        id: state.mismatch ? id(9) : id(1),
        createdAt: state.document.issuedAt,
        version:
          state.document.version + (state.changeOnReview && state.reads > 1 ? 1 : 0),
        order: null,
        booking: { id: id(3) },
        vehicleTransaction: null,
        payments: state.paid
          ? [
              {
                id: id(4),
                paymentNumber: "AA-PAY-2041",
                status: "SUCCEEDED",
                amountKobo: "9137500",
                succeededAt: state.document.issuedAt,
              },
            ]
          : [],
      });
    }
    if (endpoint === `/customers/invoices/${id(1)}/document`)
      return state.documentStatus === 200
        ? reply(route, state.document)
        : route.fulfill({
            status: state.documentStatus,
            json: { success: false, error: { code: "NOT_FOUND" } },
          });
    if (
      endpoint.endsWith("/download") ||
      endpoint === `/customers/payments/${id(4)}/receipt`
    ) {
      state.downloads.push(endpoint);
      if (state.downloadStatus !== 200)
        return route.fulfill({
          status: state.downloadStatus,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      const receipt = endpoint.endsWith("/receipt"),
        kind = receipt ? "receipt" : "invoice";
      return route.fulfill({
        body: Buffer.from("%PDF-synthetic-browser-fixture"),
        headers: {
          "content-type": "application/pdf",
          "x-document-type": kind,
          "x-document-id": receipt ? id(4) : id(1),
          "content-disposition": `attachment; filename="${kind}-AA-2041.pdf"`,
        },
      });
    }
    if (endpoint === "/customers/payments" && route.request().method() === "POST") {
      state.writes.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      if (state.mode === "uncertain" && state.writes.length === 1)
        return route.abort("failed");
      if (state.mode === "conflict")
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "PAYMENT_TARGET_PENDING" } },
        });
      return reply(route, {
        payment: {
          id: id(4),
          paymentNumber: "AA-PAY-2041",
          amountKobo: state.mode === "wrong-amount" ? "1" : "9137500",
          currency: "NGN",
          status: "REQUIRES_PAYMENT",
          purpose: "SERVICE_INVOICE",
          invoiceId: id(1),
          orderId: null,
          vehicleTransactionId: null,
          bookingId: null,
          expiresAt: "2099-10-15T09:00:00Z",
          attempts: [],
        },
      });
    }
    if (endpoint === "/customers/payments") return reply(route, { items: [] });
    if (endpoint === "/customers/profile")
      return reply(route, {
        firstName: "Synthetic",
        lastName: "Customer",
        phone: "08100000000",
        address: null,
        city: null,
        state: null,
        country: "Nigeria",
        avatarUrl: null,
      });
    if (endpoint === "/notifications") return reply(route, { items: [], unreadCount: 0 });
    if (endpoint === "/public/branches") return reply(route, { items: [] });
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" } },
    });
  });
  return state;
}
const visit = async (page: Page) => {
  await page.goto(`/dashboard/invoices/${id(1)}`);
  await expect(
    page.getByRole("heading", { name: "Invoice details", exact: true }),
  ).toBeVisible();
};
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`invoice document remains readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture(page);
    await visit(page);
    await expect(
      page.getByRole("button", { name: "Download invoice", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "AA-INV-2041", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      await page
        .getByRole("button", { name: "Download invoice", exact: true })
        .evaluate((node) => node.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    if ([390, 768, 1440].includes(width))
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    expect(errors).toEqual([]);
  });
test("downloads the authenticated invoice PDF", async ({ page }) => {
  const state = await fixture(page);
  await visit(page);
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download invoice", exact: true }).click();
  const file = await waiting;
  expect(file.suggestedFilename()).toBe("invoice-AA-2041.pdf");
  expect(state.downloads).toHaveLength(1);
  expect(state.writes).toHaveLength(0);
});
test("offers private link and PDF fallback when native sharing is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  await fixture(page);
  await visit(page);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("heading", { name: "Share invoice" })).toBeVisible();
  await expect(modal.getByLabel("Account link", { exact: true })).toHaveValue(
    new RegExp(`/dashboard/invoices/${id(1)}$`),
  );
  await expect(modal.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Share PDF", exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share invoice", exact: true }),
  ).toBeFocused();
});
for (const cancel of [false, true])
  test(`native sharing ${cancel ? "cancels honestly" : "uses a PDF file"}`, async ({
    page,
  }) => {
    await page.addInitScript((cancel) => {
      Object.defineProperty(navigator, "canShare", {
        value: () => true,
        configurable: true,
      });
      Object.defineProperty(navigator, "share", {
        value: async (data: ShareData) => {
          if (cancel) throw new DOMException("Cancelled", "AbortError");
          if (data.files?.[0]?.type !== "application/pdf")
            throw new Error("Expected PDF");
        },
        configurable: true,
      });
    }, cancel);
    await fixture(page);
    await visit(page);
    await page.getByRole("button", { name: "Share invoice", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Share PDF", exact: true })
      .click();
    await expect(
      page.getByText(cancel ? "Sharing cancelled." : "Share action completed.", {
        exact: true,
      }),
    ).toBeVisible();
  });
test("confirmed payments expose receipt downloads and completed refunds", async ({
  page,
}) => {
  const state = await fixture(page);
  state.paid = true;
  state.document.status = "PAID";
  state.document.paidAt = state.document.issuedAt;
  state.document.receipts = [
    {
      paymentId: id(4),
      paymentNumber: "AA-PAY-2041",
      amountKobo: "9137500",
      confirmedAt: state.document.issuedAt!,
      refundedKobo: "100000",
    },
  ];
  await visit(page);
  await expect(page.getByText(/Completed refunds:/)).toBeVisible();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt", exact: true }).click();
  expect((await waiting).suggestedFilename()).toBe("receipt-AA-2041.pdf");
  await expect(page.getByRole("button", { name: "Prepare invoice payment" })).toHaveCount(
    0,
  );
});
test("unconfirmed invoices never offer receipts", async ({ page }) => {
  await fixture(page);
  await visit(page);
  await expect(
    page.getByText("A receipt becomes available after a payment is confirmed."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download receipt", exact: true }),
  ).toHaveCount(0);
});
test("payment preparation reviews and rechecks before posting the server target", async ({
  page,
}) => {
  const state = await fixture(page);
  await visit(page);
  await page.getByRole("button", { name: "Prepare invoice payment" }).click();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create payment request" })
    .click();
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options" }),
  ).toHaveAttribute("href", `/dashboard/payments/${id(4)}`);
  expect(state.reads).toBeGreaterThanOrEqual(2);
  expect(state.writes[0]?.body).toEqual({
    targetType: "INVOICE",
    targetId: id(1),
    purpose: "SERVICE_INVOICE",
  });
});
test("changed invoice blocks payment creation", async ({ page }) => {
  const state = await fixture(page);
  state.changeOnReview = true;
  await visit(page);
  await page.getByRole("button", { name: "Prepare invoice payment" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create payment request" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("uncertain payment preparation retries the identical key and body", async ({
  page,
}) => {
  const state = await fixture(page);
  state.mode = "uncertain";
  await visit(page);
  await page.getByRole("button", { name: "Prepare invoice payment" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create payment request" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry same request" })
    .click();
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
});
test("wrong payment amount never produces a successful handoff", async ({ page }) => {
  const state = await fixture(page);
  state.mode = "wrong-amount";
  await visit(page);
  await page.getByRole("button", { name: "Prepare invoice payment" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create payment request" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Retry same request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options" }),
  ).toHaveCount(0);
});
for (const status of ["VOID", "PAID"] as const)
  test(`${status} invoice cannot prepare another payment`, async ({ page }) => {
    const state = await fixture(page);
    state.document.status = status;
    await visit(page);
    await expect(
      page.getByRole("button", { name: "Download invoice", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Prepare invoice payment" }),
    ).toHaveCount(0);
  });
test("mismatched invoice identity is not displayed", async ({ page }) => {
  const state = await fixture(page);
  state.mismatch = true;
  await visit(page);
  await expect(page.locator(".invoice-detail").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toHaveCount(0);
});
test("failed refresh disables stale document actions", async ({ page }) => {
  const state = await fixture(page);
  await visit(page);
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeEnabled();
  state.readStatus = 503;
  await page.getByRole("button", { name: "Refresh invoice" }).click();
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Prepare invoice payment" }),
  ).toBeDisabled();
});
test("unavailable document keeps invoice totals and hides export capability", async ({
  page,
}) => {
  const state = await fixture(page);
  state.documentStatus = 404;
  await visit(page);
  await expect(
    page.getByRole("heading", { name: "AA-INV-2041", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeDisabled();
});
test("download failure gives a retryable message without claiming success", async ({
  page,
}) => {
  const state = await fixture(page);
  state.downloadStatus = 404;
  await visit(page);
  await page.getByRole("button", { name: "Download invoice", exact: true }).click();
  await expect(page.locator(".invoice-detail").getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Download started. Check your browser’s downloads."),
  ).toHaveCount(0);
});
test("account changes discard a prepared private file and sharing dialog", async ({
  page,
}) => {
  const state = await fixture(page);
  await visit(page);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "AA-INV-2041", exact: true }),
  ).toHaveCount(0);
});

test("long references and descriptions wrap without hiding amounts", async ({ page }) => {
  const state = await fixture(page);
  state.document.invoiceNumber = "INV-20261008-ABCDEFGHIJKLMNOPQRSTUV0123456789";
  state.document.lines[0].description = "VehicleDiagnosticReference".repeat(20);
  state.document.billTo.name = "Synthetic customer with a long company account name";
  await page.setViewportSize({ width: 320, height: 700 });
  await visit(page);
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator(".invoice-lines")).toContainText("25,000.00");
});
test("inconsistent document totals disable downloads without replacing invoice amounts", async ({
  page,
}) => {
  const state = await fixture(page);
  state.document.lines[0].subtotalKobo = "1";
  await visit(page);
  await expect(page.locator(".invoice-detail").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".invoice-amount")).toContainText("91,375.00");
});
test("expired invoice does not offer payment preparation", async ({ page }) => {
  const state = await fixture(page);
  state.document.dueAt = "2020-01-01T00:00:00Z";
  await visit(page);
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Prepare invoice payment" })).toHaveCount(
    0,
  );
});
test("legacy invoice states the limit of its recorded breakdown", async ({ page }) => {
  const state = await fixture(page);
  state.document.detailBasis = "LEGACY_SUMMARY";
  state.document.lines = [
    {
      description: "Recorded invoice subtotal",
      quantity: 1,
      unitPriceKobo: "8500000",
      subtotalKobo: "8500000",
    },
  ];
  await visit(page);
  await expect(
    page.getByText(
      "A historical itemized breakdown is unavailable. The recorded invoice subtotal and adjustments are shown.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download invoice", exact: true }),
  ).toBeEnabled();
});
test("sharing remains keyboard accessible on a short mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await fixture(page);
  await visit(page);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("button", { name: "Close sharing" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate((node) => node.contains(document.activeElement))).toBe(
    true,
  );
  expect(
    await modal.evaluate((node) => node.getBoundingClientRect().height <= innerHeight),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Share invoice", exact: true }),
  ).toBeFocused();
});

test("restricted share detection keeps download fallback available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {},
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => {
        throw new DOMException("Restricted", "SecurityError");
      },
    });
  });
  await fixture(page);
  await visit(page);
  await page.getByRole("button", { name: "Share invoice", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Download PDF" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Share PDF", exact: true })).toHaveCount(
    0,
  );
});

test("source-linked payment requests appear even without a direct invoice payment", async ({
  page,
}) => {
  const state = await fixture(page);
  state.document.paymentRequests = [
    {
      id: id(4),
      paymentNumber: "AA-ORDER-PAY-2041",
      status: "REQUIRES_REVIEW",
      amountKobo: "9137500",
      succeededAt: null,
    },
  ];
  await visit(page);
  await expect(page.getByRole("link", { name: "AA-ORDER-PAY-2041" })).toHaveAttribute(
    "href",
    `/dashboard/payments/${id(4)}`,
  );
  await expect(page.getByRole("button", { name: "Prepare invoice payment" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Download receipt", exact: true }),
  ).toHaveCount(0);
});
