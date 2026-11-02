import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Separate in-memory loopback fixture with the real server catalogue projection.
const control = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
for (const width of [320, 1440]) {
  test(`public Help catalogue renders complete guidance and preserves FAQs during an optional-source failure at ${width}px`, async ({
    page,
    request,
  }, info) => {
    if (!control || !/^http:\/\/127\.0\.0\.1:\d+$/.test(control))
      throw Error("A loopback catalogue fixture is required");
    const configure = async (learningFailed: boolean) => {
      expect(
        (
          await request.post(control + "/__capabilities", {
            data: { mode: "browse_enquiries", learningFailed },
          })
        ).ok(),
      ).toBe(true);
    };
    await configure(false);
    await page.setViewportSize({ width, height: 900 });
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes.push(request.url());
    });
    await page.goto("/search?scope=help&search=inspect");
    const faq = page
      .getByRole("region", { name: "Help search results" })
      .getByRole("link", { name: "Can I inspect a vehicle before buying?", exact: true });
    await expect(faq).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "results are temporarily unavailable",
    );
    await page.goto("/learn?article=service-request");
    const article = page.getByRole("article", {
      name: "Ask about a service or workshop visit",
      exact: true,
    });
    await expect(article).toBeVisible();
    await expect(article.locator("ol > li")).toHaveCount(12);
    await expect(article).toContainText("wait for the current availability check");
    await expect(article).toContainText("No booking deposit is required");
    await expect(article).toContainText("Declining keeps your existing appointment");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`complete-guide-${width}.png`) });
    await configure(true);
    await page.goto("/search?scope=help&search=inspect");
    await expect(faq).toBeVisible();
    await expect(page.locator("main")).toContainText(
      "More Help & Learn results are temporarily unavailable",
    );
    await expect(page.locator("main")).not.toContainText("No help results found");
    await configure(false);
    await page.getByRole("button", { name: "Retry search", exact: true }).click();
    await expect(faq).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "results are temporarily unavailable",
    );
    expect(writes).toEqual([]);
  });
}
