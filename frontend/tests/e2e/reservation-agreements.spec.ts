import { workReservationPolicyFixture } from "../fixtures/work-reservation-policy";
import { test, expect, type Page, type Route } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import {
  purchaseDetailFixture,
  purchaseDetailPath,
  purchaseId,
} from "../fixtures/customer-purchase-detail";
import type { TermsDocument } from "@/lib/api/reservation-terms";
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic QA",
      meta: { requestId: "reservation-qa" },
    },
  });
const document: TermsDocument = {
  version: purchaseId(900),
  revision: 1,
  title: "Synthetic reservation agreement",
  body: "Synthetic test wording only.\nReview this exact revision before confirming.\n<script>window.agreementExecuted = true</script>",
  contentSha256: "a".repeat(64),
  effectiveAt: "2026-01-01T00:00:00Z",
};
async function customer(page: Page) {
  const base = await purchaseDetailFixture(page);
  Object.assign(base.record, {
    status: "NEGOTIATING",
    termsVersion: null,
    termsAcceptedAt: null,
    reservationExpiresAt: null,
  });
  const state = {
    current: document as TermsDocument | null,
    accepted: null as { document: TermsDocument; acceptedAt: string } | null,
    writes: [] as { key?: string; body: unknown }[],
    loseResponse: false,
  };
  await page.route("**/api/v1/auth/csrf", (route) =>
    reply(route, { csrfToken: "synthetic-csrf-token".repeat(3) }),
  );
  await page.route("**/reservation-terms", (route) =>
    reply(route, { ...state, legacyAcceptance: false }),
  );
  await page.route("**/reserve", async (route) => {
    state.writes.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    expect(route.request().headers()["x-csrf-token"]).toBe(
      "synthetic-csrf-token".repeat(3),
    );
    if (state.loseResponse) return route.abort("failed");
    base.record = {
      ...base.record,
      status: "RESERVED",
      version: 1,
      termsVersion: document.version,
      termsAcceptedAt: "2026-10-12T10:00:00Z",
      reservationExpiresAt: "2027-01-01T10:00:00Z",
    };
    state.accepted = { document, acceptedAt: base.record.termsAcceptedAt! };
    return reply(route, { transaction: base.record, replayed: state.writes.length > 1 });
  });
  return state;
}
async function review(page: Page) {
  await page
    .getByRole("checkbox", { name: "I have read and accept this reservation agreement." })
    .check();
  await page.getByRole("button", { name: "Review reservation", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
for (const width of [390, 1440])
  test(`customer reviews and explicitly reserves at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await customer(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto(purchaseDetailPath);
    await expect(page).toHaveTitle(/Vehicle purchase/i);
    await expect(page.getByRole("heading", { name: document.title })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review reservation", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("region", { name: "Reservation agreement text" }),
    ).toContainText("<script>");
    await review(page);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    expect(state.writes).toHaveLength(0);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await review(page);
    await page.screenshot({
      path: path.join(os.tmpdir(), `reservation-review-${width}.png`),
      fullPage: false,
    });
    await page.getByRole("button", { name: "Accept and reserve", exact: true }).click();
    await expect(page.locator(".pd-identity .pd-status")).toHaveText("Reserved");
    await expect(
      page.getByRole("region", { name: "Reservation agreement text" }),
    ).toContainText(document.body);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body).toEqual({
      expectedVersion: 0,
      termsVersion: document.version,
      termsAccepted: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(await page.evaluate(() => "agreementExecuted" in window)).toBe(false);
    expect(errors).toEqual([]);
  });
test("lost response survives reload and withdrawal with the same key and body", async ({
  page,
}) => {
  const state = await customer(page);
  state.loseResponse = true;
  await page.goto(purchaseDetailPath);
  await review(page);
  await page.getByRole("button", { name: "Accept and reserve", exact: true }).click();
  await expect(
    page.getByText("The outcome could not be confirmed.", { exact: false }),
  ).toBeVisible();
  state.loseResponse = false;
  state.current = null;
  await page.reload();
  await page
    .getByRole("button", { name: "Check original reservation", exact: true })
    .click();
  await page.getByRole("button", { name: "Check original request", exact: true }).click();
  await expect(page.locator(".pd-identity .pd-status")).toHaveText("Reserved");
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test("changed agreement requires fresh acceptance and sends no stale request", async ({
  page,
}) => {
  const state = await customer(page);
  await page.goto(purchaseDetailPath);
  await review(page);
  state.current = { ...document, version: purchaseId(901), revision: 2 };
  await page.getByRole("button", { name: "Accept and reserve", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accept and reserve", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText("Revision 2", { exact: false })).toBeVisible();
});
test("reload never restores agreement consent", async ({ page }) => {
  const state = await customer(page);
  await page.goto(purchaseDetailPath);
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(state.writes).toHaveLength(0);
});
test("requesting a payment leaves the agreement unchecked and sends no reservation", async ({
  page,
}) => {
  const state = await customer(page);
  const payments: unknown[] = [];
  await page.route("**/api/v1/customers/payments", async (route) => {
    payments.push(route.request().postDataJSON());
    return reply(route, {
      replayed: false,
      payment: {
        id: purchaseId(800),
        paymentNumber: "QA-PAYMENT",
        amountKobo: "2400000050",
        currency: "NGN",
        status: "REQUIRES_PAYMENT",
        purpose: "VEHICLE_FULL_PAYMENT",
        expiresAt: null,
        orderId: null,
        invoiceId: null,
        bookingId: null,
        vehicleTransactionId: purchaseId(1),
        attempts: [],
      },
    });
  });
  await page.goto(purchaseDetailPath);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page
    .getByLabel("Payment purpose", { exact: true })
    .selectOption("VEHICLE_FULL_PAYMENT");
  await page.getByRole("button", { name: "Review payment request", exact: true }).click();
  await page.getByRole("button", { name: "Request payment amount", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Review payment & checkout options", exact: true }),
  ).toBeVisible();
  expect(payments).toEqual([
    {
      targetType: "VEHICLE_TRANSACTION",
      targetId: purchaseId(1),
      purpose: "VEHICLE_FULL_PAYMENT",
    },
  ]);
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator(".pd-identity .pd-status")).toHaveText("Negotiating");
});
async function owner(page: Page, role = "SUPER_ADMIN") {
  const state = await workReservationPolicyFixture(page);
  state.base.role = role;
  state.history = [];
  return { rows: state.history, writes: state.writes };
}
test("owner publishes reviewed exact text then withdraws without rewriting history", async ({
  page,
}) => {
  const state = await owner(page);
  await page.goto("/admin/reservation-terms");
  await expect(page).toHaveTitle(/Vehicle reservation agreements/);
  await page.getByLabel("Agreement title", { exact: true }).fill(document.title);
  await page.getByLabel("Approved agreement text").fill(document.body);
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic owner approval QA only");
  await page
    .getByLabel("Written approval reference")
    .fill("Synthetic written owner approval QA only");
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByLabel("Approved agreement text")).toHaveValue(document.body);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Review publication", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(document.body);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Publish agreement", exact: true }).click();
  await expect(
    page.getByText("Agreement publication recorded", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0].settings).toEqual({
    enabled: true,
    title: document.title,
    body: document.body,
  });
  await page.getByLabel("Publication action").selectOption("withdraw");
  await page
    .getByLabel("Withdrawal reason", { exact: false })
    .fill("Synthetic withdrawal for QA");
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic owner approval QA only");
  await page
    .getByLabel("Written approval reference")
    .fill("Synthetic written owner approval QA only");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Review publication", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw availability", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Agreement publication recorded", exact: true }),
  ).toBeVisible();
  await page.getByText("Agreement history", { exact: true }).click();
  await expect(page.locator(".reservation-history")).toContainText("Revision 2");
  await expect(page.locator(".reservation-history")).toContainText(
    "Availability withdrawn",
  );
  expect(state.writes[1].settings).toEqual({
    enabled: false,
    reason: "Synthetic withdrawal for QA",
  });
  expect(state.rows[1].settings).toEqual({
    enabled: true,
    title: document.title,
    body: document.body,
  });
});
test("Admin cannot publish owner agreements", async ({ page }) => {
  const state = await owner(page, "ADMIN");
  await page.goto("/admin/reservation-terms");
  await expect(
    page.getByText(
      "Reservation policy requires an active, verified Super Admin account with MFA.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Review publication" })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
