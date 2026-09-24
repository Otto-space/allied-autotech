import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
const id = (n: number) => `ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reason = "Synthetic request for review of the supplied products.";
const note = "Synthetic review with a documented monetary and condition basis.";
const initialOrder = () => ({
  id: id(1),
  orderNumber: "SYNTHETIC-AFTERCARE-ORDER",
  status: "COMPLETED",
  fulfillmentMethod: "COLLECTION",
  currency: "NGN",
  subtotalKobo: "40000",
  totalKobo: "40000",
  discountAmountKobo: "0",
  deliveryFeeKobo: "0",
  taxKobo: "0",
  version: 3,
  createdAt: "2026-01-01T10:00:00Z",
  confirmedAt: "2026-01-01T11:00:00Z",
  paymentDueAt: null,
  paidAt: "2026-01-01T11:00:00Z" as string | null,
  fulfillmentEvidenceAt: null as string | null,
  fulfillmentEvidenceReference: null as string | null,
  invoice: null,
  branch: { id: id(2), code: "TEST", name: "Synthetic workshop" },
  items: [3, 4].map((n) => ({
    id: id(n),
    productId: id(n + 10),
    productName: `Synthetic product ${n}`,
    sku: `TEST-${n}`,
    quantity: 2,
    unitPriceKobo: "10000",
    subtotalKobo: "20000",
  })),
});
const initialRecord = () => ({
  id: id(5),
  orderId: id(1),
  kind: "RETURN",
  status: "REQUESTED",
  reason,
  items: [{ orderItemId: id(3), quantity: 1 }],
  requestedAt: "2026-09-01T10:00:00Z",
  receivedAt: null as string | null,
  inspectedAt: null as string | null,
  goodCondition: null as boolean | null,
  approvedFeeKobo: null as string | null,
  reviewedAt: null as string | null,
  reviewNote: null as string | null,
  inspectionNote: null as string | null,
  refundDueAt: null,
  refundClockStatus: "PENDING",
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "aftercare-test" },
    },
  });
const fail = (route: Route, status: number) =>
  route.fulfill({
    status,
    json: {
      success: false,
      error: { code: status === 409 ? "CONFLICT" : "DATABASE_UNAVAILABLE" },
    },
  });
async function fixture(
  page: Page,
  options: {
    staff?: boolean;
    history?: boolean;
    outcome?: "unknown" | "mismatch" | "stale";
  } = {},
) {
  const state = {
    order: initialOrder(),
    history: options.history ? [initialRecord()] : [],
    writes: [] as { endpoint: string; body: Record<string, unknown> }[],
    failOrder: false,
    failHistory: false,
    failPermission: false,
    canDecide: true,
    wrongPermission: false,
    wrongBranch: false,
    orderReads: 0,
    historyReads: 0,
    profileReads: 0,
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(6),
        user: {
          id: id(7),
          email: "synthetic@example.test",
          role: options.staff ? "STAFF" : "CUSTOMER",
        },
        mfaRequired: !!options.staff,
        mfaVerifiedAt: options.staff ? "2026-09-01T10:00:00Z" : null,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "aftercare-csrf-".repeat(4) });
    if (endpoint === "/staff/profile") {
      state.profileReads++;
      return state.failPermission
        ? fail(route, 503)
        : reply(route, {
            id: id(state.wrongPermission ? 99 : 7),
            email: "synthetic@example.test",
            role: "STAFF",
            status: "ACTIVE",
            staffProfile: {
              id: id(8),
              firstName: "Synthetic",
              lastName: "Reviewer",
              branchId: id(state.wrongBranch ? 99 : 2),
            },
            capabilities: state.canDecide ? ["FINANCE_POLICY_APPROVE"] : [],
          });
    }
    if (
      route.request().method() === "GET" &&
      endpoint === `/${options.staff ? "staff" : "customers"}/orders/${id(1)}`
    ) {
      state.orderReads++;
      return state.failOrder ? fail(route, 503) : reply(route, state.order);
    }
    if (
      route.request().method() === "GET" &&
      endpoint.endsWith(`/orders/${id(1)}/aftercare`)
    ) {
      state.historyReads++;
      return state.failHistory ? fail(route, 503) : reply(route, state.history);
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push({ endpoint, body });
      expect(route.request().headers()["x-csrf-token"]).toBe("aftercare-csrf-".repeat(4));
      if (options.outcome === "unknown") return route.abort("failed");
      if (options.outcome === "stale") return fail(route, 409);
      if (endpoint.endsWith("/fulfillment-evidence")) {
        state.order.fulfillmentEvidenceAt = body.at;
        state.order.fulfillmentEvidenceReference = body.reference;
        return reply(route, {
          id: id(1),
          fulfillmentEvidenceAt: body.at,
          fulfillmentEvidenceReference:
            options.outcome === "mismatch" ? "Wrong reference" : body.reference,
        });
      }
      if (endpoint.endsWith("/review")) {
        const old = state.history[0]!;
        const saved = {
          ...old,
          status: body.stage,
          ...(body.stage === "RECEIVED" ? { receivedAt: "2026-09-02T10:00:00Z" } : {}),
          ...(body.stage === "INSPECTED"
            ? {
                inspectedAt: "2026-09-02T11:00:00Z",
                goodCondition: body.goodCondition,
                inspectionNote: body.note,
              }
            : {}),
          ...(["APPROVED", "REJECTED"].includes(body.stage)
            ? {
                reviewedAt: "2026-09-02T12:00:00Z",
                reviewNote: body.note,
                approvedFeeKobo: body.approvedFeeKobo ?? "0",
              }
            : {}),
        };
        state.history = [saved];
        return reply(
          route,
          options.outcome === "mismatch"
            ? { ...saved, items: [{ orderItemId: id(4), quantity: 1 }] }
            : saved,
        );
      }
      const saved = {
        ...initialRecord(),
        kind: endpoint.endsWith("/returns") ? "RETURN" : (body.kind ?? "CANCELLATION"),
        reason: body.reason,
        items:
          body.items ??
          state.order.items.map((item) => ({
            orderItemId: item.id,
            quantity: item.quantity,
          })),
      };
      state.history = state.history.length ? state.history : [saved];
      if (endpoint.endsWith("/cancel")) {
        state.order.status = "PROCESSING";
        return reply(route, { ...state.order, cancellationRequest: state.history[0] });
      }
      return reply(
        route,
        options.outcome === "mismatch" ? { ...saved, orderId: id(99) } : state.history[0],
      );
    }
    return fail(route, 404);
  });
  return state;
}
const customerUrl = `/dashboard/orders/${id(1)}/aftercare`;
const staffUrl = `/admin/orders/${id(1)}/aftercare`;
async function open(page: Page, staff = false) {
  await page.goto(staff ? staffUrl : customerUrl);
  await expect(
    page.getByRole("heading", { name: "SYNTHETIC-AFTERCARE-ORDER", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh order requests", exact: true }),
  ).toBeEnabled();
}
async function intake(page: Page, kind = "RETURN", scope = "SELECTED") {
  await page.getByLabel("Request type", { exact: true }).selectOption(kind);
  await page.getByLabel("Products to review").selectOption(scope);
  if (scope === "SELECTED") {
    await page
      .getByRole("checkbox", { name: "Synthetic product 3", exact: true })
      .check();
    await page.getByLabel("Quantity for Synthetic product 3", { exact: true }).fill("1");
  }
  await page.getByLabel("Reason for your request").fill(reason);
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function stage(page: Page, value: string) {
  if (!(await page.getByLabel("Next review action").count()))
    await page
      .getByRole("button", { name: "Review return request", exact: true })
      .click();
  await page.getByLabel("Next review action").selectOption(value);
  if (value === "INSPECTED")
    await page.getByLabel("Goods in good condition?").selectOption("false");
  if (value === "APPROVED")
    await page.getByLabel("Reviewed fee (NGN, enter zero if none)").fill("12.50");
  await page.locator("textarea[name=note]").fill(note);
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
}
async function evidence(page: Page) {
  await page
    .getByLabel("Delivery or collection time (Lagos time)")
    .fill("2026-09-01T12:30");
  await page
    .getByLabel("Supporting evidence reference")
    .fill("Synthetic signed collection note");
  await page
    .getByRole("button", { name: "Review fulfillment evidence", exact: true })
    .click();
}
test("customer selects quantities, cancels review with focus restored, and submits a partial return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) logs.push(msg.text());
  });
  page.on("pageerror", (error) => logs.push(error.message));
  const state = await fixture(page);
  await open(page);
  await expect(page).toHaveURL(customerUrl);
  await expect(page).toHaveTitle(/Allied AutoTech/);
  await intake(page);
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toContainText("Synthetic product 3, quantity 1");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review order request", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Reason for your request")).toHaveValue(reason);
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await page.getByRole("button", { name: "Send order request", exact: true }).click();
  await expect(page.getByText("Requested for review", { exact: true })).toBeVisible();
  expect(state.writes).toEqual([
    {
      endpoint: `/customers/orders/${id(1)}/aftercare`,
      body: { kind: "RETURN", reason, items: [{ orderItemId: id(3), quantity: 1 }] },
    },
  ]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-aftercare-customer-1440.png"),
    fullPage: true,
  });
  expect(logs).toEqual([]);
});
for (const kind of ["RETURN", "CANCELLATION"])
  test(`customer sends all-products ${kind} using the correct endpoint`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await open(page);
    await intake(page, kind, "ALL");
    await page.getByRole("button", { name: "Send order request", exact: true }).click();
    await expect(page.getByText("Requested for review", { exact: true })).toBeVisible();
    expect(state.writes[0]).toEqual({
      endpoint: `/customers/orders/${id(1)}/${kind === "RETURN" ? "returns" : "aftercare"}`,
      body:
        kind === "RETURN"
          ? { reason }
          : {
              kind,
              reason,
              items: [
                { orderItemId: id(3), quantity: 2 },
                { orderItemId: id(4), quantity: 2 },
              ],
            },
    });
  });
test("unchecked invalid quantities do not block selected products and duplicates keep their original details", async ({
  page,
}) => {
  const state = await fixture(page, { history: true });
  await open(page);
  await page.getByLabel("Request type", { exact: true }).selectOption("RETURN");
  await page.getByLabel("Products to review").selectOption("SELECTED");
  const first = page.getByRole("checkbox", { name: "Synthetic product 3", exact: true });
  await first.check();
  await page.getByLabel("Quantity for Synthetic product 3", { exact: true }).fill("999");
  await first.uncheck();
  await expect(
    page.getByLabel("Quantity for Synthetic product 3", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "Synthetic product 4", exact: true }).check();
  await page
    .getByLabel("Reason for your request")
    .fill("A new synthetic explanation should preserve the original request.");
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await page.getByRole("button", { name: "Send order request", exact: true }).click();
  await expect(page.getByText(/An existing request was returned/)).toBeVisible();
  expect(state.writes[0]!.body.items).toEqual([{ orderItemId: id(4), quantity: 2 }]);
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
});
test("staff receives, inspects and approves with explicit exact money and a refreshed stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) errors.push(msg.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const state = await fixture(page, { staff: true, history: true });
  await open(page, true);
  for (const value of ["RECEIVED", "INSPECTED", "APPROVED"]) {
    await stage(page, value);
    await page.getByRole("button", { name: "Save order review", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Refresh order requests", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText(
        value === "RECEIVED"
          ? "Returned goods received"
          : value === "INSPECTED"
            ? "Condition inspected"
            : "Approved for the next steps",
        { exact: true },
      ),
    ).toBeVisible();
  }
  expect(state.writes.map((w) => w.body)).toEqual([
    { stage: "RECEIVED", expectedStatus: "REQUESTED", note },
    { stage: "INSPECTED", expectedStatus: "RECEIVED", note, goodCondition: false },
    { stage: "APPROVED", expectedStatus: "INSPECTED", note, approvedFeeKobo: "1250" },
  ]);
  await expect(page.getByText(/This is not a refund amount/)).toBeVisible();
  await expect(page.getByLabel("Next review action")).toHaveCount(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-aftercare-staff-1440.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("staff records Lagos fulfillment time and cannot overwrite evidence", async ({
  page,
}) => {
  const state = await fixture(page, { staff: true });
  await open(page, true);
  await evidence(page);
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Record fulfillment evidence", exact: true })
    .click();
  await expect(page.getByText(/cannot be overwritten here/)).toBeVisible();
  expect(state.writes[0]!.body).toEqual({
    at: "2026-09-01T11:30:00.000Z",
    reference: "Synthetic signed collection note",
  });
  await expect(
    page.getByRole("button", { name: "Review fulfillment evidence", exact: true }),
  ).toHaveCount(0);
});
for (const surface of ["intake", "review", "evidence"] as const)
  for (const outcome of ["unknown", "mismatch"] as const)
    test(`${surface} ${outcome} locks changes through failed and recovered reads`, async ({
      page,
    }) => {
      const staff = surface !== "intake",
        state = await fixture(page, { staff, history: surface === "review", outcome });
      await open(page, staff);
      if (surface === "intake") await intake(page);
      else if (surface === "review") await stage(page, "RECEIVED");
      else await evidence(page);
      const confirm =
        surface === "intake"
          ? "Send order request"
          : surface === "review"
            ? "Save order review"
            : "Record fulfillment evidence";
      await page.getByRole("button", { name: confirm, exact: true }).click();
      await expect(
        page.getByRole("dialog").getByText(/outcome could not be confirmed/),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: confirm, exact: true }),
      ).toBeDisabled();
      state.failOrder = true;
      state.failHistory = true;
      await page
        .getByRole("button", { name: "Close & review record", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Refresh order requests", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByRole("heading", { name: "SYNTHETIC-AFTERCARE-ORDER", exact: true }),
      ).toHaveCount(0);
      state.failOrder = false;
      state.failHistory = false;
      await page
        .getByRole("button", { name: "Refresh order requests", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "SYNTHETIC-AFTERCARE-ORDER", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/The outcome of a change is uncertain/)).toBeVisible();
      if (surface === "intake")
        await expect(
          page.getByRole("button", { name: "Review order request", exact: true }),
        ).toBeDisabled();
      else if (surface === "review") {
        if (!(await page.getByLabel("Next review action").count()))
          await page
            .getByRole("button", { name: "Review return request", exact: true })
            .click();
        await expect(page.getByLabel("Next review action")).toBeDisabled();
      } else if (outcome === "unknown")
        await expect(
          page.getByRole("button", { name: "Review fulfillment evidence", exact: true }),
        ).toBeDisabled();
      expect(state.writes).toHaveLength(1);
    });
test("staff permissions are explicit and revoked or mismatched profile data locks reviews", async ({
  page,
}) => {
  const state = await fixture(page, { staff: true, history: true });
  state.canDecide = false;
  await open(page, true);
  await page.getByRole("button", { name: "Review return request", exact: true }).click();
  await expect(page.getByLabel("Next review action").locator("option")).toHaveText([
    "Choose action",
    "Record returned goods received",
  ]);
  state.canDecide = true;
  await page
    .getByRole("button", { name: "Refresh review permission", exact: true })
    .click();
  await expect(
    page.getByLabel("Next review action").locator("option[value=REJECTED]"),
  ).toHaveCount(1);
  state.canDecide = false;
  await page
    .getByRole("button", { name: "Refresh review permission", exact: true })
    .click();
  await expect(
    page.getByLabel("Next review action").locator("option[value=REJECTED]"),
  ).toHaveCount(0);
  state.wrongBranch = true;
  await page
    .getByRole("button", { name: "Refresh review permission", exact: true })
    .click();
  await expect(page.getByLabel("Next review action")).toBeDisabled();
  state.wrongBranch = false;
  state.wrongPermission = true;
  await page
    .getByRole("button", { name: "Refresh review permission", exact: true })
    .click();
  await expect(page.getByLabel("Next review action")).toBeDisabled();
  state.wrongPermission = false;
  state.failPermission = true;
  await page
    .getByRole("button", { name: "Refresh review permission", exact: true })
    .click();
  await expect(page.getByLabel("Next review action")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("stale review prevents retry and refreshes before another proposal", async ({
  page,
}) => {
  const state = await fixture(page, { staff: true, history: true, outcome: "stale" });
  await open(page, true);
  await stage(page, "RECEIVED");
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save order review", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect.poll(() => state.historyReads).toBeGreaterThan(1);
  expect(state.writes).toHaveLength(1);
});
for (const mismatch of ["order", "history", "item"])
  test(`mismatched ${mismatch} data cannot enable a customer mutation`, async ({
    page,
  }) => {
    const state = await fixture(page, { history: true });
    if (mismatch === "order") state.order.id = id(99);
    if (mismatch === "history") state.history[0]!.orderId = id(99);
    if (mismatch === "item") state.history[0]!.items[0]!.orderItemId = id(99);
    await page.goto(customerUrl);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Returns and cancellation requests",
    );
    await expect(
      page.getByRole("button", { name: "Refresh order requests", exact: true }),
    ).toBeEnabled();
    if (mismatch === "order")
      await expect(
        page.getByRole("button", { name: "Review order request", exact: true }),
      ).toHaveCount(0);
    else
      await expect(
        page.getByRole("button", { name: "Review order request", exact: true }),
      ).toBeDisabled();
    expect(state.writes).toHaveLength(0);
  });
test("customer cancellation reports staff review when processing advanced", async ({
  page,
}) => {
  const state = await fixture(page);
  state.order.status = "PENDING";
  state.order.paidAt = null;
  await page.goto(`/dashboard/orders/${id(1)}`);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Reason for cancellation").fill(reason);
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(
    page.getByText(
      "A cancellation request was recorded for staff review. Your order has not been cancelled.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("long customer history and reviewed forms fit mobile, landscape and desktop", async ({
  page,
}) => {
  const state = await fixture(page, { history: true });
  state.history[0]!.reason = "LongSyntheticReference".repeat(80);
  await open(page);
  for (const width of [320, 360, 390, 480, 640, 768, 844, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await intake(page, "RETURN", "ALL");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-aftercare-review-390.png"),
    fullPage: false,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("staff validates evidence dates and fees, then reviews accessibly at narrow widths", async ({
  page,
}) => {
  const state = await fixture(page, { staff: true, history: true });
  state.history[0] = {
    ...initialRecord(),
    status: "INSPECTED",
    receivedAt: "2026-09-01T12:00:00Z",
    inspectedAt: "2026-09-01T13:00:00Z",
    goodCondition: true,
    inspectionNote: "Synthetic checked goods",
  };
  await open(page, true);
  await page
    .getByLabel("Delivery or collection time (Lagos time)")
    .fill("2025-01-01T12:30");
  await page.getByLabel("Supporting evidence reference").fill("Synthetic test evidence");
  await page
    .getByRole("button", { name: "Review fulfillment evidence", exact: true })
    .click();
  await expect(
    page.getByText(/Enter the actual delivery or collection time/),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Review return request", exact: true }).click();
  await page.getByLabel("Next review action").selectOption("APPROVED");
  await page.locator("textarea[name=note]").fill(note);
  await page.getByLabel("Reviewed fee (NGN, enter zero if none)").fill("400.01");
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
  await expect(
    page.getByText(/Enter an explicit fee within the order total/),
  ).toBeVisible();
  await expect(page.getByLabel("Reviewed fee (NGN, enter zero if none)")).toBeFocused();
  await page.getByLabel("Reviewed fee (NGN, enter zero if none)").fill("0");
  for (const width of [320, 360, 390, 480, 640, 768, 844, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Review recorded action", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-aftercare-staff-review-390.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save order review", exact: true }).click();
  await expect(
    page.getByText("Approved for the next steps", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0]!.body.approvedFeeKobo).toBe("0");
});

for (const staff of [false, true])
  test(`${staff ? "staff" : "customer"} account change removes private aftercare and pending reviews`, async ({
    page,
  }) => {
    const state = await fixture(page, { staff, history: staff });
    await open(page, staff);
    if (staff) await stage(page, "RECEIVED");
    else await intake(page);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("aat:session-changed")),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "SYNTHETIC-AFTERCARE-ORDER", exact: true }),
    ).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });

test("uncertain immediate cancellation locks its confirmation and payment actions", async ({
  page,
}) => {
  const state = await fixture(page, { outcome: "unknown" });
  state.order.status = "PENDING";
  state.order.paidAt = null;
  await page.goto(`/dashboard/orders/${id(1)}`);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Reason for cancellation").fill(reason);
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm cancellation", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Keep order", exact: true }).click();
  await page.getByRole("button", { name: "Refresh order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review payment options", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
