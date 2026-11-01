import { workThreadFixture } from "../fixtures/work-support-detail";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerSupportFixture } from "../fixtures/customer-support";
const quoteId = "b1000000-0000-4000-8000-000000000001";
const orderId = "b1000000-0000-4000-8000-000000000002";
for (const width of [360, 768, 1280])
  test(`quoted parts request review and acceptance at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await customerSupportFixture(page);
    state.records.enquiries.type = "PRODUCT";
    state.records.enquiries.subject = "Replacement filter request";
    const quote = {
      id: quoteId,
      enquiryId: state.records.enquiries.id,
      revision: 2,
      productName: "Replacement filter with a long descriptive name",
      quantity: 2,
      unitPriceKobo: "10000",
      subtotalKobo: "20000",
      taxKobo: "1500",
      totalKobo: "21500",
      status: "ISSUED",
      notes:
        "Collection only. Final compatibility and availability checks follow payment. Contact Customer Care for cancellation or refund review.",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      orderId: null as string | null,
    };
    let writes = 0;
    await page.route("**/api/v1/customers/parts-quotes/**", async (route) => {
      if (route.request().method() === "POST") {
        writes++;
        expect(route.request().postDataJSON()).toEqual({ revision: 2 });
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        expect(route.request().headers()["x-csrf-token"]).toBeTruthy();
        quote.status = "ACCEPTED";
        quote.orderId = orderId;
        return route.fulfill({
          status: 201,
          json: {
            success: true,
            data: { order: { id: orderId } },
            message: "Fixture accepted",
            meta: { requestId: "fixture" },
          },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: { items: [quote] },
          message: "Fixture quotation",
          meta: { requestId: "fixture" },
        },
      });
    });
    await page.goto(`/dashboard/support/enquiries/${state.records.enquiries.id}`);
    await expect(
      page.getByRole("heading", { name: "Parts quotations", exact: true }),
    ).toBeVisible();
    const review = page.getByRole("button", { name: "Review and accept", exact: true });
    await expect(review).toBeEnabled();
    await review.click();
    await expect(page.getByRole("dialog")).toContainText(
      "Payment does not confirm compatibility",
    );
    await page.keyboard.press("Escape");
    await expect(review).toBeFocused();
    await review.click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`quotation-review-${width}.png`) });
    await page
      .getByRole("button", { name: "Confirm quotation decision", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open linked order", exact: true }),
    ).toHaveAttribute("href", `/dashboard/orders/${orderId}`);
    expect(writes).toBe(1);
    await expect(review).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`quotation-accepted-${width}.png`) });
  });

test("administrator issues a quotation from the original short parts request", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { detail: state } = await workThreadFixture(page, "ADMIN", "enquiries");
  state.record.type = "PRODUCT";
  state.record.serviceId = null as unknown as string;
  state.record.message = "Please quote a replacement filter.";
  const productId = "b1000000-0000-4000-8000-000000000003";
  let items: unknown[] = [],
    count = 0;
  await page.route("**/api/v1/public/catalog/products?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { items: [{ id: productId, name: "Assessed replacement filter" }] },
        message: "Fixture product",
        meta: { requestId: "fixture" },
      },
    }),
  );
  await page.route("**/api/v1/admin/parts-quotes/**", async (route) => {
    if (route.request().method() === "POST") {
      count++;
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({
        expectedRevision: 0,
        productId,
        quantity: 2,
        unitPriceKobo: "10000",
      });
      const quote = {
        ...body,
        id: quoteId,
        enquiryId: state.record.id,
        revision: 1,
        productName: "Assessed replacement filter",
        subtotalKobo: "20000",
        taxKobo: "1500",
        totalKobo: "21500",
        status: "ISSUED",
        orderId: null,
      };
      items = [quote];
      return route.fulfill({
        status: 201,
        json: {
          success: true,
          data: quote,
          message: "Fixture issued",
          meta: { requestId: "fixture" },
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        data: { items },
        message: "Fixture quotes",
        meta: { requestId: "fixture" },
      },
    });
  });
  await page.goto(`/admin/support/enquiries/${state.record.id}`);
  await expect(
    page.getByRole("heading", { name: "Prepare a quotation", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Related record", { exact: true }).selectOption(productId);
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit price in naira, before VAT").fill("100.00");
  await page
    .getByLabel("Expiry date (6pm Nigeria time)")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page
    .getByLabel("Assessment, lead time and cancellation/refund terms")
    .fill(
      "Assessed replacement filter. Collection only; compatibility and availability checked after payment. Contact care for cancellation/refund review.",
    );
  await page.getByRole("button", { name: "Review quotation", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Assessed replacement filter");
  await page
    .getByRole("button", { name: "Confirm quotation decision", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Assessed replacement filter Revision 1/ }),
  ).toBeVisible();
  expect(count).toBe(1);
  await page
    .getByRole("heading", { name: "Parts quotations", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("staff-parts-quotation.png") });
});

test("signed-in unlisted parts request collects quantity without mandatory vehicle or notes", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await customerSupportFixture(page);
  await page.goto("/contact?parts=1#enquiry");
  await page
    .getByLabel("Requested part or product", { exact: true })
    .fill("Universal cleaning product");
  await page.getByLabel("Quantity", { exact: true }).fill("3");
  await page.getByLabel("Additional notes (optional)").fill("");
  await page.getByRole("button", { name: /Review enquiry/i }).click();
  await expect(page.getByRole("dialog")).toContainText("Quantity: 3");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send enquiry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request received", exact: true }),
  ).toBeVisible();
  const write = state.writes.find((w) => w.endpoint === "/customers/support/enquiries");
  expect(write?.body).toMatchObject({
    type: "PRODUCT",
    message: "Requested part or product: Universal cleaning product\nQuantity: 3",
  });
  expect(write?.body).not.toHaveProperty("productId");
  await page.screenshot({ path: info.outputPath("unlisted-parts-request.png") });
});
