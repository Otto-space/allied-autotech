import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request, page }) => {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (!origin) return;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Authentication fixtures require the isolated loopback API");
  const restored = await request.post(`${origin}/__capabilities`, {
    data: { mode: "full", fail: false },
  });
  expect(restored.ok()).toBe(true);
  // Background availability checks are independent of the auth response under test.
  await page.route("**/api/v1/public/capabilities", async (route) => {
    const response = await route.fetch({
      url: `${origin}/api/v1/public/capabilities`,
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
});

test("registration completes cleanly and clears the password after a successful response", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await page.route("**/api/v1/auth/register", async (route) => {
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
  if (process.env.CAPABILITY_TEST_CONTROL_ORIGIN) {
    const refreshed = page.waitForResponse("**/api/v1/public/capabilities");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    expect((await refreshed).ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      "test-only unique passphrase",
    );
    expect(calls).toHaveLength(0);
  }
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(
    page.getByText("Check your email for verification instructions before signing in.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  const notifications = page.getByRole("region", { name: "Notifications", exact: true });
  await expect(
    notifications.getByText("Check your email for the next step."),
  ).toBeVisible();
  await notifications.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(
    notifications.getByText("Check your email for the next step."),
  ).toHaveCount(0);
  expect(calls).toHaveLength(1);
});

test("an offscreen sign-in error scrolls into view and never exposes server exception text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        success: false,
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "Prisma P2002: confidential database details",
        },
      },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("unknown@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toHaveText("The email or password could not be verified.");
  await expect
    .poll(async () => {
      const box = await error.boundingBox();
      return !!box && box.y >= 0 && box.y + box.height <= 500;
    })
    .toBe(true);
  await expect(page.getByText(/Prisma|confidential database/)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Notifications", exact: true }),
  ).toContainText("Please review the message on this page.");
});

test("verification token stays out of requests until explicit form submission", async ({
  page,
}) => {
  const token = "isolated-verification-token-".repeat(3);
  const bodies: unknown[] = [];
  page.on("request", (request) => expect(request.url()).not.toContain(token));
  await page.route("**/api/v1/auth/email/verify", async (route) => {
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
  const menu = page.getByRole("dialog", { name: "Mobile navigation" });
  await menu.getByRole("link", { name: "Shop", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});
