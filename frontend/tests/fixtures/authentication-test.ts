import { test as base, expect } from "@playwright/test";

export { expect };
export type { Page, Route } from "@playwright/test";

// Only the required account project controls the isolated capability service.
// Other projects and hosted checks retain their existing availability setup.
export const test = base.extend({
  page: async ({ page, request }, runPage, testInfo) => {
    if (testInfo.project.name === "account-design") {
      const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
      if (origin !== "http://127.0.0.1:5024") {
        throw new Error("Account design fixtures require the isolated loopback API");
      }
      const restored = await request.post(`${origin}/__capabilities`, {
        data: { mode: "full", fail: false },
      });
      expect(restored.ok()).toBe(true);
      await page.route("**/api/v1/public/capabilities", async (route) => {
        const response = await route.fetch({
          url: `${origin}/api/v1/public/capabilities`,
          maxRedirects: 0,
        });
        await route.fulfill({ response });
      });
    }
    await runPage(page);
  },
});
