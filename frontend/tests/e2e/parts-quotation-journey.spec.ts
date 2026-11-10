import { workThreadFixture } from "../fixtures/work-support-detail";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { customerSupportFixture } from "../fixtures/customer-support";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
async function enabledQuotationCapabilities(page: Page) {
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "Explicit enabled quotation fixture",
        data: publicCapabilitiesFixture("full"),
        meta: { requestId: "quotation-capability-fixture" },
      },
    }),
  );
}
const quoteId = "b1000000-0000-4000-8000-000000000001";
const orderId = "b1000000-0000-4000-8000-000000000002";
for (const width of [360, 768, 1280])
  test(`actual alternative quotation review and acceptance at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await customerSupportFixture(page);
    await enabledQuotationCapabilities(page);
    state.records.enquiries.type = "PRODUCT";
    state.records.enquiries.subject = "Replacement filter request";
    const quote = {
      id: quoteId,
      alternativeAgreementVersion: "SUPPLY_ALTERNATIVE_20261110_V1",
      supplyRemedyChoiceId: "b1000000-0000-4000-8000-000000000050",
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
        "Collection only. Compatibility and availability checks precede payment. Original affected goods require separate verified financial resolution before another payment. Contact Customer Care for cancellation or refund review.",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      orderId: null as string | null,
    };
    let writes = 0;
    await page.route("**/api/v1/customers/parts-quotes/**", async (route) => {
      if (route.request().method() === "POST") {
        writes++;
        expect(route.request().postDataJSON()).toEqual({
          revision: 2,
          alternativeAgreementVersion: "SUPPLY_ALTERNATIVE_20261110_V1",
        });
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
      "No store credit or transfer of the original payment is authorised.",
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

for (const width of [360, 768, 1366])
  test(`administrator issues a seven-day quotation from the original request at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { detail: state } = await workThreadFixture(page, "ADMIN", "enquiries");
    await enabledQuotationCapabilities(page);
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
        expect(body).not.toHaveProperty("expiresAt");
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
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
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
    await expect(
      page.getByText(
        "Valid for 7 days from issue. The saved quotation shows its exact expiry.",
      ),
    ).toBeVisible();
    await page.getByLabel("Unit price in naira, before VAT").focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel("Assessment, lead time and cancellation/refund terms"),
    ).toBeFocused();
    await page
      .getByLabel("Assessment, lead time and cancellation/refund terms")
      .fill(
        "Assessed replacement filter. Collection only; compatibility and availability checked after payment. Contact care for cancellation/refund review.",
      );
    await page.getByRole("button", { name: "Review quotation", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Assessed replacement filter");
    await expect(page.getByRole("dialog")).toContainText("7 days from issue");
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
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`staff-parts-quotation-${width}.png`),
    });
  });

test("signed-in unlisted parts request collects quantity without mandatory vehicle or notes", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await customerSupportFixture(page);
  await enabledQuotationCapabilities(page);
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
