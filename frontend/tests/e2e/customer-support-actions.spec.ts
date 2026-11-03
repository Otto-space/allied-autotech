import { expect, test } from "@playwright/test";
import { customerSupportFixture } from "../fixtures/customer-support";

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`customer support primary actions ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      isMobile: width <= 430,
      hasTouch: width <= 768,
    });
    test("long requests retain reachable status, details and navigation", async ({
      page,
    }, info) => {
      const state = await customerSupportFixture(page);
      state.records.enquiries.subject =
        "Parts compatibility question for my vehicle with a long recorded description";
      await page.goto("/dashboard/support");
      expect(
        await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ).toEqual({ width, height });
      for (const kind of ["enquiries", "complaints"] as const) {
        await page.getByLabel("Record category").selectOption(kind);
        const action = page.getByRole("link", {
          name: `View ${state.records[kind].subject}`,
          exact: true,
        });
        await expect(action).toBeVisible();
        const region = page.getByRole("region", {
          name: "Your customer care requests",
          exact: true,
        });
        expect(await region.evaluate((el) => el.scrollLeft)).toBe(0);
        const rect = await action.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        expect(rect!.height).toBeGreaterThanOrEqual(44);
        await expect(action.locator("..")).toContainText(state.records[kind].subject);
        await expect(action.locator("..").locator("[data-status]")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
        if (kind === "enquiries") {
          await action.focus();
          await page.screenshot({ path: info.outputPath("support-requests.png") });
          await page.keyboard.press("Enter");
        } else await action.click();
        await expect(page).toHaveURL(
          new RegExp(`/dashboard/support/${kind}/${state.records[kind].id}`),
        );
        await expect(
          page.getByRole("heading", { name: state.records[kind].subject, exact: true }),
        ).toBeVisible();
        await page.goBack();
      }
      expect(state.writes).toEqual([]);
    });
  });
}
