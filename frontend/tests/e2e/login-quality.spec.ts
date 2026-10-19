import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  loginFixture,
  loginUser,
  credentials,
  submitLogin,
  expectNoSuccess,
} from "../fixtures/login";

test("without JavaScript the form cannot expose credentials in a URL", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(
      (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + "/login",
    );
    await expect(
      page.getByText(
        "Enable JavaScript to sign in. You can still browse our Help Centre.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator("form")).toHaveAttribute("method", "post");
  } finally {
    await context.close();
  }
});
test("invalid credential feedback remains accessible on a short screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  const state = await loginFixture(page);
  state.status = 401;
  await page.goto("/login");
  await submitLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`login fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/login");
    await expect(page).toHaveTitle("Sign in · Allied AutoTech");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(page.locator(".login-editorial")).toBeVisible({ visible: width >= 900 });
    for (const control of await page
      .locator(".login-content input,.login-content button,.login-content a")
      .all()) {
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`login accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("password reveal is reversible and does not submit or persist credentials", async ({
  page,
}) => {
  const state = await loginFixture(page);
  await page.goto("/login");
  await credentials(page);
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
  expect(state.writes).toHaveLength(0);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("Synthetic login password");
});
test("HTML constraints prevent empty or malformed credential submission", async ({
  page,
}) => {
  const state = await loginFixture(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.getByLabel("Email address").fill("invalid");
  await page.getByLabel("Password", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(state.writes).toHaveLength(0);
});
test("pending submission clears and masks password and prevents duplicate writes", async ({
  page,
}) => {
  const state = await loginFixture(page);
  state.delay = true;
  state.status = 401;
  await page.goto("/login");
  await credentials(page);
  await page.getByRole("button", { name: "Show password" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await page.locator("form").evaluate((n) => {
    n.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    n.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(state.writes).toHaveLength(1);
  state.release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be verified",
  );
  await expectNoSuccess(page);
});
for (const [status, code] of [
  [401, "AUTHENTICATION_FAILED"],
  [429, "RATE_LIMITED"],
  [503, "DATABASE_UNAVAILABLE"],
] as const)
  test(`honest ${status} response`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    const state = await loginFixture(page);
    state.status = status;
    state.code = code;
    await page.goto("/login");
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator(".login-editorial");
    const before = await panel.boundingBox();
    const headingTop = await page.locator("h1").evaluate((node) => node.offsetTop);
    await submitLogin(page);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText(/Prisma|confidential/)).toHaveCount(0);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expectNoSuccess(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await panel.boundingBox()).toEqual(before);
    expect(await page.locator("h1").evaluate((node) => node.offsetTop)).toBe(headingTop);
  });
for (const kind of ["empty", "role", "id", "mfa"])
  test(`invalid ${kind} response cannot navigate`, async ({ page }) => {
    const state = await loginFixture(page);
    state.response =
      kind === "empty"
        ? {}
        : {
            user: {
              ...loginUser,
              ...(kind === "id"
                ? { id: "not-uuid" }
                : kind === "role"
                  ? { role: "UNKNOWN" }
                  : { role: "STAFF" }),
            },
            mfaRequired: false,
          };
    await page.goto("/login");
    await submitLogin(page);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Sign in could not be confirmed",
    );
    await expectNoSuccess(page);
  });
test("CSRF refresh failure never announces completed login", async ({ page }) => {
  const state = await loginFixture(page);
  state.csrfFail = true;
  await page.goto("/login");
  await submitLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expectNoSuccess(page);
});
test("network failure keeps recovery available", async ({ page }) => {
  const state = await loginFixture(page);
  state.offline = true;
  await page.goto("/login");
  await submitLogin(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expectNoSuccess(page);
});
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} MFA hands off without announcing full sign-in`, async ({ page }) => {
    const state = await loginFixture(page);
    state.response = { user: { ...loginUser, role }, mfaRequired: true };
    await page.route("**/mfa", (r) =>
      r.fulfill({ contentType: "text/html", body: "<main>MFA handoff</main>" }),
    );
    await page.goto("/login");
    await submitLogin(page);
    await expect(page).toHaveURL(/\/mfa$/);
    expect(state.writes).toHaveLength(1);
  });
for (const next of [
  "/dashboard/cart",
  "https://example.test/steal",
  "//example.test/steal",
  "/admin/users",
])
  test(`safe continuation ${next}`, async ({ page }) => {
    await loginFixture(page);
    await page.route("**/dashboard**", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: "<main>Authenticated destination</main>",
      }),
    );
    await page.goto("/login?next=" + encodeURIComponent(next));
    await submitLogin(page);
    await expect(page).toHaveURL(
      next === "/dashboard/cart" ? /\/dashboard\/cart$/ : /\/dashboard$/,
    );
  });
test("session change clears credentials and discards delayed login", async ({ page }) => {
  const state = await loginFixture(page);
  state.delay = true;
  await page.goto("/login");
  await submitLogin(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  state.release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session changed",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expectNoSuccess(page);
});
test("cross-tab invalidation and restored-page events clear credentials", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await credentials(page);
  await page.getByRole("button", { name: "Show password" }).click();
  const other = await context.newPage();
  await other.goto("/login");
  await other.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage({ type: "changed", source: "another-tab" });
    channel.close();
  });
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await credentials(page);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
});
test("recovery links, breadcrumb and keyboard skip destination are valid", async ({
  page,
}) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to sign in" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sign-in")).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("[aria-current=page]"),
  ).toHaveText("Sign in");
  await page.getByRole("link", { name: "Need help with your account?" }).click();
  await expect(page).toHaveURL(/\/help\/account-security$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test("short viewport and enlarged type keep controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/login");
  await page
    .locator(".login-content :is(h1,p,label,input,a,button)")
    .evaluateAll((nodes) => {
      for (const node of nodes) {
        const element = node as HTMLElement;
        element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 1.5}px`;
      }
    });
  const button = page.getByRole("button", { name: "Sign in", exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
