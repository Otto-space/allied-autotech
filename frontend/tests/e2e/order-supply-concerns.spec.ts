import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workOrderDetailFixture } from "../fixtures/work-order-detail";
import { ordersFixture, orderRecord } from "../fixtures/customer-orders";
import { purchaseFixture } from "../fixtures/purchase-guest";
import {
  supplySummary,
  supplyChoiceRecord,
  supplyId,
} from "../fixtures/order-supply-concerns";
import { paymentRow } from "../fixtures/work-payments";
import { verifyConsole } from "../fixtures/preview-console";
const ok = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Synthetic owned supply review",
      data,
      meta: { requestId: "supply-review-synthetic" },
    },
  });
async function setup(
  page: Page,
  audience: "staff" | "customer" | "guest",
  empty = false,
) {
  const staff = audience === "staff" ? await workOrderDetailFixture(page) : null;
  const guest = audience === "guest" ? await purchaseFixture(page) : null;
  if (audience === "customer") await ordersFixture(page);
  const record = staff?.detail.record ?? guest?.order ?? orderRecord(1, "PROCESSING");
  Object.assign(record, {
    version: 1,
    status: "PROCESSING",
    fulfillmentMethod: "COLLECTION",
    supplyConcernCapabilityVersion: 1,
    subtotalKobo: "303",
    discountAmountKobo: "5",
    taxKobo: "22",
    totalKobo: "320",
    purchaseReviews: [],
    items: [
      {
        ...record.items[0],
        id: supplyId(2),
        productName: "Synthetic original part",
        quantity: 3,
        unitPriceKobo: "101",
        subtotalKobo: "303",
      },
    ],
  });
  if (staff) {
    staff.detail.record = record as typeof staff.detail.record;
    staff.detail.record.allowedTransitions = [];
    staff.detail.record.paymentReferences = [
      { id: supplyId(6), paymentNumber: "PAY-SYNTHETIC-ORIGINAL", status: "SUCCEEDED" },
    ];
  }
  const seed = supplySummary(record),
    state = {
      summary: structuredClone(seed),
      writes: [] as { path: string; body: Record<string, unknown>; key?: string }[],
      failRead: false,
    };
  if (empty) state.summary.items = [];
  const prefix =
    audience === "staff" ? "staff" : audience === "guest" ? "purchase" : "customers";
  await page.route(`**/api/v1/${prefix}/orders/${record.id}**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (!url.pathname.includes("/supply-exceptions")) return ok(route, record);
    if (state.failRead)
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          message: "Synthetic read unavailable",
          error: { code: "DATABASE_UNAVAILABLE" },
          meta: { requestId: "supply-read-failure" },
        },
      });
    if (request.method() === "GET") return ok(route, state.summary);
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({ path: url.pathname, body });
    expect(request.headers()["x-csrf-token"]).toBeTruthy();
    expect(body.expectedVersion).toBe(state.summary.orderVersion);
    expect(String(body.idempotencyKey)).toMatch(/^[0-9a-f-]{36}$/i);
    if (url.pathname.endsWith("/resolve")) {
      expect(body.settlementAndPhysicalHistoryReviewed).toBe(true);
      state.summary.items[0].resolution = {
        id: supplyId(82),
        orderVersion: state.summary.orderVersion,
        reason: String(body.reason),
        createdAt: "2026-11-13T09:00:00Z",
        unfulfilledLines: state.summary.items[0].affectedLines,
        previouslyHandedLines: [],
      };
    } else if (url.pathname.endsWith("/choice"))
      state.summary.items[0].supplyRemedyChoices.unshift({
        ...supplyChoiceRecord(),
        choice: body.choice as "REFUND_REVIEW",
        customerNote: String(body.customerNote ?? ""),
        orderVersion: state.summary.orderVersion,
      });
    else
      state.summary.items.unshift({
        ...seed.items[0],
        kind: body.kind as (typeof seed.items)[0]["kind"],
        affectedLines: body.affectedLines as (typeof seed.items)[0]["affectedLines"],
        customerNote: String(body.customerNote),
        reason: String(body.reason),
        monetaryBasis: {
          ...seed.items[0].monetaryBasis,
          amounts: {
            currency: "NGN" as const,
            subtotalKobo: "202",
            discountKobo: "3",
            taxKobo: "14",
            totalKobo: "213",
          },
        },
      });
    state.summary.orderVersion++;
    record.version = state.summary.orderVersion;
    return ok(route, state.summary);
  });
  if (audience === "customer")
    await page.route("**/api/v1/auth/csrf", (route) =>
      ok(route, { csrfToken: "c".repeat(43) }),
    );
  const url =
    audience === "staff"
      ? `/admin/orders/${record.id}`
      : audience === "guest"
        ? `/purchase/orders/${record.id}`
        : `/dashboard/orders/${record.id}`;
  return { record, state, url };
}
function consoleCapture(page: Page, guest = false) {
  const errors: string[] = [],
    warnings: string[] = [];
  const guestSessionResponses: number[] = [],
    guestSessionConsole: string[] = [];
  page.on("response", (response) => {
    if (guest && new URL(response.url()).pathname === "/api/v1/auth/session")
      guestSessionResponses.push(response.status());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      // A private purchase guest intentionally has no account session. Verify that
      // exact endpoint/status separately; no other 401 or console error is allowed.
      if (
        guest &&
        message.location().url &&
        new URL(message.location().url).pathname === "/api/v1/auth/session" &&
        message.text() ===
          "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
      )
        guestSessionConsole.push(message.text());
      else errors.push(message.text());
    }
    if (message.type() === "warning") warnings.push(message.text());
  });
  return { errors, warnings, guestSessionResponses, guestSessionConsole };
}
for (const audience of ["customer", "guest"] as const)
  for (const width of [320, 1440])
    test(`${audience} supply request is explicit, retained and private at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const logs = consoleCapture(page, audience === "guest"),
        f = await setup(page, audience);
      await page.goto(f.url);
      const panel = page.locator("[data-order-supply-concerns]");
      await expect(panel).toContainText("Synthetic original part");
      const group = panel.getByRole("group", {
        name: "Your preferred next step",
        exact: true,
      });
      await group.getByRole("combobox").selectOption("REFUND_REVIEW");
      await group
        .getByRole("textbox")
        .fill("Please review the exact affected original portion for a refund.");
      await group.getByRole("checkbox").check();
      await group
        .getByRole("button", { name: "Review remedy request", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "This request does not accept a substitute, approve money",
      );
      expect(f.state.writes).toHaveLength(0);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go back", exact: true })
        .click();
      await expect(group.getByRole("textbox")).toHaveValue(
        "Please review the exact affected original portion for a refund.",
      );
      await group
        .getByRole("button", { name: "Review remedy request", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm request", exact: true })
        .click();
      await expect(panel).toContainText("Latest request: Request refund review");
      expect(f.state.writes).toHaveLength(1);
      await expect(group.getByRole("checkbox")).not.toBeChecked();
      await page.reload();
      await expect(panel).toContainText("Latest request: Request refund review");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
      expect(
        (
          await new AxeBuilder({ page })
            .include("[data-order-supply-concerns]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await panel.screenshot({
        path: info.outputPath(`supply-panel-${audience}-${width}.png`),
      });
      await page.screenshot({
        path: info.outputPath(`supply-${audience}-${width}.png`),
        fullPage: true,
      });
      if (audience === "guest") {
        expect(logs.guestSessionResponses).toEqual([401, 401]);
        expect(logs.guestSessionConsole).toHaveLength(2);
      }
      await verifyConsole(page, logs.errors, logs.warnings);
    });
for (const width of [320, 1440])
  test(`administrator records exact affected goods without a silent remedy at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const logs = consoleCapture(page),
      f = await setup(page, "staff", true);
    await page.goto(f.url);
    const panel = page.locator("[data-order-supply-concerns]");
    await expect(panel).toContainText("No supply concern");
    await panel.getByText("Record a supply concern", { exact: true }).click();
    const group = panel.getByRole("group", {
      name: "Record an actual supply concern",
      exact: true,
    });
    await group.getByRole("combobox").selectOption("UNAVAILABLE");
    await group.getByRole("checkbox", { name: /Affected goods/ }).check();
    await group.getByLabel("First affected unit (1-based)").fill("2");
    await group.getByLabel("Affected quantity", { exact: true }).fill("2");
    await group
      .getByLabel("Customer-facing concern")
      .fill("Synthetic supplier cannot provide the two affected original units.");
    await group
      .getByLabel("Internal evidence note", { exact: false })
      .fill("Synthetic actual supplier confirmation for internal review only");
    await group.getByRole("checkbox", { name: /I checked/ }).check();
    await group
      .getByRole("button", { name: "Review supply concern", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("starting at unit 2");
    expect(f.state.writes).toHaveLength(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(panel).toContainText("2 affected units");
    expect(f.state.writes[0].body).toMatchObject({
      affectedLines: [{ orderItemId: supplyId(2), offset: 1, quantity: 2 }],
      actualConcernConfirmed: true,
    });
    await expect(
      group.getByRole("checkbox", { name: /Affected goods/ }),
    ).not.toBeChecked();
    await page.reload();
    await expect(panel).toContainText("2 affected units");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .include("[data-order-supply-concerns]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`supply-staff-${width}.png`),
      fullPage: true,
    });
    await verifyConsole(page, logs.errors, logs.warnings);
  });
test("an affected refund uses the owned verified capture and opens its separate financial record", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const logs = consoleCapture(page),
    f = await setup(page, "staff");
  f.record.version = 2;
  f.state.summary.orderVersion = 2;
  f.state.summary.items[0].supplyRemedyChoices = [supplyChoiceRecord()];
  const payment = paymentRow(0, true);
  Object.assign(payment, {
    id: supplyId(6),
    orderId: f.record.id,
    invoiceId: null,
    bookingId: null,
    purpose: "ORDER_PAYMENT",
    amountKobo: "320",
  });
  payment.attempts[0].amountKobo = "320";
  await page.route(`**/api/v1/staff/payments/${payment.id}`, (route) =>
    ok(route, payment),
  );
  let owner = "";
  await page.route("**/api/v1/staff/payments/refunds", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      supplyRemedyChoiceId: supplyId(5),
      amountKobo: "107",
      paymentAttemptId: payment.attempts[0].id,
    });
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    f.state.writes.push({
      path: "/staff/payments/refunds",
      body,
      key: route.request().headers()["idempotency-key"],
    });
    const result = {
      id: supplyId(77),
      refundNumber: "REF-SYNTHETIC",
      paymentAttemptId: payment.attempts[0].id,
      supplyRemedyChoiceId: supplyId(5),
      requestedByUserId: owner,
      approvedByUserId: null,
      amountKobo: "107",
      currency: "NGN" as const,
      status: "REQUESTED" as const,
      reason: body.reason,
      providerStatus: null,
      failureCode: null,
      requestedAt: "2026-11-10T09:00:00Z",
      approvedAt: null,
      processedAt: null,
      failedAt: null,
      updatedAt: "2026-11-10T09:00:00Z",
    };
    f.state.summary.items[0].supplyRemedyChoices[0].refunds = [result];
    return ok(route, { refund: result, replayed: false });
  });
  await page.goto(f.url);
  owner = await page.evaluate(async () => {
    const data = await (await fetch("/api/v1/auth/session")).json();
    return data.data.user.id as string;
  });
  const panel = page.locator("[data-order-supply-concerns]"),
    group = panel.getByRole("group", {
      name: "Request affected refund review",
      exact: true,
    });
  await group
    .getByLabel("Actual original payment", { exact: false })
    .selectOption(payment.id);
  await group
    .getByRole("combobox", { name: "Verified capture", exact: true })
    .selectOption(payment.attempts[0].id);
  await group
    .getByLabel("Internal financial reason")
    .fill("Synthetic actual affected original portion and capture reviewed");
  await group.getByRole("checkbox").check();
  await group
    .getByRole("button", { name: "Review affected refund", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "A separate authorised operator must approve",
  );
  expect(f.state.writes).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm request", exact: true })
    .click();
  const link = panel.getByRole("link", { name: "Open refund record", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  await expect(panel).toContainText("Requested - awaiting independent approval");
  expect(f.state.writes).toHaveLength(1);
  await expect(link).toHaveAttribute("href", `/admin/refunds?refundId=${supplyId(77)}`);
  await page.reload();
  await expect(panel).toContainText("Requested - awaiting independent approval");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
  await page.screenshot({
    path: info.outputPath("supply-finance-390.png"),
    fullPage: true,
  });
  await verifyConsole(page, logs.errors, logs.warnings);
});

for (const width of [320, 768, 1440])
  test(`verified original settlement and actual quantities remain readable after refresh at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const logs = consoleCapture(page),
      f = await setup(page, "staff");
    f.state.summary.resolutionCapabilityVersion = 1;
    const choice = supplyChoiceRecord();
    choice.refunds = [
      {
        id: supplyId(81),
        amountKobo: "107",
        currency: "NGN",
        status: "SUCCEEDED",
        requestedAt: "2026-11-10T08:00:00Z",
        processedAt: "2026-11-13T08:00:00Z",
      },
    ];
    f.state.summary.items[0].supplyRemedyChoices = [choice];
    await page.goto(f.url);
    const panel = page.locator("[data-order-supply-concerns]"),
      group = panel.getByRole("group", {
        name: "Reconcile the refunded goods",
        exact: true,
      });
    await group
      .getByRole("textbox")
      .fill("Synthetic actual original refund and collection history reviewed");
    await group.getByRole("checkbox").check();
    await group
      .getByRole("button", { name: "Review supply resolution", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Record verified supply resolution?");
    await expect(dialog).toContainText("?1.07");
    expect(f.state.writes).toHaveLength(0);
    await dialog.getByRole("button", { name: "Confirm request", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(panel).toContainText("Refund and affected quantities reconciled");
    await expect(panel).toContainText("Unfulfilled units: 1");
    expect(f.state.writes).toHaveLength(1);
    expect(f.state.writes[0].path).toMatch(/supply-exceptions\/resolve$/);
    await page.reload();
    await expect(panel).toContainText(
      "Collection still requires current financial and physical clearance",
    );
    await expect(
      panel.getByRole("button", { name: "Review supply resolution", exact: true }),
    ).toHaveCount(0);
    expect(f.state.writes).toHaveLength(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .include("[data-order-supply-concerns]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`supply-resolution-${width}.png`),
      fullPage: true,
    });
    await verifyConsole(page, logs.errors, logs.warnings);
  });
