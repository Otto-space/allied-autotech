import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { purchaseFixture, guestProduct } from "../fixtures/purchase-guest";
import { branch, id } from "../fixtures/public-account-actions";

async function fixture(page: Page) {
  const state = await purchaseFixture(page);
  const quotation = {
    id: id(95),
    supplyRemedyChoiceId: null as string | null,
    alternativeAgreementVersion: undefined as string | undefined,
    enquiryId: id(96),
    revision: 1,
    productName: guestProduct.name,
    sku: guestProduct.sku,
    quantity: 2,
    unitPriceKobo: "10000",
    subtotalKobo: "20000",
    taxKobo: "1500",
    totalKobo: "21500",
    status: "ISSUED",
    notes:
      "Synthetic assessment. Collection only. Payment is separate from final suitability, availability and collection readiness.",
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    orderId: null as string | null,
  };
  const extra = {
    quotation,
    branch: branch as typeof branch | null,
    accepted: false,
    loseResponse: false,
    failList: false,
  };
  const success = (data: unknown) => ({
    success: true,
    data,
    message: "Synthetic guest quotation",
    meta: { requestId: "guest-quote-fixture" },
  });
  await page.route("**/api/v1/purchase/orders/original-request", (route) => {
    return route.fulfill({
      json: success({
        found: extra.accepted,
        order: extra.accepted ? state.order : null,
      }),
    });
  });
  await page.route("**/api/v1/purchase/parts-quotes**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (!state.access)
      return route.fulfill({
        status: 401,
        json: {
          success: false,
          error: { code: "AUTHENTICATION_FAILED" },
          meta: { requestId: "qa" },
        },
      });
    if (req.method() === "GET")
      return route.fulfill(
        extra.failList
          ? {
              status: 503,
              json: {
                success: false,
                error: { code: "DATABASE_UNAVAILABLE" },
                meta: { requestId: "qa" },
              },
            }
          : { json: success({ items: [{ quotation, collectionBranch: extra.branch }] }) },
      );
    state.writes.push({
      path,
      body: req.postDataJSON(),
      key: req.headers()["idempotency-key"],
      csrf: req.headers()["x-csrf-token"],
    });
    if (path.endsWith("/decline")) {
      quotation.status = "REJECTED";
      return route.fulfill({ json: success(quotation) });
    }
    if (path.endsWith("/accept")) {
      extra.accepted = true;
      quotation.status = "ACCEPTED";
      quotation.orderId = state.order.id;
      state.saved = true;
      state.order.partsQuote = {
        id: quotation.id,
        enquiryId: quotation.enquiryId,
        revision: quotation.revision,
        notes: quotation.notes,
      };
      if (extra.loseResponse) return route.abort("failed");
      return route.fulfill({
        status: 201,
        json: success({ order: state.order, replayed: false }),
      });
    }
    return route.fulfill({
      status: 404,
      json: { success: false, error: { code: "NOT_FOUND" }, meta: { requestId: "qa" } },
    });
  });
  return { state, extra };
}
async function enterContact(page: Page) {
  await page
    .getByLabel("Name for collection", { exact: true })
    .fill("Synthetic quotation buyer");
  await page.getByLabel("Collection phone", { exact: true }).fill("+2348000000000");
}
for (const width of [320, 768, 1366])
  test(`guest quotation review and unpaid order at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { state } = await fixture(page);
    await page.goto("/purchase");
    await expect(
      page.getByRole("heading", { name: "Your quotations", exact: true }),
    ).toBeVisible();
    await enterContact(page);
    const review = page.getByRole("button", {
      name: "Review and accept quotation",
      exact: true,
    });
    await review.click();
    await expect(page.getByRole("dialog")).toContainText("unpaid collection order");
    await page.keyboard.press("Escape");
    await expect(review).toBeFocused();
    await review.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("₦215.00");
    await page.screenshot({
      path: info.outputPath(`synthetic-guest-quotation-${width}.png`),
      fullPage: false,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Confirm decision", exact: true }).click();
    await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
    const writes = state.writes.filter((row) => row.path.endsWith("/accept"));
    expect(writes).toHaveLength(1);
    expect(writes[0]!.body).toEqual({
      revision: 1,
      contact: { name: "Synthetic quotation buyer", phone: "+2348000000000" },
    });
    expect(writes[0]!.csrf).toBe("c".repeat(43));
    expect(writes[0]!.key).toBe(`purchase-quote-accept:${id(95)}:1`);
    expect(state.writes.some((row) => row.path.includes("/payments"))).toBe(false);
  });

for (const width of [320, 1440])
  test(`guest actual alternative acceptance retains original financial review at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, extra } = await fixture(page);
    extra.quotation.supplyRemedyChoiceId = id(97);
    extra.quotation.alternativeAgreementVersion = "SUPPLY_ALTERNATIVE_20261110_V1";
    await page.goto("/purchase");
    await enterContact(page);
    await expect(
      page.getByText("This is an alternative for affected original goods.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Review and accept quotation", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "No store credit or transfer of the original payment is authorised.",
    );
    expect(state.writes.filter((x) => x.path.endsWith("/accept"))).toHaveLength(0);
    await page.screenshot({
      path: info.outputPath(`alternative-guest-review-${width}.png`),
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await dialog.getByRole("button", { name: "Confirm decision", exact: true }).click();
    await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
    expect(state.writes.filter((x) => x.path.endsWith("/accept"))).toHaveLength(1);
    expect(state.writes.some((x) => x.path.includes("/payments"))).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });

test("decline needs an explicit review and creates no order or payment", async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page.goto("/purchase");
  await page.getByRole("button", { name: "Review decline", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Declining closes this offer");
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(page.getByText("Declined", { exact: true })).toBeVisible();
  expect(
    state.writes
      .map((row) => row.path)
      .filter((path) => path !== "/purchase/access/csrf"),
  ).toEqual([`/purchase/parts-quotes/${id(95)}/decline`]);
  expect(state.saved).toBe(false);
});

test("same-buyer focus refresh keeps contact drafts but identity change closes and clears a private review", async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page.goto("/purchase");
  await enterContact(page);
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Name for collection", { exact: true })).toHaveValue(
    "Synthetic quotation buyer",
  );
  await page
    .getByRole("button", { name: "Review and accept quotation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  state.access = false;
  await page.evaluate(() => dispatchEvent(new Event("aat:session-changed")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Name for collection", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("Synthetic quotation buyer");
});

test("lost acceptance response recovers the original order without submitting another decision", async ({
  page,
}) => {
  const { state, extra } = await fixture(page);
  extra.loseResponse = true;
  await page.goto("/purchase");
  await enterContact(page);
  await page
    .getByRole("button", { name: "Review and accept quotation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
  expect(state.writes.filter((row) => row.path.endsWith("/accept"))).toHaveLength(1);
});

test("changed collection details and expired offers cannot be accepted", async ({
  page,
}) => {
  const { state, extra } = await fixture(page);
  extra.branch = null;
  await page.goto("/purchase");
  await expect(
    page.getByRole("button", { name: "Review and accept quotation", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Collection details changed/)).toBeVisible();
  extra.branch = branch;
  extra.quotation.expiresAt = new Date(Date.now() - 1000).toISOString();
  await page.getByRole("button", { name: "Refresh quotations", exact: true }).click();
  await expect(page.getByText("Expired", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review and accept quotation", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test("a quotation-read failure leaves owned order history usable", async ({ page }) => {
  const { state, extra } = await fixture(page);
  extra.failList = true;
  state.saved = true;
  await page.goto("/purchase");
  await expect(page.getByText(/Quotations could not be loaded/)).toBeVisible();
  await page
    .getByRole("link", {
      name: `View details for ${state.order.orderNumber}`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
  expect(state.writes).toHaveLength(0);
});

test("a confirmation disables itself when availability cannot be checked and resumes after recovery", async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page.goto("/purchase");
  await enterContact(page);
  await page
    .getByRole("button", { name: "Review and accept quotation", exact: true })
    .click();
  state.unavailable = true;
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  const confirm = page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm decision", exact: true });
  await expect(confirm).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.unavailable = false;
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page).toHaveURL(`/purchase/orders/${id(81)}`);
  expect(state.writes.filter((row) => row.path.endsWith("/accept"))).toHaveLength(1);
});
