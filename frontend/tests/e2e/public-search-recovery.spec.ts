import { test, expect, type APIRequestContext, type Request } from "@playwright/test";

const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
async function searchAvailability(request: APIRequestContext, unavailable: boolean) {
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Search recovery requires the isolated loopback fixture");
  const response = await request.post(origin + "/__capabilities", {
    data: {
      mode: "browse_enquiries",
      checkoutApproved: false,
      bookingRequestsEnabled: false,
      productPurchasesEnabled: false,
      searchUnavailable: unavailable,
    },
  });
  expect(response.ok()).toBe(true);
}

for (const [width, height] of [
  [320, 720],
  [1280, 720],
]) {
  test.describe("public search recovery " + width, () => {
    test.use({
      viewport: { width, height },
      // Firefox has no isMobile emulation; retain the exact responsive viewport.
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width === 320);
      },
      hasTouch: width === 320,
    });
    test("one failed catalogue remains distinct from no matches and retry preserves the query", async ({
      page,
      request,
    }, info) => {
      await searchAvailability(request, false);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const reads = new Set<Request>();
      let lastReadActivity = Date.now();
      page.on("request", (read) => {
        reads.add(read);
        lastReadActivity = Date.now();
      });
      const finishRead = (read: Request) => {
        if (reads.delete(read)) lastReadActivity = Date.now();
      };
      page.on("requestfinished", finishRead);
      page.on("requestfailed", finishRead);
      const settleReads = () =>
        expect
          .poll(() => reads.size === 0 && Date.now() - lastReadActivity >= 500, {
            message: "Current document reads and deferred prefetches have settled",
          })
          .toBe(true);
      await page.route("**/api/v1/**", async (route) => {
        expect(route.request().method()).toBe("GET");
        const url = new URL(route.request().url());
        const response = await route.fetch({
          url: origin + url.pathname + url.search,
          maxRedirects: 0,
        });
        await route.fulfill({ response });
      });
      const query = page.getByLabel("Search for", { exact: true });
      const shop = page.getByRole("region", { name: "Shop search results" });
      await page.goto("/search?scope=all&search=Synthetic");
      await expect(
        page.getByRole("button", { name: "Close search", exact: true }),
      ).toBeEnabled();
      await expect(shop).toContainText("Synthetic maker · Part no. TEST-MPN");
      // A recorded WebKit networkidle load state returned while new RSC reads
      // were still active. Observe current requests before changing fixture
      // state; this case covers settled recovery, not interrupted prefetches.
      await settleReads();
      await searchAvailability(request, true);
      await page.reload();
      await expect(shop.getByRole("status")).toContainText(
        "Shop results are temporarily unavailable",
      );
      await expect(
        page.getByRole("region", { name: "Services search results" }),
      ).toContainText("Synthetic wheel service");
      await expect(page.getByText("Shop: no matches", { exact: true })).toHaveCount(0);
      await expect(query).toHaveValue("Synthetic");
      await page.screenshot({ path: info.outputPath("partial-search-failure.png") });
      await settleReads();
      await searchAvailability(request, false);
      await expect(
        page.getByRole("button", { name: "Close search", exact: true }),
      ).toBeEnabled();
      await shop.getByRole("button", { name: "Retry search", exact: true }).click();
      await expect(shop).toContainText("Synthetic maker · Part no. TEST-MPN");
      await expect(shop.getByRole("status")).toHaveCount(0);
      await expect(query).toHaveValue("Synthetic");
      await expect(page.getByLabel("Search in", { exact: true })).toHaveValue("all");
      expect(new URL(page.url()).searchParams.get("search")).toBe("Synthetic");
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
      await settleReads();
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath("search-recovered.png") });
    });
  });
}
