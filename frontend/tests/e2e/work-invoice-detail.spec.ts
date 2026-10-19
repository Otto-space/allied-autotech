import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInvoiceDetailFixture, id } from "../fixtures/work-invoice-detail";
const path = `/admin/invoices/${id(190000)}`,
  button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function review(page: Page, action = "issue") {
  await button(page, `Review invoice ${action}`).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} sees named invoice, complete paper and truthful source/payment facts`, async ({
    page,
  }) => {
    const f = await workInvoiceDetailFixture(page, role);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: f.invoice.invoiceNumber, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Invoice document preview" }),
    ).toContainText("DRAFT — NOT ISSUED");
    await expect(page.locator(".wid-paper")).toContainText("Recorded replacement part");
    await expect(page.locator(".wid-lifecycle")).toContainText("09:00:37.123");
    await expect(page.locator(".wid-breadcrumb li")).toHaveCount(3);
    expect(f.writes).toHaveLength(0);
  });
test("cancel preserves focus and makes no extra reads; issue and void validate exact receipts", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  await page.goto(path);
  await review(page);
  const reads = f.reads.length;
  await button(page, "Go back").click();
  await expect(button(page, "Review invoice issue")).toBeFocused();
  expect(f.reads.length).toBe(reads);
  await review(page);
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Invoice issued", exact: true }),
  ).toBeFocused();
  expect(f.writes).toEqual([{ action: "issue", body: { expectedVersion: 0 } }]);
  await review(page, "void");
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Invoice voided", exact: true }),
  ).toBeFocused();
  expect(f.writes[1]).toEqual({ action: "void", body: { expectedVersion: 1 } });
  await expect(button(page, "Review invoice issue")).toHaveCount(0);
});
for (const mode of ["lost", "wrong-version", "wrong-total", "rate"])
  test(`${mode} outcome retains its lock across reload and never replays`, async ({
    page,
  }) => {
    const f = await workInvoiceDetailFixture(page);
    f.writeMode = mode;
    await page.goto(path);
    await review(page);
    await button(page, "Confirm change").click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "outcome could not be confirmed",
    );
    await button(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", { name: "Invoice change needs checking" }),
    ).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Invoice change needs checking" }),
    ).toBeVisible();
    await button(page, "Load current invoice").click();
    await expect(
      page.getByRole("heading", { name: "Current invoice facts" }),
    ).toBeFocused();
    expect(f.writes).toHaveLength(1);
    await expect(
      button(page, mode === "rate" ? "Review invoice issue" : "Review invoice void"),
    ).toBeDisabled();
  });
test("current changes during review prevent dispatch", async ({ page }) => {
  const f = await workInvoiceDetailFixture(page);
  await page.goto(path);
  await review(page);
  f.invoice.version++;
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(
    page.getByRole("heading", { name: "Current invoice facts" }),
  ).toBeFocused();
});
for (const mode of ["error", "inactive", "mismatch", "denied"])
  test(`own-profile ${mode} blocks protected reads`, async ({ page }) => {
    const f = await workInvoiceDetailFixture(page);
    f.base.profileMode = mode;
    await page.goto(path);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.paperReads).toHaveLength(0);
  });
test("Staff has no invoice actions or financial reads", async ({ page }) => {
  const f = await workInvoiceDetailFixture(page, "STAFF");
  await page.goto(path);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Administrator access",
  );
  expect(f.reads).toHaveLength(0);
  expect(f.paperReads).toHaveLength(0);
});
for (const mode of ["error", "mismatch", "malformed"])
  test(`document ${mode} stays distinct from invoice facts and disables export`, async ({
    page,
  }) => {
    const f = await workInvoiceDetailFixture(page);
    f.paperMode = mode;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: f.invoice.invoiceNumber, exact: true }),
    ).toBeVisible();
    await expect(button(page, "Download invoice")).toBeDisabled();
    await expect(button(page, "Review invoice issue")).toBeEnabled();
    await expect(
      page
        .locator(".wid-document")
        .getByRole("alert")
        .or(page.getByText("Previously loaded document.", { exact: false })),
    ).toBeVisible();
  });
test("successful linked payment prevents void and a request is never labelled a receipt", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  f.invoice.status = "ISSUED";
  f.invoice.issuedAt = f.invoice.createdAt;
  f.invoice.payments = [
    {
      id: id(199000),
      paymentNumber: "PAY-RECORDED",
      currency: "NGN",
      status: "SUCCEEDED",
      amountKobo: f.invoice.totalKobo,
      succeededAt: f.invoice.createdAt,
    },
  ];
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "PAY-RECORDED", exact: true }),
  ).toBeVisible();
  await expect(button(page, "Review invoice void")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Confirmed receipt records" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("download is version-bound and sharing uses a private staff link", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  await page.goto(path);
  const download = page.waitForEvent("download");
  await button(page, "Download invoice").click();
  expect((await download).suggestedFilename()).toBe("invoice-synthetic.pdf");
  expect(f.pdfReads[0].searchParams.get("expectedVersion")).toBe("0");
  expect(f.pdfReads[0].searchParams.get("expectedStatus")).toBe("DRAFT");
  await button(page, "Share invoice").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Private invoice link")).toHaveValue(
    new RegExp(`/admin/invoices/${id(190000)}$`),
  );
  await expect(page.getByRole("dialog")).toContainText("does not grant access");
  await button(page, "Close sharing").click();
  await expect(button(page, "Share invoice")).toBeFocused();
  expect(f.writes).toHaveLength(0);
});
for (const mode of [
  "wrong-id",
  "wrong-version",
  "wrong-status",
  "wrong-type",
  "bad-magic",
])
  test(`PDF ${mode} is rejected before offering a file`, async ({ page }) => {
    const f = await workInvoiceDetailFixture(page);
    f.pdfMode = mode;
    let downloads = 0;
    page.on("download", () => downloads++);
    await page.goto(path);
    await button(page, "Download invoice").click();
    await expect(page.locator(".document-actions").getByRole("alert")).toBeVisible();
    expect(downloads).toBe(0);
    expect(f.writes).toHaveLength(0);
  });
test("document denial removes protected paper and invoice facts", async ({ page }) => {
  const f = await workInvoiceDetailFixture(page);
  f.paperMode = "denied";
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Invoice access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".wid-paper")).toHaveCount(0);
  await expect(button(page, "Review invoice issue")).toHaveCount(0);
});
test("recovery lock clearing is deliberate and never sends the original request again", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  f.writeMode = "lost";
  await page.goto(path);
  await review(page);
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await button(page, "Close & review record").click();
  await button(page, "Load current invoice").click();
  await expect(button(page, "Clear reconciled lock")).toBeDisabled();
  await page.getByLabel("I have independently reconciled", { exact: false }).check();
  await button(page, "Clear reconciled lock").click();
  await expect(button(page, "Review invoice void")).toBeEnabled();
  expect(f.writes).toHaveLength(1);
});
test("redacted markers retain a lock and describe current facts without claiming an original result", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  await page.goto(path);
  await expect(button(page, "Review invoice issue")).toBeEnabled();
  await page.evaluate(() =>
    sessionStorage.setItem(
      "aat:staff-invoice-transition:v1:d1000000-0000-4000-8000-000000000302:ADMIN",
      "pending",
    ),
  );
  await page.reload();
  await expect(
    page.getByText("The original reference was redacted", { exact: false }),
  ).toBeVisible();
  await expect(button(page, "Review invoice issue")).toBeDisabled();
  await button(page, "Load current invoice").click();
  await expect(
    page.getByRole("heading", { name: "Current invoice facts" }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(0);
});
test("blocked recovery storage prevents dispatch", async ({ page }) => {
  const f = await workInvoiceDetailFixture(page);
  await page.goto(path);
  await review(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("access revoked while preparing a PDF clears the page and never offers the file", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  f.pdfMode = "hold";
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.goto(path);
  await button(page, "Download invoice").click();
  await expect.poll(() => !!f.held).toBe(true);
  await expect(button(page, "Review invoice issue")).toBeDisabled();
  f.base.profileMode = "denied";
  f.held!();
  await expect(
    page.getByRole("heading", { name: "Invoice access is unavailable" }),
  ).toBeVisible();
  expect(downloads).toBe(0);
  expect(f.writes).toHaveLength(0);
});
test("recorded discounts and delivery are shown once in the document arithmetic", async ({
  page,
}) => {
  const f = await workInvoiceDetailFixture(page);
  f.paperPatch = {
    lines: [
      {
        description: "Recorded part",
        quantity: 1,
        unitPriceKobo: "10200000",
        subtotalKobo: "10200000",
      },
    ],
    discountKobo: "300000",
    deliveryKobo: "100000",
  };
  await page.goto(path);
  await expect(button(page, "Download invoice")).toBeEnabled();
  const facts = page.locator(".wid-paper-totals");
  await expect(facts).toContainText("Line subtotal");
  await expect(
    facts.locator("dt", { hasText: /^Subtotal$/ }).locator("+dd"),
  ).toContainText("100,000.00");
  await expect(
    facts.locator("dt", { hasText: /^Discount applied$/ }).locator("+dd"),
  ).toContainText("−₦3,000.00");
  await expect(
    facts.locator("dt", { hasText: /^Invoice total$/ }).locator("+dd"),
  ).toContainText("107,500.00");
});
for (const width of [320, 375, 430, 768, 1024, 1280, 1440])
  test(`complete invoice detail fits ${width}px and passes serious Axe checks`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1050 });
    await workInvoiceDetailFixture(page);
    await page.goto(path);
    await expect(
      page.getByRole("region", { name: "Invoice document preview" }),
    ).toBeVisible();
    await expect(button(page, "Download invoice")).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
  });
