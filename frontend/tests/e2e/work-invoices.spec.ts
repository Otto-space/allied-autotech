import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workInvoiceFixture, invoiceRow, sourceRow, id } from "../fixtures/work-invoices";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true });
async function review(p: Page, sourceId = id(195000)) {
  await p.getByLabel("Source record", { exact: true }).selectOption(sourceId);
  await button(p, "Review draft invoice").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} has scoped invoice discovery and complete expandable records`, async ({
    page,
  }) => {
    const f = await workInvoiceFixture(page, role);
    await page.goto("/admin/invoices");
    await expect(page.locator(".iv-record")).toHaveCount(3);
    await expect(
      page.getByRole("heading", { name: "Invoices", exact: true }),
    ).toHaveCount(1);
    await page
      .locator(".iv-record")
      .first()
      .getByRole("button", { name: "Details", exact: true })
      .click();
    await expect(page.locator(".iv-details")).toContainText(id(191000));
    await expect(page.locator(".iv-details")).toContainText("09:00:37.123");
    await expect(page.locator(".iv-details")).toContainText("No linked payment records");
    expect(f.writes).toHaveLength(0);
  });
for (const mode of ["error", "inactive", "mismatch", "denied"])
  test(`own-profile ${mode} prevents protected invoice reads`, async ({ page }) => {
    const f = await workInvoiceFixture(page);
    f.profileMode = mode;
    await page.goto("/admin/invoices");
    await expect(page.locator(".work-invoices").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.sourceReads).toHaveLength(0);
  });
test("Staff has no finance controls or invoice reads", async ({ page }) => {
  const f = await workInvoiceFixture(page, "STAFF");
  await page.goto("/admin/invoices");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Administrator access",
  );
  expect(f.reads).toHaveLength(0);
  await expect(button(page, "Create an invoice")).toHaveCount(0);
});
test("25+3 pagination, exact filters, advanced state, reload and Back preserve scope", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  f.records = Array.from({ length: 28 }, (_, n) => invoiceRow(n));
  await page.goto("/admin/invoices");
  await expect(page.locator(".iv-record")).toHaveCount(25);
  await button(page, "Next").click();
  await expect(page.locator(".iv-record")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".iv-record")).toHaveCount(3);
  await button(page, "Previous").click();
  await expect(page.locator(".iv-record")).toHaveCount(25);
  await button(page, "More filters").click();
  await page.getByLabel("Source type", { exact: true }).selectOption("ORDER");
  await page.getByLabel("Source reference", { exact: true }).fill(id(191000));
  await page.getByLabel("Exact invoice number").fill(f.records[0].invoiceNumber);
  await button(page, "Apply invoice filters").click();
  await expect(page.locator(".iv-record")).toHaveCount(1);
  await expect(page).toHaveURL(/sourceId=/);
  await page.reload();
  await expect(page.getByLabel("Source reference", { exact: true })).toHaveValue(
    id(191000),
  );
  expect(f.reads.at(-1)!.searchParams.has("filters")).toBe(false);
  expect(f.reads.at(-1)!.searchParams.get("invoiceNumber")).toBe(
    f.records[0].invoiceNumber,
  );
});
for (const mode of ["empty", "error", "malformed"])
  test(`list ${mode} has a useful state`, async ({ page }) => {
    const f = await workInvoiceFixture(page);
    f.mode = mode;
    await page.goto("/admin/invoices");
    await expect(
      page.getByRole("heading", {
        name:
          mode === "empty"
            ? "No invoices on this page"
            : "Invoice records could not be loaded",
      }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(0);
  });
test("unsupported source link does not read records and clears safely", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  await page.goto(`/admin/invoices?sourceId=${id(191000)}`);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "invalid or unsupported",
  );
  expect(f.reads).toHaveLength(0);
  await button(page, "Clear invalid invoice link").click();
  await expect(page.locator(".iv-record")).toHaveCount(3);
});
test("source search is debounced, literal, paged and keeps an independent off-page selection", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  f.sources = Array.from({ length: 28 }, (_, n) => sourceRow(n));
  await page.goto("/admin/invoices?create=1");
  await page.getByLabel("Source record", { exact: true }).selectOption(id(195000));
  const nav = page.getByRole("navigation", { name: "Invoice sources pages" });
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Source record", { exact: true })).toHaveValue(id(195000));
  await expect(page.locator(".iv-source-current")).toContainText("ORD-2026-1300");
  await page.getByLabel("Find a source record").fill("ORD-2026-1327");
  await expect
    .poll(() =>
      f.sourceReads
        .findLast((u) => u.searchParams.has("search"))
        ?.searchParams.get("search"),
    )
    .toBe("ORD-2026-1327");
  await expect(
    page.getByLabel("Source record", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await page.getByLabel("Find a source record").fill("O");
  await expect(page.getByText("Enter at least two characters to search.")).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
for (const kind of ["ORDER", "BOOKING", "VEHICLE_TRANSACTION"])
  test(`creates one exact ${kind} draft, then focuses its saved result`, async ({
    page,
  }) => {
    const f = await workInvoiceFixture(page);
    await page.goto("/admin/invoices?create=1");
    await page.getByLabel("Invoice source type").selectOption(kind);
    const source = f.sources.find((v) => v.sourceType === kind)!;
    await review(page, source.id);
    const before = f.reads.length;
    await button(page, "Go back").click();
    expect(f.reads.length).toBe(before);
    await expect(button(page, "Review draft invoice")).toBeFocused();
    await button(page, "Review draft invoice").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await button(page, "Create draft invoice").click();
    await expect(
      page.getByRole("heading", { name: "Draft invoice created" }),
    ).toBeFocused();
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].body).toEqual({ sourceType: kind, sourceId: source.id });
    await expect(page.getByRole("link", { name: "View draft invoice" })).toHaveAttribute(
      "href",
      `/admin/invoices/${id(199001)}`,
    );
  });
for (const mode of ["lost", "wrong-source", "rate"])
  test(`${mode} creation survives reload without replay and supports current-only recovery`, async ({
    page,
  }) => {
    const f = await workInvoiceFixture(page);
    f.writeMode = mode;
    await page.goto("/admin/invoices?create=1");
    await review(page);
    await button(page, "Create draft invoice").click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "outcome could not be confirmed",
    );
    await button(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", { name: "Creation outcome needs checking" }),
    ).toBeFocused();
    await page.reload();
    await expect(button(page, "Review draft invoice")).toBeDisabled();
    await button(page, "Load current source invoice").click();
    await expect(
      page.getByRole("heading", { name: "Current source invoice" }),
    ).toBeFocused();
    if (mode === "rate")
      await expect(
        page.getByText("No invoice is currently returned", { exact: false }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("link", { name: "View current invoice" }),
      ).toHaveAttribute("href", `/admin/invoices/${id(199001)}`);
    expect(f.writes).toHaveLength(1);
  });
test("source changes during review prevent POST", async ({ page }) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices?create=1");
  await review(page);
  f.sources[0].updatedAt = "2026-10-18T11:00:00.000Z";
  await button(page, "Create draft invoice").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "No creation request was sent",
  );
});
test("denied invoice refresh clears records and the protected creation workspace", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices?create=1");
  await expect(page.locator(".iv-record")).toHaveCount(3);
  f.mode = "denied";
  await button(page, "Refresh invoices").click();
  await expect(page.locator(".iv-record")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Create an invoice", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("exact Lagos due date survives review and is sent as an offset timestamp", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices?create=1");
  await page.getByLabel("Due date (optional, Lagos time)").fill("2027-01-02T12:34");
  await review(page);
  await expect(page.getByRole("dialog")).toContainText("12:34 (Lagos time)");
  await button(page, "Create draft invoice").click();
  await expect(
    page.getByRole("heading", { name: "Draft invoice created" }),
  ).toBeFocused();
  expect(f.writes[0].body.dueAt).toBe("2027-01-02T12:34:00+01:00");
});
test("a competing source invoice blocks POST and exposes its current detail link", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices?create=1");
  await review(page);
  f.records.unshift({
    ...invoiceRow(),
    id: id(199099),
    order: {
      id: f.sources[0].id,
      orderNumber: f.sources[0].reference,
      status: "PENDING",
      branch: f.sources[0].branch,
    },
  });
  await button(page, "Create draft invoice").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await button(page, "Go back").click();
  await expect(
    page.getByRole("heading", { name: "Current source invoice" }),
  ).toBeFocused();
  await expect(page.getByRole("link", { name: "View current invoice" })).toHaveAttribute(
    "href",
    `/admin/invoices/${id(199099)}`,
  );
  expect(f.writes).toHaveLength(0);
});
test("unavailable recovery storage prevents dispatch", async ({ page }) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices?create=1");
  await review(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await button(page, "Create draft invoice").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("source denial clears the creation form and saved list", async ({ page }) => {
  const f = await workInvoiceFixture(page);
  f.sourceMode = "denied";
  await page.goto("/admin/invoices?create=1");
  await expect(
    page.getByRole("heading", { name: "Invoice access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".iv-record")).toHaveCount(0);
  await expect(page.getByLabel("Source record", { exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("temporary refresh failure retains labelled records and disables creation", async ({
  page,
}) => {
  const f = await workInvoiceFixture(page);
  await page.goto("/admin/invoices");
  await expect(page.locator(".iv-record")).toHaveCount(3);
  f.mode = "error";
  await button(page, "Refresh invoices").click();
  await expect(
    page.getByText("Previously loaded records are shown", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".iv-record")).toHaveCount(3);
  await expect(button(page, "Create an invoice")).toBeDisabled();
  expect(f.writes).toHaveLength(0);
});
for (const width of [320, 375, 430, 768, 1024, 1280, 1440])
  test(`invoice records and create form fit ${width}px with no serious Axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1050 });
    await workInvoiceFixture(page);
    await page.goto("/admin/invoices?create=1");
    await expect(page.locator(".iv-record")).toHaveCount(3);
    await expect(page.getByLabel("Source record", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const result = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
  });
