import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetFixture, resetToken, resetPassword } from "../fixtures/password-reset";
const linked = `/reset-password#token=${encodeURIComponent(resetToken)}`;

test("query-string tokens are not adopted and are removed from the address", async ({
  page,
}) => {
  const state = await resetFixture(page);
  await page.goto(`/reset-password?token=${encodeURIComponent(resetToken)}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator("#reset-token-input")).toHaveValue("");
  expect(state.writes).toHaveLength(0);
});

test("forbidden request retains a recovery path without claiming an expired link", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.status = 403;
  state.code = "CSRF_INVALID";
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be verified",
  );
  await expect(
    page.getByRole("link", { name: "Request a new link", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Password reset", exact: true }),
  ).toHaveCount(0);
});

test("leaving a pending reset cannot announce completion on another page", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.delay = true;
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page.getByRole("link", { name: "Return to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  state.release?.();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(
    page.getByText("Your password has been reset.", { exact: false }),
  ).toHaveCount(0);
});

test("hiding the page re-masks both secrets", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByLabel("Recovery token", { exact: true }).fill(resetToken);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Show recovery token" }).click();
  await page.getByRole("button", { name: "Show new password" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#reset-token-input")).toHaveAttribute("type", "password");
  await expect(page.locator("#reset-new-password")).toHaveAttribute("type", "password");
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`reset link and manual entry fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of [linked, "/reset-password"]) {
      await page.goto(route);
      await expect(page).toHaveTitle("Reset password · Allied AutoTech");
      await expect(
        page.getByRole("heading", { name: "Choose a new password." }),
      ).toBeVisible();
      for (const control of await page
        .locator(
          ".login-content input,.login-content button,.login-content a,.login-content summary",
        )
        .all())
        if (await control.isVisible()) {
          await expect(control).toBeInViewport();
          expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`reset accessible ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/reset-password");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("fragment is removed, token stays masked and no reset happens on arrival", async ({
  page,
}) => {
  const state = await resetFixture(page);
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(linked);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator("#reset-token-input")).toHaveValue(resetToken);
  await expect(page.locator(".reset-token")).not.toHaveAttribute("open", "");
  expect(state.writes).toHaveLength(0);
  expect(urls.some((u) => u.includes(resetToken))).toBe(false);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(resetToken);
});
test("manual token and password reveals are independent and never submit", async ({
  page,
}) => {
  const state = await resetFixture(page);
  await page.goto("/reset-password");
  await page.getByLabel("Recovery token", { exact: true }).fill(resetToken);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Show recovery token" }).click();
  await expect(page.getByLabel("Recovery token", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Show new password" }).click();
  await expect(page.getByRole("button", { name: "Hide new password" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Hide recovery token" }).click();
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
    resetPassword,
  );
  expect(state.writes).toHaveLength(0);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(resetPassword);
});
test("complete reset clears secrets, announces session change and offers sign in", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.delay = true;
  await page.goto(linked);
  await page.evaluate(() => {
    (window as typeof window & { resetEvents?: number }).resetEvents = 0;
    window.addEventListener("aat:session-changed", () => {
      const w = window as typeof window & { resetEvents: number };
      w.resetEvents++;
    });
  });
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Show new password" }).click();
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resetting password…" })).toBeDisabled();
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  state.release?.();
  await expect(
    page.getByRole("heading", { name: "Password reset", exact: true }),
  ).toBeFocused();
  expect(state.writes).toEqual([{ token: resetToken, password: resetPassword }]);
  await expect(page.locator("#reset-token-input")).toHaveValue("");
  await expect(page.locator("#reset-new-password")).toHaveValue("");
  expect(
    await page.evaluate(
      () => (window as typeof window & { resetEvents: number }).resetEvents,
    ),
  ).toBe(1);
  await expect(page.getByRole("status")).toHaveText(
    "Your password has been reset. Sign in with your new password.",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Return to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("invalid link clears secrets and supports new-link or manual recovery", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.status = 400;
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Request a new link", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#reset-token-input")).toHaveValue("");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(
    page.getByRole("link", { name: "Request a new link", exact: true }),
  ).toHaveAttribute("href", "/forgot-password");
  await page.getByRole("button", { name: "Use another recovery token" }).click();
  await expect(page.getByLabel("Recovery token", { exact: true })).toBeFocused();
});
for (const kind of ["network", "malformed", "unavailable"])
  test(`uncertain ${kind} result offers sign-in without retrying the token`, async ({
    page,
  }) => {
    const state = await resetFixture(page);
    state.offline = kind === "network";
    state.malformed = kind === "malformed";
    if (kind === "unavailable") state.status = 503;
    await page.goto(linked);
    await page.getByLabel("New password", { exact: true }).fill(resetPassword);
    await page.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check before trying again" }),
    ).toBeFocused();
    await expect(page.locator("#reset-token-input")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Reset password", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Prisma|private raw|Do not echo/)).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    if (kind === "network")
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
test("common-password rejection associates sanitized feedback and preserves token", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.status = 422;
  state.code = "VALIDATION_FAILED";
  state.field = true;
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Choose a different",
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#reset-token-input")).toHaveValue(resetToken);
  await expect(page.getByText(/Prisma|Do not echo/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("native validation exposes an empty collapsed token field", async ({ page }) => {
  const state = await resetFixture(page);
  await page.goto("/reset-password");
  await page.locator("summary").click();
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByLabel("Recovery token", { exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("duplicate submit and account change discard pending credentials", async ({
  page,
}) => {
  const state = await resetFixture(page);
  state.delay = true;
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page
    .locator("form")
    .evaluate((e) =>
      e.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  expect(state.writes).toHaveLength(1);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session changed",
  );
  await expect(page.locator("#reset-token-input")).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Password reset", exact: true }),
  ).toHaveCount(0);
});
test("cross-tab and restored-page events clear the token", async ({ page, context }) => {
  await page.goto(linked);
  const other = await context.newPage();
  await other.goto("/login");
  await other.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage({ type: "changed", source: "reset-qa" });
    c.close();
  });
  await expect(page.locator("#reset-token-input")).toHaveValue("");
  await page.getByLabel("Recovery token", { exact: true }).fill(resetToken);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.locator("#reset-token-input")).toHaveValue("");
});
test("new fragments replace old credentials without a request", async ({ page }) => {
  const state = await resetFixture(page);
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await page.evaluate((t) => {
    window.location.hash = "token=" + t;
  }, resetToken + "new");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator("#reset-token-input")).toHaveValue(resetToken + "new");
  await expect(page.locator("#reset-new-password")).toHaveValue("");
  expect(state.writes).toHaveLength(0);
});
test("rate-limited reset honors the server delay", async ({ page }) => {
  const state = await resetFixture(page);
  state.status = 429;
  state.code = "RATE_LIMITED";
  state.retryAfter = "3";
  await page.clock.install();
  await page.goto(linked);
  await page.getByLabel("New password", { exact: true }).fill(resetPassword);
  const button = page.getByRole("button", { name: "Reset password", exact: true });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByText("Try again in about 1 minute.")).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(button).toBeEnabled();
});
test("short screen and enlarged text keep reset actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/reset-password");
  await page
    .locator(".login-content :is(h1,p,label,input,a,button,summary)")
    .evaluateAll((nodes) => {
      for (const node of nodes) {
        const el = node as HTMLElement;
        el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 1.5}px`;
      }
    });
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Reset password", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("no JavaScript prevents token or password submission", async ({ browser }) => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  try {
    const p = await c.newPage();
    await p.goto((process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + linked);
    await expect(
      p
        .locator("noscript p")
        .filter({ hasText: "Enable JavaScript to reset your password." }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Reset password", exact: true }),
    ).toHaveCount(0);
    await expect(p.locator("form")).toHaveAttribute("method", "post");
  } finally {
    await c.close();
  }
});
test("breadcrumb and skip navigation identify password reset", async ({ page }) => {
  await page.goto(linked);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to reset password" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#reset-password")).toBeFocused();
  await expect(page.locator("#reset-token-input")).toHaveValue(resetToken);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("[aria-current=page]"),
  ).toHaveText("Reset password");
});
