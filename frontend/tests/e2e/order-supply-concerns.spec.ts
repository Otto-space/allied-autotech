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
      closureHandedUnits: 0,
      cancelledOutcome: null as "NO_CAPTURE_RECORDED" | "CAPTURED_FUNDS_RETURNED" | null,
      interruptClosureResponse: false,
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
    if (url.pathname.endsWith("/close") && state.cancelledOutcome) {
      expect(body.noGoodsOutstandingAndSettlementReviewed).toBe(true);
      state.summary.cancelledReconciliationReviewAvailable = false;
      state.summary.reconciliations = [
        {
          id: supplyId(91),
          orderVersion: state.summary.orderVersion,
          createdAt: "2026-11-13T12:00:00Z",
          outcome: state.cancelledOutcome,
          originalKobo: "320",
          capturedKobo: state.cancelledOutcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
          refundedKobo: state.cancelledOutcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
          cancelledUnits: 3,
          reason: String(body.reason),
        },
      ];
      record.status = "CANCELLED";
    } else if (url.pathname.endsWith("/close")) {
      expect(body.noGoodsOutstandingAndSettlementReviewed).toBe(true);
      state.summary.closureReviewAvailable = false;
      state.summary.closures = [
        {
          id: supplyId(90),
          orderVersion: state.summary.orderVersion,
          createdAt: "2026-11-13T12:00:00Z",
          resultingStatus: state.closureHandedUnits ? "COMPLETED" : "CANCELLED",
          originalKobo: "320",
          refundedKobo: state.closureHandedUnits ? "213" : "320",
          remainingKobo: state.closureHandedUnits ? "107" : "0",
          originalUnits: 3,
          handedUnits: state.closureHandedUnits,
          refundedUnfulfilledUnits: 3 - state.closureHandedUnits,
          reason: String(body.reason),
        },
      ];
      record.status = state.summary.closures[0].resultingStatus;
    } else if (url.pathname.endsWith("/resolve")) {
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
    if (url.pathname.endsWith("/close") && state.interruptClosureResponse) {
      state.interruptClosureResponse = false;
      return route.abort("failed");
    }
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
function consoleCapture(page: Page, guest = false, interruptedClosurePath?: string) {
  const errors: string[] = [],
    warnings: string[] = [];
  const expectedClosureConsole: string[] = [],
    closureRequestFailures: string[] = [];
  page.on("requestfailed", (request) => {
    if (
      interruptedClosurePath &&
      new URL(request.url()).pathname === interruptedClosurePath &&
      request.method() === "POST"
    )
      closureRequestFailures.push(request.failure()?.errorText ?? "unknown");
  });
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
      else if (
        interruptedClosurePath &&
        message.location().url &&
        new URL(message.location().url).pathname === interruptedClosurePath &&
        message.text() === "Failed to load resource: net::ERR_FAILED"
      )
        expectedClosureConsole.push(message.text());
      else errors.push(message.text());
    }
    if (message.type() === "warning") warnings.push(message.text());
  });
  return {
    errors,
    warnings,
    guestSessionResponses,
    guestSessionConsole,
    expectedClosureConsole,
    closureRequestFailures,
  };
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
    await expect(dialog).toContainText("\u20a61.07");
    expect(f.state.writes).toHaveLength(0);
    await dialog.getByRole("button", { name: "Confirm request", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(panel).toContainText("Refund and affected quantities reconciled");
    await expect(panel).toContainText("Unfulfilled units: 1");
    await expect(panel).not.toContainText("The affected amount is already committed");
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

for (const width of [320, 768, 1440])
  for (const handed of [0, 1])
    test(`no-goods financial closure preserves actual pickup history at ${width}px after ${handed} collected units`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const f = await setup(page, "staff");
      const interrupted = width === 320 && handed === 1;
      const logs = consoleCapture(
        page,
        false,
        interrupted
          ? `/api/v1/staff/orders/${f.record.id}/supply-exceptions/close`
          : undefined,
      );
      f.state.closureHandedUnits = handed;
      f.state.interruptClosureResponse = width === 320 && handed === 1;
      f.state.summary.closureCapabilityVersion = 1;
      f.state.summary.closureReviewAvailable = true;
      f.state.summary.items[0].affectedLines = [
        { orderItemId: f.record.items[0].id, offset: handed, quantity: 3 - handed },
      ];
      f.state.summary.items[0].monetaryBasis.amounts = handed
        ? {
            currency: "NGN",
            subtotalKobo: "202",
            discountKobo: "3",
            taxKobo: "14",
            totalKobo: "213",
          }
        : {
            currency: "NGN",
            subtotalKobo: "303",
            discountKobo: "5",
            taxKobo: "22",
            totalKobo: "320",
          };
      f.state.summary.items[0].resolution = {
        id: supplyId(82),
        orderVersion: 0,
        createdAt: "2026-11-13T11:00:00Z",
        unfulfilledLines: f.state.summary.items[0].affectedLines,
        previouslyHandedLines: [],
      };
      await page.goto(f.url);
      const panel = page.locator("[data-order-supply-concerns]"),
        group = panel.getByRole("group", {
          name: "Review financial closure",
          exact: true,
        });
      await group
        .getByRole("textbox")
        .fill(
          "Synthetic actual no-goods settlement and original physical history reviewed",
        );
      await group.getByRole("checkbox").check();
      await group
        .getByRole("button", { name: "Review financial closure", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Record no-goods financial closure?");
      await expect(dialog).toContainText(
        "no physical handover, stock return, new charge or credit",
      );
      expect(f.state.writes).toHaveLength(0);
      await dialog.getByRole("button", { name: "Confirm request", exact: true }).click();
      if (width === 320 && handed === 1)
        await dialog
          .getByRole("button", { name: "Retry same request", exact: true })
          .click();
      await expect(dialog).not.toBeVisible();
      const history = panel.locator("[data-supply-closure-history]");
      await expect(history).toContainText("No goods outstanding");
      await expect(history).toContainText(
        `${handed} unit${handed === 1 ? "" : "s"} actually collected; ${3 - handed} unfulfilled units refunded`,
      );
      await expect(history).toContainText(
        "not a new amount due or replacement-order credit",
      );
      await expect(group).toHaveCount(0);
      await expect(panel).toContainText("Financial closure is recorded above");
      await expect(panel).not.toContainText(
        "Collection still requires current financial and physical clearance",
      );
      await expect(panel).toContainText(
        handed
          ? "Original affected amount: \u20a62.13"
          : "Original affected amount: \u20a63.20",
      );
      expect(logs.closureRequestFailures).toEqual(interrupted ? ["net::ERR_FAILED"] : []);
      expect(
        logs.expectedClosureConsole.every(
          (message) => message === "Failed to load resource: net::ERR_FAILED",
        ),
      ).toBe(true);
      expect(f.state.writes).toHaveLength(1);
      expect(f.state.writes[0].path).toMatch(/supply-exceptions\/close$/);
      await page.reload();
      await expect(history).toContainText("No goods outstanding");
      await expect(history).toContainText(
        handed
          ? "Retained original payment: \u20a61.07"
          : "Retained original payment: \u20a60.00",
      );
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
        path: info.outputPath(`supply-closure-${width}-${handed}.png`),
        fullPage: true,
      });
      await verifyConsole(page, logs.errors, logs.warnings);
    });

for (const audience of ["customer", "guest"] as const)
  for (const width of [320, 1440])
    test(`${audience} reads safe recorded closure without administrator controls at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const logs = consoleCapture(page, audience === "guest"),
        f = await setup(page, audience);
      f.record.version = 2;
      f.record.status = "CANCELLED";
      f.state.summary.orderVersion = 2;
      f.state.summary.closureCapabilityVersion = 1;
      f.state.summary.closureReviewAvailable = true;
      f.state.summary.items[0].affectedLines = [
        { orderItemId: f.record.items[0].id, offset: 0, quantity: 3 },
      ];
      f.state.summary.items[0].monetaryBasis.amounts = {
        currency: "NGN",
        subtotalKobo: "303",
        discountKobo: "5",
        taxKobo: "22",
        totalKobo: "320",
      };
      f.state.summary.items[0].resolution = {
        id: supplyId(82),
        orderVersion: 0,
        createdAt: "2026-11-13T11:00:00Z",
        unfulfilledLines: f.state.summary.items[0].affectedLines,
        previouslyHandedLines: [],
      };
      f.state.summary.closures = [
        {
          id: supplyId(90),
          orderVersion: 1,
          createdAt: "2026-11-13T12:00:00Z",
          resultingStatus: "CANCELLED",
          originalKobo: "320",
          refundedKobo: "320",
          remainingKobo: "0",
          originalUnits: 3,
          handedUnits: 0,
          refundedUnfulfilledUnits: 3,
          reason: "Private synthetic administrator closure note",
        },
      ];
      await page.goto(f.url);
      const panel = page.locator("[data-order-supply-concerns]"),
        history = panel.locator("[data-supply-closure-history]");
      await expect(history).toContainText("No goods outstanding");
      await expect(panel).toContainText("Financial closure is recorded above");
      await expect(panel).not.toContainText(
        "Collection still requires current financial and physical clearance",
      );
      await expect(history).toContainText(
        "0 units actually collected; 3 unfulfilled units refunded",
      );
      await expect(
        panel.getByRole("group", { name: "Review financial closure", exact: true }),
      ).toHaveCount(0);
      await expect(panel).not.toContainText(
        "Private synthetic administrator closure note",
      );
      expect(f.state.writes).toHaveLength(0);
      await page.reload();
      await expect(history).toContainText("No goods outstanding");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
      await page.screenshot({
        path: info.outputPath(`safe-supply-closure-${audience}-${width}.png`),
        fullPage: true,
      });
      if (audience === "guest") {
        expect(logs.guestSessionResponses).toEqual([401, 401]);
        expect(logs.guestSessionConsole).toHaveLength(2);
      }
      await verifyConsole(page, logs.errors, logs.warnings);
    });

for (const width of [320, 768, 1440])
  for (const outcome of ["NO_CAPTURE_RECORDED", "CAPTURED_FUNDS_RETURNED"] as const)
    test(`cancelled original financial review ${outcome} at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const f = await setup(page, "staff"),
        interrupted = width === 320 && outcome === "NO_CAPTURE_RECORDED";
      const logs = consoleCapture(
        page,
        false,
        interrupted
          ? `/api/v1/staff/orders/${f.record.id}/supply-exceptions/close`
          : undefined,
      );
      f.record.status = "CANCELLED";
      f.record.version = 2;
      f.state.summary.orderVersion = 2;
      f.state.cancelledOutcome = outcome;
      f.state.interruptClosureResponse = interrupted;
      f.state.summary.cancelledReconciliationCapabilityVersion = 1;
      f.state.summary.cancelledReconciliationReviewAvailable = true;
      f.state.summary.cancelledReconciliationPreview = {
        outcome,
        originalKobo: "320",
        capturedKobo: outcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
        refundedKobo: outcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
        cancelledUnits: 3,
      };
      f.state.summary.items[0].monetaryBasis.status = "HISTORICAL_BREAKDOWN_REVIEW_REQUIRED";
      f.state.summary.items[0].monetaryBasis.amounts = null;
      await page.goto(f.url);
      const panel = page.locator("[data-order-supply-concerns]"),
        group = panel.getByRole("group", {
          name: "Review financial closure",
          exact: true,
        });
      await group
        .getByRole("textbox")
        .fill("Synthetic actual cancelled original and payment evidence reviewed");
      await group.getByRole("checkbox").check();
      await group
        .getByRole("button", { name: "Review financial closure", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Record cancelled-order payment review?");
      expect(f.state.writes).toHaveLength(0);
      await dialog.getByRole("button", { name: "Confirm request", exact: true }).click();
      const history = panel.locator("[data-cancelled-supply-history]");
      await expect(history).toContainText(
        outcome === "NO_CAPTURE_RECORDED"
          ? "No captured payment recorded"
          : "Captured funds returned",
      );
      await expect(history).toContainText(
        "3 original units cancelled; no physical pickup was recorded",
      );
      await expect(history).toContainText("The original order remains cancelled");
      await expect(group).toHaveCount(0);
      expect(f.state.writes).toHaveLength(1);
      await page.reload();
      await expect(history).toBeVisible();
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
        path: info.outputPath(`cancelled-review-${outcome}-${width}.png`),
        fullPage: true,
      });
      expect(logs.closureRequestFailures).toEqual(interrupted ? ["net::ERR_FAILED"] : []);
      await verifyConsole(page, logs.errors, logs.warnings);
    });
for (const audience of ["customer", "guest"] as const)
  for (const width of [320, 1440])
    for (const outcome of ["NO_CAPTURE_RECORDED", "CAPTURED_FUNDS_RETURNED"] as const)
      test(`${audience} reads private-safe cancelled original ${outcome} at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await setup(page, audience),
          logs = consoleCapture(page, audience === "guest");
        f.record.status = "CANCELLED";
        f.record.version = 3;
        f.state.summary.orderVersion = 3;
        f.state.summary.cancelledReconciliationCapabilityVersion = 1;
        f.state.summary.cancelledReconciliationReviewAvailable = true;
        f.state.summary.reconciliations = [
          {
            id: supplyId(91),
            orderVersion: 2,
            createdAt: "2026-11-13T12:00:00Z",
            outcome,
            originalKobo: "320",
            capturedKobo: outcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
            refundedKobo: outcome === "NO_CAPTURE_RECORDED" ? "0" : "320",
            cancelledUnits: 3,
            reason: "Private synthetic cancelled-order administrator note",
          },
        ];
        await page.goto(f.url);
        const panel = page.locator("[data-order-supply-concerns]"),
          history = panel.locator("[data-cancelled-supply-history]");
        await expect(history).toContainText(
          outcome === "NO_CAPTURE_RECORDED"
            ? "No refund was created"
            : "refunds already independently verified",
        );
        await expect(history).not.toContainText(
          "Private synthetic cancelled-order administrator note",
        );
        await expect(
          panel.getByRole("group", { name: "Review financial closure", exact: true }),
        ).toHaveCount(0);
        await expect(panel.getByRole("button", { name: "Review my choice" })).toHaveCount(
          0,
        );
        await page.reload();
        await expect(history).toBeVisible();
        expect(f.state.writes).toHaveLength(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        ).toBe(false);
        if (audience === "guest") {
          expect(logs.guestSessionResponses).toEqual([401, 401]);
          expect(logs.guestSessionConsole).toHaveLength(2);
        }
        await verifyConsole(page, logs.errors, logs.warnings);
      });
