import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { servicePaymentFixture } from "../fixtures/service-payment";
import { invoiceId } from "../fixtures/customer-invoices";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { workInvoiceDetailFixture, id as staffId } from "../fixtures/work-invoice-detail";
import { invoiceRow, workInvoiceFixture, sourceRow } from "../fixtures/work-invoices";
import { verifyConsole } from "../fixtures/preview-console";
const path = `/dashboard/invoices/${invoiceId(1)}`;
for (const additional of [false, true])
  for (const width of [320, 1440]) {
    test(`${additional ? "supplemental invoice " : ""}materials then workmanship remain distinct after save and refresh at ${width}px`, async ({
      page,
    }, info) => {
      const f = await servicePaymentFixture(page, additional),
        errors: string[] = [],
        warnings: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.type() === "warning") warnings.push(m.text());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      if (additional) {
        await expect(
          page.getByRole("region", { name: "Additional service invoice", exact: true }),
        ).toContainText("INV-ORIGINAL-SYNTHETIC");
        await expect(
          page.getByRole("region", { name: "Additional service invoice", exact: true }),
        ).toContainText("Synthetic separately agreed extra work");
        await expect(
          page.getByRole("link", { name: "View booking & quotation", exact: true }),
        ).toHaveAttribute(
          "href",
          `/dashboard/bookings/${f.invoice.additionalQuote!.booking.id}`,
        );
      }
      await expect(
        page.getByRole("heading", { name: "Workshop payment stages", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/has not recorded completion/)).toBeVisible();
      await page.screenshot({
        path: info.outputPath(
          `service-stage-overview-${additional ? "supplemental-" : ""}${width}.png`,
        ),
      });
      await page
        .getByRole("button", { name: "Prepare materials payment", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Materials");
      expect(f.writes).toHaveLength(0);
      await dialog.getByRole("button", { name: "Go back", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Prepare materials payment", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Prepare materials payment", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Create payment request", exact: true })
        .click();
      await expect(
        page.getByText("Payment request ready: SYNTHETIC-MATERIALS", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: "Review payment & checkout options",
          exact: true,
        }),
      ).toBeFocused();
      expect(f.writes).toHaveLength(1);
      expect(f.writes[0]!.body).toMatchObject({
        acceptedServiceStage: {
          stage: "MATERIALS",
          invoiceVersion: 1,
          amountKobo: "10750",
        },
      });
      expect(f.writes[0]!.csrf).toBeTruthy();
      await page.reload();
      await expect(page.getByText(/request is already in progress/)).toBeVisible();
      expect(f.writes).toHaveLength(1);
      await expect(
        page.getByRole("button", { name: "Prepare workmanship payment", exact: true }),
      ).toHaveCount(0);
      f.invoice.version = 2;
      f.invoice.payments[0]!.status = "SUCCEEDED";
      f.invoice.payments[0]!.succeededAt = "2026-11-09T08:00:00Z";
      Object.assign(f.invoice.servicePayment!.materials, { recordedKobo: "10750" });
      f.invoice.servicePayment!.paymentPending = false;
      await page.reload();
      await expect(page.getByText(/has not recorded completion/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Prepare workmanship payment", exact: true }),
      ).toHaveCount(0);
      f.invoice.servicePayment!.workCompleted = true;
      f.invoice.servicePayment!.nextPayment = {
        stage: "WORKMANSHIP",
        invoiceVersion: 2,
        amountKobo: "10750",
      };
      await page.reload();
      await page
        .getByRole("button", { name: "Prepare workmanship payment", exact: true })
        .click();
      await expect(dialog).toContainText("Workmanship and fees");
      await page.screenshot({
        path: info.outputPath(
          `service-stages-${additional ? "supplemental-" : ""}${width}.png`,
        ),
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await dialog
        .getByRole("button", { name: "Create payment request", exact: true })
        .click();
      await expect(
        page.getByText("Payment request ready: SYNTHETIC-WORKMANSHIP", { exact: true }),
      ).toBeVisible();
      expect(f.writes).toHaveLength(2);
      expect(f.writes[1]!.body).toMatchObject({
        acceptedServiceStage: {
          stage: "WORKMANSHIP",
          invoiceVersion: 2,
          amountKobo: "10750",
        },
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await verifyConsole(page, errors, warnings);
      expect(f.base.writes).toEqual([]);
    });
  }
test("uncertain materials intent reuses its original stage and key", async ({ page }) => {
  const f = await servicePaymentFixture(page);
  f.mode = "lost";
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(path);
  await page
    .getByRole("button", { name: "Prepare materials payment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Create payment request", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Retry same request", exact: true }).click();
  await expect(
    page.getByText("Payment request ready: SYNTHETIC-MATERIALS", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(2);
  expect(f.writes[0]!.key).toBeTruthy();
  expect(f.writes[1]!.key).toBe(f.writes[0]!.key);
  expect(f.writes[1]!.body).toEqual(f.writes[0]!.body);
  expect(f.invoice.payments).toHaveLength(1);
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options", exact: true }),
  ).toBeFocused();
});
test("financial review removes the next charge without hiding recorded materials", async ({
  page,
}) => {
  const f = await servicePaymentFixture(page);
  f.invoice.servicePayment!.financialReviewRequired = true;
  f.invoice.servicePayment!.nextPayment = null;
  await page.goto(path);
  await expect(page.getByText(/adjustment needs staff review/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare materials payment", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
test("closed public payment gate preserves the invoice and disables a new request", async ({
  page,
}) => {
  const f = await servicePaymentFixture(page);
  await page.route("**/api/v1/public/capabilities", (r) =>
    r.fulfill({
      json: {
        success: true,
        message: "Synthetic disabled gate",
        data: publicCapabilitiesFixture("browse_enquiries"),
        meta: { requestId: "synthetic-disabled-gate" },
      },
    }),
  );
  await page.goto(path);
  await expect(
    page.getByText(
      "New payments are currently unavailable. Your invoice and recorded payments remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare materials payment", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toEqual([]);
});
for (const additional of [false, true])
  for (const [role, width] of [
    ["ADMIN", 320],
    ["SUPER_ADMIN", 1440],
  ] as const) {
    test(`${additional ? "supplemental invoice " : ""}${role} reads the same service stage split and complete invoice paper at ${width}px`, async ({
      page,
    }, info) => {
      const f = await workInvoiceDetailFixture(page, role);
      const errors: string[] = [],
        warnings: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.type() === "warning") warnings.push(m.text());
      });
      f.invoice = {
        ...invoiceRow(1),
        id: f.invoice.id,
        servicePayment: {
          materials: { totalKobo: "5375000", recordedKobo: "0" },
          workmanship: { totalKobo: "5375000", recordedKobo: "0" },
          workCompleted: false,
          financialReviewRequired: false,
          paymentPending: false,
          nextPayment: { stage: "MATERIALS", invoiceVersion: 1, amountKobo: "5375000" },
        },
      };
      if (additional)
        f.invoice = {
          ...f.invoice,
          booking: null,
          additionalQuote: {
            id: staffId(501),
            quoteNumber: "SYNTHETIC-ADDITION",
            amendmentReason: "Synthetic separately agreed extra work",
            originalInvoice: { invoiceNumber: "INV-ORIGINAL-SYNTHETIC" },
            booking: f.invoice.booking!,
          },
        };
      const allocation = {
        subtotalKobo: "5000000",
        taxKobo: "375000",
        creditKobo: "0",
        totalKobo: "5375000",
      };
      f.paperPatch = {
        lines: ["Synthetic materials", "Synthetic workmanship"].map((description) => ({
          description,
          quantity: 1,
          unitPriceKobo: "5000000",
          subtotalKobo: "5000000",
        })),
        servicePaymentPlan: {
          version: 1,
          quoteId: staffId(501),
          quoteVersion: 1,
          rule: "SAVED_QUOTE_TOTALS_LARGEST_REMAINDER",
          feeTiming: "DEFER_UNTIL_WORK_COMPLETED",
          materials: allocation,
          workmanship: allocation,
          lines: [
            { quoteItemId: staffId(502), stage: "MATERIALS", ...allocation },
            { quoteItemId: staffId(503), stage: "WORKMANSHIP", ...allocation },
          ],
        },
      };
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/admin/invoices/${f.invoice.id}`);
      if (additional)
        await expect(
          page.getByRole("region", { name: "Additional service invoice", exact: true }),
        ).toContainText("INV-ORIGINAL-SYNTHETIC");
      const summary = page.getByRole("region", { name: "Workshop payment stages" });
      await expect(summary).toContainText("Materials payments recorded");
      await expect(
        page.getByRole("region", { name: "Invoice document preview" }),
      ).toContainText("Materials stage, including VAT and credits");
      await page.screenshot({
        path: info.outputPath(
          `staff-service-first-${additional ? "supplemental-" : ""}${width}.png`,
        ),
      });
      await summary.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(
          `staff-service-stages-${additional ? "supplemental-" : ""}${width}.png`,
        ),
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-label="Workshop payment stages"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(f.writes).toEqual([]);
      await verifyConsole(page, errors, warnings);
    });
  }

for (const [width, mode] of [
  [320, "wrong-source"],
  [1440, "normal"],
] as const) {
  test(`supplemental invoice draft creation and ${mode} recovery at ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
      if (m.type() === "warning") warnings.push(m.text());
    });
    const f = await workInvoiceFixture(page);
    const source = {
      ...sourceRow(0, "SERVICE_ADDITION"),
      reference: "SYNTHETIC-ADDITION",
      label: "SYNTHETIC-ADDITION ? Additional work for INV-ORIGINAL-SYNTHETIC",
    };
    f.sources = [source];
    f.records = [];
    f.writeMode = mode;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/invoices?create=1");
    await page
      .getByLabel("Invoice source type", { exact: true })
      .selectOption("SERVICE_ADDITION");
    await page.getByLabel("Source record", { exact: true }).selectOption(source.id);
    await page.getByRole("button", { name: "Review draft invoice", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("INV-ORIGINAL-SYNTHETIC");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    expect(f.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Review draft invoice", exact: true }).click();
    await page.getByRole("button", { name: "Create draft invoice", exact: true }).click();
    if (mode === "wrong-source") {
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
        "outcome could not be confirmed",
      );
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Review draft invoice", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Load current source invoice", exact: true })
        .click();
      await expect(
        page.getByRole("link", { name: "View current invoice", exact: true }),
      ).toHaveAttribute("href", `/admin/invoices/${staffId(199001)}`);
    } else
      await expect(
        page.getByRole("heading", { name: "Draft invoice created", exact: true }),
      ).toBeFocused();
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].body).toEqual({
      sourceType: "SERVICE_ADDITION",
      sourceId: source.id,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath(`supplemental-draft-${width}.png`) });
    await verifyConsole(page, errors, warnings);
  });
}

for (const changed of ["quotation", "booking", "original invoice", "reason"] as const)
  test(`supplemental payment refuses changed ${changed} before any request is sent`, async ({
    page,
  }) => {
    const f = await servicePaymentFixture(page, true),
      errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
      if (m.type() === "warning") warnings.push(m.text());
    });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(path);
    await page
      .getByRole("button", { name: "Prepare materials payment", exact: true })
      .click();
    const addition = f.invoice.additionalQuote!;
    if (changed === "quotation") addition.id = invoiceId(999);
    else if (changed === "booking") addition.booking.id = invoiceId(998);
    else if (changed === "original invoice")
      addition.originalInvoice.invoiceNumber = "SYNTHETIC-CHANGED-ORIGINAL";
    else addition.amendmentReason = "Synthetic changed agreement reason";
    await page
      .getByRole("button", { name: "Create payment request", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "This record has changed. Refresh it and review the latest details.",
    );
    expect(f.writes).toHaveLength(0);
    await verifyConsole(page, errors, warnings);
  });
