import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workRefundFixture, refundRow, id } from "../fixtures/work-refunds";
const route = "/admin/refunds",
  selected = `${route}?refundId=${id(200000)}`;
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function visit(page: Page, n = 0) {
  await page.goto(`${route}?refundId=${id(200000 + n)}`);
  await expect(page.locator(".wr-handling")).toBeVisible();
  await expect(page.locator(".wr-value")).toContainText("NGN");
}
async function review(page: Page) {
  await button(page, "Review refund decision").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads complete refund facts and supported named selection`, async ({
    page,
  }) => {
    const f = await workRefundFixture(page, role);
    await visit(page);
    await expect(page.locator(".wr-record")).toHaveCount(5);
    await expect(
      page
        .locator(".wr-handling")
        .getByRole("heading", { name: f.records[0].refundNumber, exact: true }),
    ).toBeVisible();
    await page.locator(".wr-handling summary").click();
    await expect(page.locator(".wr-handling")).toContainText("09:00:37.123");
    await expect(page.locator(".wr-handling")).toContainText(
      f.records[0].paymentAttemptId,
    );
    expect(f.writes).toHaveLength(0);
  });
test("administrator inspection without action capabilities remains read only", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  f.grants = [];
  await visit(page);
  await expect(page.locator(".wr-record")).toHaveCount(5);
  await expect(button(page, "Review refund decision")).toHaveCount(0);
  await expect(page.locator(".wr-handling")).toContainText("authorized operator");
  expect(f.writes).toHaveLength(0);
});
test("delegated Staff reads only its queue and never sees administrator payment links", async ({
  page,
}) => {
  const f = await workRefundFixture(page, "STAFF");
  f.grants = ["REFUND_APPROVE"];
  await visit(page);
  await expect(page.locator(".wr-record")).toHaveCount(1);
  await expect(
    page.locator("main").getByRole("link", { name: "View payment records" }),
  ).toHaveCount(0);
  expect(f.reads.every((v) => v.pathname === "/api/v1/staff/refunds")).toBe(true);
  await expect(page.getByLabel("Refund decision", { exact: true })).toBeEnabled();
});
test("ungranted Staff makes no refund reads", async ({ page }) => {
  const f = await workRefundFixture(page, "STAFF");
  f.grants = [];
  await page.goto(route);
  await expect(page.locator("main").getByRole("alert")).toContainText("active refund");
  expect(f.reads).toHaveLength(0);
  expect(f.detailReads).toHaveLength(0);
});
for (const mode of ["error", "denied", "inactive", "mismatch"])
  test(`own-profile ${mode} blocks all refund reads`, async ({ page }) => {
    const f = await workRefundFixture(page);
    f.profileMode = mode;
    await page.goto(selected);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(f.reads).toHaveLength(0);
    expect(f.detailReads).toHaveLength(0);
  });
test("status and cursor history survive reload and explicit Back navigation", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  f.records = Array.from({ length: 28 }, (_, n) => refundRow(n));
  await page.goto(route);
  await expect(page.locator(".wr-record")).toHaveCount(25);
  await page
    .getByRole("navigation", { name: "Refund requests pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.locator(".wr-record")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".wr-record")).toHaveCount(3);
  await page
    .getByRole("navigation", { name: "Refund requests pages" })
    .getByRole("button", { name: "Previous", exact: true })
    .click();
  await expect(page.locator(".wr-record")).toHaveCount(25);
  await page.getByLabel("Refund status filter").selectOption("REQUESTED");
  await expect(page.locator(".wr-record")).toHaveCount(6);
  await expect(page).not.toHaveURL(/cursor=/);
  await page.reload();
  await expect(page.getByLabel("Refund status filter")).toHaveValue("REQUESTED");
  expect(f.writes).toHaveLength(0);
});
test("selection and disclosures persist without refetching the queue", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await page.goto(route);
  await expect(page.locator(".wr-record")).toHaveCount(5);
  const reads = f.reads.length;
  await page.locator(".wr-record").first().getByRole("button").click();
  await expect(page.getByLabel("Refund decision", { exact: true })).toBeEnabled();
  expect(f.reads).toHaveLength(reads);
  await page.locator(".wr-record").first().locator("summary").click();
  await expect(page).toHaveURL(/expanded=/);
  expect(f.reads).toHaveLength(reads);
  await page.reload();
  await expect(page.locator(".wr-record").first().locator("details")).toHaveJSProperty(
    "open",
    true,
  );
});
test("cancel makes no extra reads and preserves the note, focus and last handling draft", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  const note = page.getByLabel("Refund cancellation note (optional)");
  await note.fill("Retain this exact cancellation explanation");
  await review(page);
  const reads = f.reads.length + f.detailReads.length;
  await button(page, "Go back").click();
  await expect(button(page, "Review refund decision")).toBeFocused();
  await expect(note).toHaveValue("Retain this exact cancellation explanation");
  expect(f.reads.length + f.detailReads.length).toBe(reads);
  await button(page, "Close refund handling").click();
  await expect(page.locator(".wr-handling")).toBeHidden();
  await page.locator(".wr-record").first().getByRole("button").click();
  await expect(note).toHaveValue("Retain this exact cancellation explanation");
  expect(f.writes).toHaveLength(0);
});
test("exact cancellation and approval receipts focus their truthful results", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await page
    .getByLabel("Refund cancellation note (optional)")
    .fill("Original part retained after the inspection");
  await review(page);
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Refund decision recorded", exact: true }),
  ).toBeFocused();
  expect(f.writes[0].body).toEqual({
    decision: "CANCELLED",
    note: "Original part retained after the inspection",
  });
  await expect(page.locator(".wr-handling")).toContainText("No further action");
  expect(f.writes).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain(
    "Original part retained after the inspection",
  );
});
test("an unverified success response retains the original decision draft and a minimal recovery lock", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  f.writeMode = "wrong-note";
  await visit(page);
  const note = "Retain this original cancellation explanation until verified";
  await page.getByLabel("Refund cancellation note (optional)").fill(note);
  await review(page);
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  const stored = await page.evaluate(() => ({ ...sessionStorage }));
  expect(JSON.stringify(stored)).toContain(note);
  const lock = Object.entries(stored).find(([key]) =>
    key.startsWith("aat:staff-refund-change:v1:"),
  );
  expect(lock).toBeTruthy();
  expect(lock![1]).not.toContain(note);
  expect(f.writes).toHaveLength(1);
});
test("approval does not imply returned money or permit the approver to record a transfer", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await page.getByLabel("Refund decision", { exact: true }).selectOption("APPROVED");
  await review(page);
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Refund decision recorded", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".wr-handling")).toContainText("Needs attention");
  await expect(button(page, "Review transfer record")).toHaveCount(0);
  expect(f.writes[0].body).toEqual({ decision: "APPROVED" });
});
for (const mode of ["lost", "wrong-id", "wrong-total", "wrong-note", "rate"])
  test(`${mode} decision stays locked after reload and current lookup never replays`, async ({
    page,
  }) => {
    const f = await workRefundFixture(page);
    f.writeMode = mode;
    await visit(page);
    await review(page);
    await button(page, "Confirm change").click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "outcome could not be confirmed",
    );
    await button(page, "Close & review record").click();
    await expect(
      page.getByRole("heading", { name: "Refund change needs checking" }),
    ).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Refund change needs checking" }),
    ).toBeVisible();
    await button(page, "Load current refund").click();
    await expect(
      page.getByRole("heading", { name: "Current refund facts" }),
    ).toBeFocused();
    expect(f.writes).toHaveLength(1);
    await expect(button(page, "Clear reconciled lock")).toBeDisabled();
  });
test("changed current facts block dispatch while preserving the decision note", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await page
    .getByLabel("Refund cancellation note (optional)")
    .fill("Keep my explanation when another operator changes facts");
  await review(page);
  f.records[0].reason = "Changed original request during review";
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "No refund change request was sent",
  );
  expect(f.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(page.getByRole("heading", { name: "Current refund facts" })).toBeFocused();
  await expect(page.getByLabel("Refund cancellation note (optional)")).toHaveValue(
    "Keep my explanation when another operator changes facts",
  );
});
test("capability revoked during review clears protected facts without posting", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await review(page);
  f.grants = [];
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Refund access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".wr-record")).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("blocked recovery storage prevents dispatch", async ({ page }) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await review(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
test("redacted recovery requires an explicit reference and independent reconciliation", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "aat:staff-refund-change:v1:d1000000-0000-4000-8000-000000000302:ADMIN",
      "pending",
    ),
  );
  await page.reload();
  await expect(page.getByLabel("Refund reference to inspect")).toBeVisible();
  await expect(button(page, "Review refund decision")).toBeDisabled();
  await button(page, "Load current refund").click();
  await expect(button(page, "Clear reconciled lock")).toBeDisabled();
  await page.getByLabel("I have independently reconciled", { exact: false }).check();
  await button(page, "Clear reconciled lock").click();
  await expect(button(page, "Review refund decision")).toBeEnabled();
  expect(f.writes).toHaveLength(0);
});
for (const mode of ["error", "malformed"])
  test(`queue ${mode} is not an empty result`, async ({ page }) => {
    const f = await workRefundFixture(page);
    f.mode = mode;
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Refund records could not be loaded" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No refund records on this page" }),
    ).toHaveCount(0);
    expect(f.writes).toHaveLength(0);
  });
for (const mode of ["error", "mismatch", "malformed"])
  test(`current-refund ${mode} preserves queue context and blocks actions`, async ({
    page,
  }) => {
    const f = await workRefundFixture(page);
    f.detailMode = mode;
    await page.goto(selected);
    await expect(page.locator(".wr-record")).toHaveCount(5);
    await expect(page.locator(".wr-handling").getByRole("alert")).toBeVisible();
    await expect(button(page, "Review refund decision")).toHaveCount(0);
  });
test("current-refund denial clears every protected record", async ({ page }) => {
  const f = await workRefundFixture(page);
  f.detailMode = "denied";
  await page.goto(selected);
  await expect(
    page.getByRole("heading", { name: "Refund access is unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".wr-record")).toHaveCount(0);
});
for (const mode of ["mismatch", "unsafe-host"])
  test(`private evidence ${mode} cannot authorize an independent check`, async ({
    page,
  }) => {
    const f = await workRefundFixture(page);
    f.evidenceMode = mode;
    await visit(page, 2);
    await button(page, "Load private transfer evidence").click();
    await expect(
      page.getByText(
        "The private refund evidence could not be verified. Refresh the record before checking it.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(button(page, "Review independent check")).toHaveCount(0);
    expect(f.writes).toHaveLength(0);
  });
test("independent evidence check validates the saved actor, amount and transfer before success", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page, 2);
  await button(page, "Load private transfer evidence").click();
  await page.getByLabel("I reviewed the evidence", { exact: false }).check();
  await page.getByLabel("Check outcome", { exact: true }).selectOption("ACCEPT");
  await page
    .getByLabel("Independent check note", { exact: true })
    .fill("Matched the synthetic bank evidence and recipient independently");
  await button(page, "Review independent check").click();
  await expect(page.getByRole("dialog")).toContainText("0123456789");
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Independent check recorded", exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0].body).toMatchObject({ accepted: true, evidenceChecked: true });
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain(
    "0123456789",
  );
});
test("bank form validates time, uploads verified evidence and records no replacement transfer", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  await visit(page, 1);
  await page
    .getByLabel("Bank transfer reference", { exact: true })
    .fill("SYNTHETIC-BANK-REF");
  await page
    .getByLabel("Transfer time (Lagos time)", { exact: true })
    .fill("2026-10-18T09:00");
  await page.getByLabel("Recipient bank", { exact: true }).fill("Synthetic bank");
  await page
    .getByLabel("Recipient account name", { exact: true })
    .fill("Synthetic private recipient");
  await page.getByLabel("Recipient account number", { exact: true }).fill("0123456789");
  await button(page, "Review transfer record").click();
  await expect(
    page.getByLabel("Transfer time (Lagos time)", { exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(0);
  await page
    .getByLabel("Transfer time (Lagos time)", { exact: true })
    .fill("2026-10-18T10:00");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-bank-evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nSynthetic bank evidence\n%%EOF"),
  });
  await button(page, "Upload selected file").click();
  await expect(
    page.getByText("File uploaded. Ready to attach when you confirm the record.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.storagePuts).toBe(1);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain(
    "0123456789",
  );
  await button(page, "Review transfer record").click();
  await expect(page.getByRole("dialog")).toContainText("does not send money");
  await button(page, "Go back").click();
  await expect(page.getByLabel("Recipient account number", { exact: true })).toHaveValue(
    "0123456789",
  );
  await button(page, "Review transfer record").click();
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: "Transfer record confirmed", exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(1);
});
test("bank evidence denial clears the page and previous private facts", async ({
  page,
}) => {
  const f = await workRefundFixture(page);
  f.evidenceMode = "denied";
  await visit(page, 2);
  await button(page, "Load private transfer evidence").click();
  await expect(
    page.getByRole("heading", { name: "Refund access is unavailable" }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
});
for (const width of [320, 375, 430, 768, 1024, 1280, 1440])
  test(`selected refund fits ${width}px with no serious Axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1050 });
    await workRefundFixture(page);
    await visit(page);
    await expect(page.getByLabel("Refund decision", { exact: true })).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    const result = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toEqual([]);
  });
