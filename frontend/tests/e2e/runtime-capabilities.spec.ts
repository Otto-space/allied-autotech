import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "../fixtures/overview-browser";

// This control belongs to a separate loopback, in-memory API fixture, never the application.
const control = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
async function availability(
  request: APIRequestContext,
  mode = "browse_enquiries",
  extra = {},
) {
  if (!control || !/^http:\/\/127\.0\.0\.1:\d+$/.test(control))
    throw Error("A loopback capability fixture is required");
  const response = await request.post(`${control}/__capabilities`, {
    data: { mode, ...extra },
  });
  expect(response.ok()).toBe(true);
}
for (const width of [320, 768, 1440]) {
  test(`independent module switches retain truthful journeys at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await availability(request, "full", {
      checkoutApproved: true,
      bookingRequestsEnabled: false,
      productPurchasesEnabled: true,
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Returning from checkout does not confirm payment",
    );
    await availability(request, "full", {
      checkoutApproved: true,
      bookingRequestsEnabled: true,
      productPurchasesEnabled: false,
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
  test(`runtime availability overrides deployment-time copy and guards direct checkout at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request);
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    page.on("request", (r) => {
      if (
        new URL(r.url()).pathname.startsWith("/api/v1/") &&
        !["GET", "HEAD"].includes(r.method())
      )
        writes.push(r.url());
    });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    const response = await page.request.get("/checkout");
    expect(new URL(response.url()).pathname).toBe("/contact");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
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
    await page.screenshot({ path: info.outputPath(`runtime-disabled-${width}.png`) });
    expect(writes).toEqual([]);
  });
  test(`full appointment availability remains distinct from closed finance at ${width}px`, async ({
    page,
    request,
  }) => {
    await availability(request, "full", { checkoutApproved: false });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await page.goto("/help/booking-a-service");
    await expect(page.locator("main")).toContainText("Sign in to send a booking request");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
    await availability(request, "full");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Returning from checkout does not confirm payment",
    );
    await fixture(page, "CUSTOMER");
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/dashboard\/cart#cart-checkout-form$/);
    await expect(
      page.getByRole("heading", { name: "Your cart", exact: true }),
    ).toBeVisible();
  });
  test(`stale tabs close actions and unavailable checks preserve contact drafts at ${width}px`, async ({
    page,
    request,
  }, info) => {
    await availability(request, "full");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: "Request a visit", exact: true }),
    ).toBeVisible();
    await availability(request);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("link", { name: "Ask about a workshop visit", exact: true }),
    ).toBeVisible();
    await page.goto("/contact");
    const subject = page.getByLabel("Subject", { exact: true });
    await expect(subject).toBeEnabled();
    await subject.fill("Synthetic unsent availability check");
    await availability(request, "browse_enquiries", { fail: true });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("complementary", { name: "Online availability" }),
    ).toBeVisible();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    await expect(subject).toBeDisabled();
    expect(await (await page.request.get("/register")).text()).toContain(
      "Account creation is temporarily unavailable",
    );
    await availability(request);
    await page.getByRole("button", { name: "Check availability again" }).click();
    await expect(subject).toBeEnabled();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(subject).toBeDisabled();
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(subject).toBeEnabled();
    await expect(subject).toHaveValue("Synthetic unsent availability check");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`runtime-recovered-${width}.png`) });
  });
}

test("server-rendered availability remains truthful without JavaScript", async ({
  browser,
  request,
}) => {
  await availability(request, "full", { checkoutApproved: false });
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/services?categoryId=37ec8bcf-7edc-4ec7-a185-ec849d71c5de");
    await expect(
      page.getByRole("link", { name: /^Describe a vehicle problem/ }),
    ).toHaveAttribute("href", "/services/request");
    await page.goto("/help/pending-payments");
    await expect(page.locator("main")).toContainText(
      "Online checkout and payments are not available yet",
    );
    expect(new URL((await page.request.get("/checkout")).url()).pathname).toBe(
      "/contact",
    );
  } finally {
    await context.close();
  }
});
