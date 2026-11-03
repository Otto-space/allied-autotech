import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { purchaseFixture, guestProduct } from "../fixtures/purchase-guest";
import { id, branch } from "../fixtures/public-account-actions";
import { guestCheckoutKey } from "../../lib/purchase/records";

for (const width of [320, 390, 430, 768, 1024, 1366])
  test(`guest cart, exact order review and payment at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await purchaseFixture(page);
    await page.addInitScript(
      ({ productId, selection }) =>
        localStorage.setItem(
          "aat:purchase-cart:1",
          JSON.stringify([{ productId, quantity: 2, vehicleSelection: selection }]),
        ),
      {
        productId: guestProduct.id,
        selection: state.order.purchaseReviews[0].requirements.lines[0].selection,
      },
    );
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Collection details", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByLabel("Your name", { exact: true }).fill("Synthetic Buyer");
    await page.getByLabel("Contact phone", { exact: true }).fill("+2348000000000");
    await page.getByLabel("Collection branch", { exact: true }).selectOption(branch.id);
    await page
      .getByRole("button", { name: "Review collection details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review before saving" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Edit collection details" }).click();
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      "Synthetic Buyer",
    );
    await page
      .getByRole("button", { name: "Review collection details", exact: true })
      .click();
    await page.getByRole("button", { name: "Create unpaid order", exact: true }).click();
    await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
    await expect(page.getByText("₦215.00", { exact: true })).toBeVisible();
    expect(state.writes.filter((v) => v.path === "/purchase/orders")).toHaveLength(1);
    const submitted = state.writes.find((v) => v.path === "/purchase/orders")!;
    expect(submitted.csrf).toBe("c".repeat(43));
    expect(submitted.body).toMatchObject({
      branchId: branch.id,
      contact: { name: "Synthetic Buyer", phone: "+2348000000000" },
      items: [{ productId: guestProduct.id, quantity: 2 }],
    });
    expect(submitted.body).not.toHaveProperty("totalKobo");
    expect(submitted.body).not.toHaveProperty("email");
    await page.getByRole("button", { name: "Review payment", exact: true }).click();
    await expect(page).toHaveURL(`/purchase/payments/${id(83)}`);
    await page
      .getByRole("button", { name: "Prepare Paystack checkout", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Continue to Paystack", exact: true }),
    ).toHaveAttribute("href", "https://checkout.paystack.com/synthetic");
    const init = state.writes.filter((v) => v.path.endsWith("/checkout"));
    expect(init).toHaveLength(1);
    expect(init[0]!.key).toBe(guestCheckoutKey(id(83), "PAYSTACK", 1));
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
      page.getByRole("heading", { name: "Review payment", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: info.outputPath(`synthetic-purchase-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const storage = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    );
    expect(storage).not.toContain("Synthetic Buyer");
    expect(storage).not.toContain("synthetic-buyer@example.test");
    expect(storage).not.toContain("c".repeat(43));
    if ([320, 1366].includes(width))
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

test("email proof stays in its fragment until read, requires an explicit action and is never stored", async ({
  page,
}) => {
  const state = await purchaseFixture(page, false),
    token = "p".repeat(43);
  await page.goto(`/purchase/verify#token=${token}`);
  await expect(
    page.getByRole("button", { name: "Verify purchase access", exact: true }),
  ).toBeEnabled();
  expect(page.url()).not.toContain(token);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Verify purchase access", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your email is verified" }),
  ).toBeVisible();
  expect(state.writes.filter((v) => v.path === "/purchase/access/verify")).toHaveLength(
    1,
  );
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(token);
  expect(
    state.writes.some((v) => v.path.includes("/orders") || v.path.includes("/payments")),
  ).toBe(false);
});

test("a lost checkout response recovers its original receipt after refresh without a second order", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  state.uncertain = true;
  await page.goto("/cart");
  await page.getByLabel("Your name", { exact: true }).fill("Synthetic Buyer");
  await page.getByLabel("Contact phone", { exact: true }).fill("+2348000000000");
  await page.getByLabel("Collection branch", { exact: true }).selectOption(branch.id);
  await page
    .getByRole("button", { name: "Review collection details", exact: true })
    .click();
  await page.getByRole("button", { name: "Create unpaid order", exact: true }).click();
  await expect(page.getByText(/order result is uncertain/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Check original request", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create unpaid order", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Check original request", exact: true }).click();
  await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
  expect(state.writes.filter((v) => v.path === "/purchase/orders")).toHaveLength(1);
});

test("pending receipt metadata stays with its original buyer when purchase access changes", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "aat:purchase-order:pending-key:1:a9000000-0000-4000-8000-000000000085",
      "ab000000-0000-4000-8000-000000000099",
    ),
  );
  await page.goto("/cart");
  await expect(
    page.getByRole("button", { name: "Check original request", exact: true }),
  ).toBeVisible();
  state.buyerReference = id(86);
  state.email = "another-synthetic-buyer@example.test";
  await page.evaluate(() => dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByRole("button", { name: "Review collection details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check original request", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem(
        "aat:purchase-order:pending-key:1:a9000000-0000-4000-8000-000000000085",
      ),
    ),
  ).not.toBeNull();
});

test("anonymous cart requests email access without placing an order", async ({
  page,
}) => {
  const state = await purchaseFixture(page, false);
  await page.goto("/cart");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("controlled-recipient@example.test");
  await page
    .getByRole("button", { name: "Send private access link", exact: true })
    .click();
  await expect(
    page.getByText(/If eligible, a private link will arrive shortly/),
  ).toBeVisible();
  expect(state.writes.map((v) => v.path)).toEqual(["/purchase/access/request"]);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("controlled-recipient@example.test");
});

test("keyboard navigation reaches the main content and collection fields", async ({
  page,
}) => {
  await purchaseFixture(page);
  await page.goto("/cart");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByLabel("Your name", { exact: true }).focus();
  await page.keyboard.type("Synthetic keyboard buyer");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contact phone", { exact: true })).toBeFocused();
  await page.keyboard.type("+2348000000000");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Collection branch", { exact: true })).toBeFocused();
});

test("return parameters do not mark a payment paid; provider verification is explicit", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  state.saved = true;
  state.order.paymentId = state.payment.id;
  state.payment.status = "PROCESSING";
  state.payment.attempts.push({
    id: id(84),
    provider: "PAYSTACK",
    attemptNumber: 1,
    status: "PENDING",
    verificationStatus: "PENDING",
    initiatedAt: new Date().toISOString(),
    paidAt: null,
  });
  await page.goto(
    `/purchase/complete?paymentId=${id(83)}&attemptId=${id(84)}&paid=true&reference=fake`,
  );
  await expect(page.getByText(/payment is being processed/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Check payment with provider", exact: true })
    .click();
  await expect(page.getByText(/Payment is confirmed/)).toBeVisible();
  await expect(
    page.getByText(/Wait for a ready-for-collection confirmation/),
  ).toBeVisible();
  expect(state.order.status).toBe("PENDING");
  expect(state.writes.filter((v) => v.path.endsWith("/verify"))).toHaveLength(1);
});

test("an existing attempt recovers the same checkout key in a fresh page", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  state.payment.status = "PROCESSING";
  state.payment.attempts.push({
    id: id(84),
    provider: "PAYSTACK",
    attemptNumber: 1,
    status: "PENDING",
    verificationStatus: "PENDING",
    initiatedAt: new Date().toISOString(),
    paidAt: null,
  });
  await page.goto(`/purchase/payments/${id(83)}`);
  await page
    .getByRole("button", { name: "Recover Paystack checkout", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue to Paystack", exact: true }),
  ).toBeVisible();
  expect(state.writes.find((v) => v.path.endsWith("/checkout"))!.key).toBe(
    guestCheckoutKey(id(83), "PAYSTACK", 1),
  );
});

test("failed product loading, changed availability and account switch fail closed", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  state.missingProduct = true;
  await page.goto("/cart");
  await expect(
    page.getByRole("button", { name: "Review collection details", exact: true }),
  ).toBeDisabled();
  state.missingProduct = false;
  await page.getByRole("button", { name: "Refresh product details" }).click();
  await expect(
    page.getByRole("button", { name: "Review collection details", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Your name", { exact: true }).fill("Private draft name");
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
    "Private draft name",
  );
  state.account = true;
  await page.evaluate(() => dispatchEvent(new Event("aat:session-changed")));
  await expect(
    page.getByRole("heading", { name: "Continue through your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
  expect(state.writes.some((v) => v.path === "/purchase/orders")).toBe(false);
});

test("untrusted gateway links are rejected and expired payments cannot initialize", async ({
  page,
}) => {
  const state = await purchaseFixture(page);
  state.unsafeCheckout = true;
  await page.goto(`/purchase/payments/${id(83)}`);
  await page
    .getByRole("button", { name: "Prepare Paystack checkout", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue to Paystack", exact: true }),
  ).toHaveCount(0);
  state.payment.expiresAt = new Date(Date.now() - 1000).toISOString();
  await page.reload();
  await expect(page.getByText(/payment deadline has passed/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Prepare .* checkout/ })).toHaveCount(0);
  expect(state.writes.filter((v) => v.path.endsWith("/checkout"))).toHaveLength(1);
});
