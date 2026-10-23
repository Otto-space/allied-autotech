import { expect, test } from "@playwright/test";

for (const path of [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/verify-email",
]) {
  test(`${path} never calls delayed JavaScript disabled`, async ({ page }) => {
    let release!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        status: 401,
        json: { success: false, error: { code: "SESSION_EXPIRED" } },
      }),
    );
    await page.route("**/_next/static/**", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    try {
      await page.goto(path, { waitUntil: "commit" });
      await expect(page.locator(".login-form h1")).toBeVisible();
      await expect(page.locator("noscript p")).not.toBeVisible();
      await expect(page.locator(".login-form form:visible")).toHaveCount(0);
      release();
      await expect(page.locator(".login-form noscript")).toHaveAttribute("hidden", "");
      await expect(page.locator("noscript p")).not.toBeVisible();
      if (path === "/login") await expect(page.getByLabel("Email address")).toBeVisible();
    } finally {
      release();
    }
  });
}

test("authentication links keep the JavaScript-disabled notice hidden", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  for (const path of ["/forgot-password", "/login", "/register"]) {
    await page.locator(`.login-form a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator(".login-form noscript")).toHaveAttribute("hidden", "");
    await expect(page.locator("noscript p")).not.toBeVisible();
  }
});
