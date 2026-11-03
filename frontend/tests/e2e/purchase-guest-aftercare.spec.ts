import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { purchaseFixture } from "../fixtures/purchase-guest";
import { id } from "../fixtures/public-account-actions";

async function fixture(page: Page) {
  const buyer = await purchaseFixture(page);
  const state = {
    history: [] as Record<string, unknown>[],
    loseResponse: false,
    failedHistory: false,
    canStartNew: false,
    receipts: new Map<string, unknown>(),
    writes: [] as { key: string; body: Record<string, unknown>; operation: string }[],
  };
  await page.route("**/api/v1/purchase/orders/*/aftercare**", (route) => handle(route));
  await page.route("**/api/v1/purchase/orders/*/cancel", (route) => handle(route));
  async function handle(route: Route) {
    const request = route.request(),
      url = new URL(request.url());
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          message: "Synthetic order action",
          meta: { requestId: "guest-aftercare-fixture" },
          data,
        },
      });
    if (!buyer.access || buyer.account)
      return route.fulfill({
        status: buyer.account ? 409 : 401,
        json: { success: false, error: { code: "AUTHENTICATION_FAILED" } },
      });
    if (url.pathname.endsWith("original-request")) {
      const record = state.receipts.get(
        `${url.searchParams.get("operation")}:${request.headers()["idempotency-key"]}`,
      );
      return ok({
        found: !!record,
        record: record ?? null,
        canStartNew: state.canStartNew,
        recoveryUntil: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (request.method() === "GET")
      return state.failedHistory
        ? route.fulfill({
            status: 503,
            json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
          })
        : ok(state.history);
    const operation = url.pathname.endsWith("cancel") ? "cancel" : "aftercare";
    const body = request.postDataJSON(),
      key = request.headers()["idempotency-key"]!;
    state.writes.push({ body, key, operation });
    let record = state.receipts.get(`${operation}:${key}`);
    const replayed = !!record;
    if (!record) {
      if (operation === "cancel") {
        buyer.order.status = "CANCELLED";
        buyer.order.version++;
        record = { id: buyer.order.id, status: "CANCELLED" };
      } else {
        record = {
          id: id(97),
          orderId: buyer.order.id,
          kind: body.kind,
          reason: body.reason,
          items: body.items,
          status: "REQUESTED",
          requestedAt: new Date().toISOString(),
          receivedAt: null,
          inspectedAt: null,
          goodCondition: null,
          approvedFeeKobo: null,
          reviewedAt: null,
          reviewNote: null,
          refundDueAt: null,
          refundClockStatus: "ANCHOR_AND_BANK_CALENDAR_PENDING",
        };
        state.history.push(record as Record<string, unknown>);
      }
      state.receipts.set(`${operation}:${key}`, record);
    }
    if (state.loseResponse) return route.abort("failed");
    return ok(
      operation === "cancel"
        ? { order: buyer.order, replayed }
        : { ...(record as object), replayed },
      operation === "cancel" ? 200 : 201,
    );
  }
  return { buyer, state };
}
for (const width of [320, 768, 1366]) {
  test(`guest aftercare reviewed request and saved history at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
    await page
      .getByLabel("Reason for your request")
      .fill("Synthetic return review for one damaged product");
    await page.getByRole("spinbutton").fill("1");
    await page.getByRole("button", { name: "Review order request", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("quantity 1");
    expect(
      (await new AxeBuilder({ page }).include(".support-dialog").analyze()).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    expect(f.state.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Review order request", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirm reviewed action", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Return request" })).toBeVisible();
    expect(f.state.writes).toHaveLength(1);
    expect(f.state.writes[0]?.body.items).toEqual([
      { orderItemId: f.buyer.order.items[0]!.id, quantity: 1 },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`synthetic-guest-aftercare-${width}.png`),
      fullPage: false,
    });
  });
}
test("uncertain action survives reload with no private explanation stored and recovers without another POST", async ({
  page,
}) => {
  const f = await fixture(page);
  f.state.loseResponse = true;
  await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
  await page
    .getByLabel("Reason for your request")
    .fill("Private synthetic return explanation must stay out of storage");
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm reviewed action", exact: true })
    .click();
  await expect.poll(() => f.state.writes.length).toBe(1);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    ),
  ).not.toContain("Private synthetic");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Check the previous action" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check original action" }).click();
  await expect(
    page.getByRole("heading", { name: "Check the previous action" }),
  ).toHaveCount(0);
  expect(f.state.writes).toHaveLength(1);
});
test("pending cancellation has an explicit review and never claims a paid refund", async ({
  page,
}) => {
  const f = await fixture(page);
  f.buyer.order.paidAt = new Date().toISOString();
  await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
  await page.getByLabel("Request type").selectOption("cancel");
  await page
    .getByLabel("Reason for your request")
    .fill("Synthetic change before confirmation");
  await page.getByRole("button", { name: "Review cancellation", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("separate approval");
  await page
    .getByRole("button", { name: "Confirm reviewed action", exact: true })
    .click();
  await expect.poll(() => f.buyer.order.status).toBe("CANCELLED");
  expect(f.state.writes[0]).toMatchObject({
    operation: "cancel",
    body: { expectedVersion: 0 },
  });
  expect(
    f.buyer.writes.filter((write) => write.path !== "/purchase/access/csrf"),
  ).toHaveLength(0);
});
test("confirmed orders offer staff cancellation review while limited mode retains aftercare", async ({
  page,
}) => {
  const f = await fixture(page);
  f.buyer.mode = "browse_enquiries";
  f.buyer.order.status = "CONFIRMED";
  f.buyer.order.confirmedAt = new Date().toISOString();
  await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
  await expect(
    page.getByRole("option", { name: "Cancel before confirmation", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Request type").selectOption("CANCELLATION");
  await page
    .getByLabel("Reason for your request")
    .fill("Synthetic cancellation after staff confirmation");
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm reviewed action", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Cancellation request" })).toBeVisible();
  expect(f.buyer.order.status).toBe("CONFIRMED");
});
test("history failures block review and preserve the draft through recovery", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
  const reason = page.getByLabel("Reason for your request");
  await reason.fill("Synthetic draft retained across failed history");
  f.state.failedHistory = true;
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Order details or request history could not be confirmed.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review order request", exact: true }),
  ).toBeDisabled();
  f.state.failedHistory = false;
  await page.getByRole("button", { name: "Refresh order and requests" }).click();
  await expect(reason).toHaveValue("Synthetic draft retained across failed history");
  await expect(
    page.getByRole("button", { name: "Review order request", exact: true }),
  ).toBeEnabled();
});
test("buyer changes discard the private reason and close an open review", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto(`/purchase/orders/${f.buyer.order.id}/aftercare`);
  await page
    .getByLabel("Reason for your request")
    .fill("Private draft for the first synthetic buyer");
  await page.getByRole("button", { name: "Review order request", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  f.buyer.access = false;
  await page.evaluate(() =>
    dispatchEvent(
      new StorageEvent("storage", {
        key: "aat:purchase-access:changed",
        newValue: "new-buyer",
      }),
    ),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Continue with your email" }),
  ).toBeVisible();
  expect(f.state.writes).toHaveLength(0);
});
