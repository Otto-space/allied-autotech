import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workforceAftercareFixture } from "../fixtures/workforce-aftercare";
import { verifyConsole } from "../fixtures/preview-console";
const note = "Synthetic reviewed customer-visible fee basis and decision explanation";
async function begin(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
  width = 390,
  queue = false,
) {
  const f = await workforceAftercareFixture(page, role),
    errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (m) => {
    const expected =
      /^Failed to load resource:/.test(m.text()) &&
      m.location().url.includes("/staff/workforce/aftercare") &&
      ((f.readMode === "error" && /status of 503/.test(m.text())) ||
        (["lost", "rejected"].includes(f.actionMode) &&
          m.location().url.endsWith("/decision") &&
          /ERR_FAILED|status of 409/.test(m.text())));
    if (m.type() === "error" && !expected) errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(
    queue ? "/admin/workforce/aftercare" : `/admin/workforce/aftercare/${f.record.id}`,
  );
  await expect(
    page.getByRole("heading", {
      name: queue ? "Financial aftercare" : "Financial aftercare review",
      exact: true,
    }),
  ).toBeVisible();
  const check = async () => {
    expect(external).toEqual([]);
    expect(
      f.base.requests.some((p) => /^\/staff\/(?:orders|order-requests)\//.test(p)),
    ).toBe(false);
    await verifyConsole(page, errors, warnings);
  };
  return { f, check };
}
async function review(page: Page, stage = "APPROVED") {
  await page.getByLabel("Decision", { exact: true }).selectOption(stage);
  if (stage === "APPROVED")
    await page.getByLabel("Reviewed fee (₦)", { exact: true }).fill("0");
  await page.getByLabel("Customer-visible decision note", { exact: true }).fill(note);
  await page
    .getByRole("button", { name: "Review financial decision", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const role of ["STAFF", "ADMIN"] as const)
  for (const width of [320, 390, 768, 1440])
    test(`${role} reviews scoped populated aftercare and records a customer-visible decision at ${width}px`, async ({
      page,
    }) => {
      const { f, check } = await begin(page, role, width, true);
      await expect(
        page.getByRole("rowheader", { name: f.record.order.orderNumber }),
      ).toBeVisible();
      await page
        .getByRole("link", {
          name: `Review request for ${f.record.order.orderNumber}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Synthetic replacement filter — 1 of 3 ordered", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(f.record.inspectionNote!, { exact: true }),
      ).toBeVisible();
      await review(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Customer-visible decision note");
      await expect(dialog).toContainText(note);
      await expect(dialog).not.toContainText(f.record.inspectionNote!);
      expect(f.writes).toEqual([]);
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog[open]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (role === "STAFF" && [390, 1440].includes(width))
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-aftercare-review-${width}.png`),
        });
      await dialog.getByRole("button", { name: "Go back", exact: true }).click();
      await expect(
        page.getByLabel("Customer-visible decision note", { exact: true }),
      ).toHaveValue(note);
      await page
        .getByRole("button", { name: "Review financial decision", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Record financial decision", exact: true })
        .click();
      await expect(
        page.getByText(
          "Financial decision recorded. Refund and stock workflows remain separate.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("This request has a recorded financial decision.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(dialog).toHaveCount(0);
      expect(f.writes).toHaveLength(1);
      expect(f.writes[0].csrf?.length).toBeGreaterThan(31);
      expect(f.writes[0].body).toMatchObject({
        stage: "APPROVED",
        note,
        approvedFeeKobo: "0",
        expectedStatus: "INSPECTED",
        expectedRevision: "a".repeat(64),
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
      await check();
    });
for (const mode of ["lost", "malformed"] as const)
  test(`${mode} decision outcome remains blocked through reload until explicit inspected acknowledgement`, async ({
    page,
  }) => {
    const { f, check } = await begin(page);
    f.actionMode = mode;
    await review(page);
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Record financial decision", exact: true })
      .click();
    await expect(dialog).toContainText("The outcome could not be confirmed");
    await dialog
      .getByRole("button", { name: "Close & review record", exact: true })
      .click();
    expect(
      await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
    ).not.toContain(note);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Review financial decision", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Check current request", exact: true })
      .click();
    await expect(
      page.getByText(/Current request status: Approved for the next steps/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Acknowledge inspected state", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "I have checked this record and the earlier decision history with an authorised operator.",
      })
      .check();
    await page
      .getByRole("button", { name: "Acknowledge inspected state", exact: true })
      .click();
    await expect(
      page.getByText("This request has a recorded financial decision.", { exact: true }),
    ).toBeVisible();
    expect(f.writes).toHaveLength(1);
    expect(
      await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
    ).not.toContain("aat:workforce-aftercare-decision:v1:");
    await check();
  });
test("changed evidence stops the preflight without a decision and retains the editable note", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  await review(page);
  f.record.reviewRevision = "c".repeat(64);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record financial decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("No decision was sent.");
  expect(f.writes).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Go back", exact: true })
    .click();
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await expect(
    page.getByLabel("Customer-visible decision note", { exact: true }),
  ).toHaveValue(note);
  await check();
});
test("rejected server decision preserves editable information without an automatic retry", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  f.actionMode = "rejected";
  await review(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Record financial decision", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Record financial decision", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByLabel("Customer-visible decision note", { exact: true }),
  ).toHaveValue(note);
  expect(f.record.status).toBe("INSPECTED");
  expect(f.writes).toHaveLength(1);
  await check();
});
for (const removal of ["grant", "scope"] as const)
  test(`removing ${removal} discards open financial review, customer evidence and typed note`, async ({
    page,
  }) => {
    const { f, check } = await begin(page);
    await review(page);
    if (removal === "grant") f.base.access.independentCapabilities = [];
    else {
      f.base.access.permissions = [];
      f.base.access.assignments = [];
    }
    await page.evaluate(() => window.dispatchEvent(new Event("aat:workforce-recheck")));
    await expect(page).toHaveURL(/\/admin\?workAccess=updated$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(f.record.reason, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.body.textContent)).not.toContain(note);
    expect(f.writes).toEqual([]);
    await check();
  });
test("missing policy and item evidence stay unknown and no financial form is offered", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  f.record.policy = null;
  f.record.requestedItems = null;
  f.record.reviewEvidenceReady = false;
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await expect(
    page.getByText(
      "Stored policy evidence is unavailable or unrecognised. Ask an authorised policy owner to review the missing evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The stored item evidence could not be verified. An authorised operator must review it before a decision.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review financial decision", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toEqual([]);
  await check();
});
test("refresh failure hides evidence and successful retry preserves the unsent note", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  await page.getByLabel("Customer-visible decision note", { exact: true }).fill(note);
  f.readMode = "error";
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText(f.record.reason, { exact: true })).toHaveCount(0);
  f.readMode = "normal";
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await expect(
    page.getByLabel("Customer-visible decision note", { exact: true }),
  ).toHaveValue(note);
  expect(f.writes).toEqual([]);
  await check();
});
test("filters preserve URL truth, empty results and clear action without mutations", async ({
  page,
}) => {
  const { f, check } = await begin(page, "STAFF", 390, true);
  await page
    .getByLabel("Order reference", { exact: true })
    .fill("Does not match synthetic record");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/q=Does\+not\+match/);
  await expect(
    page.getByText("No requests match your current scope and filters", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: f.record.order.orderNumber }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  expect(f.writes).toEqual([]);
  await check();
});
test("receiving or inspection is not manufactured by the financial form", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  f.record.status = "REQUESTED";
  f.record.receivedAt = null;
  f.record.inspectedAt = null;
  f.record.inspectionNote = null;
  f.record.goodCondition = null;
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await expect(
    page
      .getByLabel("Decision", { exact: true })
      .getByRole("option", { name: "Approve request", exact: true }),
  ).toHaveCount(0);
  await review(page, "REJECTED");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record financial decision", exact: true })
    .click();
  await expect(
    page.getByText("This request has a recorded financial decision.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0].body).toMatchObject({ stage: "REJECTED", note });
  expect(f.writes[0].body.approvedFeeKobo).toBeUndefined();
  await check();
});

test("unavailable financial recovery storage prevents a decision request", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:workforce-aftercare-decision:v1:"))
        throw new DOMException("Synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const { f, check } = await begin(page);
  await review(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record financial decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("No decision was sent.");
  expect(f.writes).toEqual([]);
  await check();
});
test("pre-confirmation cancellation cannot acquire a fee through the financial form", async ({
  page,
}) => {
  const { f, check } = await begin(page);
  f.record.kind = "CANCELLATION";
  f.record.status = "REQUESTED";
  f.record.order.confirmedAt = null;
  await page.getByRole("button", { name: "Refresh request", exact: true }).click();
  await page.getByLabel("Decision", { exact: true }).selectOption("APPROVED");
  await page.getByLabel("Reviewed fee (₦)", { exact: true }).fill("1");
  await page.getByLabel("Customer-visible decision note", { exact: true }).fill(note);
  await page
    .getByRole("button", { name: "Review financial decision", exact: true })
    .click();
  await expect(
    page.getByText(
      "Enter an explicit fee within the order total, including zero. Cancellation before confirmation is free.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Reviewed fee (₦)", { exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.writes).toEqual([]);
  await check();
});
test("long customer-visible evidence wraps in the narrow financial review", async ({
  page,
}) => {
  const { f, check } = await begin(page, "STAFF", 320);
  await page.getByLabel("Decision", { exact: true }).selectOption("REJECTED");
  const long = "Synthetic reviewed decision basis ".repeat(12) + "Evidence".repeat(35);
  await page.getByLabel("Customer-visible decision note", { exact: true }).fill(long);
  await page
    .getByRole("button", { name: "Review financial decision", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(long);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "Record financial decision", exact: true }),
  ).toBeVisible();
  expect(f.writes).toEqual([]);
  await check();
});
