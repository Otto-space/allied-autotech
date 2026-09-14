import { test, expect } from "@playwright/test";

test("registration completes cleanly and clears the password after a successful response", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    expect(new URL(route.request().url()).pathname).toBe("/api/v1/auth/register");
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      json: {
        success: true,
        message: "Do not show arbitrary response text",
        meta: { requestId: "isolated-register" },
      },
    });
  });
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.getByLabel("First name").fill("Isolated");
  await page.getByLabel("Last name").fill("Customer");
  await page.getByLabel("Phone number").fill("+2348000000000");
  await page.getByLabel("Email address").fill("registration@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only unique passphrase");
  await page.getByRole("button", { name: "Create customer account" }).click();
  await expect(
    page.getByText("If registration can be completed", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(calls).toHaveLength(1);
});

test("verification token stays out of requests until explicit form submission", async ({
  page,
}) => {
  const token = "isolated-verification-token-".repeat(3);
  const bodies: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    expect(new URL(route.request().url()).pathname).toBe("/api/v1/auth/email/verify");
    expect(route.request().url()).not.toContain(token);
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        success: true,
        message: "Verified",
        meta: { requestId: "isolated-verification" },
      },
    });
  });
  await page.goto(`/verify-email#token=${encodeURIComponent(token)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(
    page.getByText("Your email has been verified.", { exact: false }),
  ).toBeVisible();
  expect(bodies).toEqual([{ token }]);
});

test("mobile navigation supports Escape and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/help", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await menu.getByRole("link", { name: "Parts", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});
