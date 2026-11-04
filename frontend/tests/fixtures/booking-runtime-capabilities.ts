import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Only the isolated production-build fixture has this explicit control origin.
 * Existing local/hosted fixture runs keep their normal capabilities transport. */
export async function bookingRuntimeCapabilities(request: APIRequestContext, page: Page) {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (!origin) return;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Booking capability control must use the isolated loopback fixture");
  const response = await request.post(`${origin}/__capabilities`, {
    data: {
      mode: "full",
      checkoutApproved: false,
      bookingRequestsEnabled: true,
      productPurchasesEnabled: false,
      fail: false,
    },
  });
  expect(response.ok()).toBe(true);
  // The production build keeps its CI placeholder rewrite. Route browser reads
  // to the same loopback process as the server-side fixture, not that placeholder.
  await page.route("**/api/v1/public/capabilities", async (route) => {
    const response = await route.fetch({
      url: `${origin}/api/v1/public/capabilities`,
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
}
