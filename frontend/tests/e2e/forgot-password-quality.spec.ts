import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { recoveryFixture } from "../fixtures/recovery";

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`recovery fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/forgot-password");
    await expect(page).toHaveTitle("Forgot password · Allied AutoTech");
    await expect(
      page.getByRole("heading", { name: "Forgot your password." }),
    ).toBeVisible();
    for (const control of await page
      .locator(".login-content input,.login-content button,.login-content a")
      .all()) {
      if (!(await control.isVisible())) continue;
      await expect(control).toBeInViewport();
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const border = await page
      .getByLabel("Email address")
      .evaluate((e) => getComputedStyle(e).borderTopWidth);
    expect(border).toBe("1px");
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`recovery accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/forgot-password");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test("accepted request is generic, clears email and supports explicit restart", async ({
  page,
}) => {
  const state = await recoveryFixture(page);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("private@example.test");
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("private@example.test");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "If your account is eligible, a recovery link will be sent. Check your email for the next step.",
  );
  await expect(page.locator("#recovery-email")).toHaveValue("");
  await expect(page.getByText("Server copy", { exact: false })).toHaveCount(0);
  expect(state.writes).toEqual([{ email: "private@example.test" }]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole("link", { name: "Return to sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveValue("");
});
test("invalid email is blocked before network", async ({ page }) => {
  const state = await recoveryFixture(page);
  await page.goto("/forgot-password");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  expect(state.writes).toHaveLength(0);
});
for (const kind of ["field", "forbidden", "rate", "unavailable", "network", "malformed"])
  test(`recovery ${kind} failure stays actionable`, async ({ page }) => {
    const state = await recoveryFixture(page);
    state.status =
      kind === "field"
        ? 422
        : kind === "forbidden"
          ? 403
          : kind === "rate"
            ? 429
            : kind === "unavailable"
              ? 503
              : 202;
    state.offline = kind === "network";
    state.malformed = kind === "malformed";
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("private@example.test");
    await page.getByRole("button", { name: "Send recovery link" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
    await expect(page.getByText(/Prisma|confidential|secret@example/)).toHaveCount(0);
    if (kind === "field") {
      await expect(page.getByLabel("Email address")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await expect(page.getByRole("link", { name: "Return to sign in" })).toBeVisible();
  });
test("Retry-After blocks early retries and releases the action", async ({ page }) => {
  const state = await recoveryFixture(page);
  state.status = 429;
  state.retryAfter = "3";
  await page.clock.install();
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("private@example.test");
  const button = page.getByRole("button", { name: "Send recovery link" });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByText("Try again in about 1 minute.")).toBeVisible();
  await page
    .locator("form")
    .evaluate((e) =>
      e.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  expect(state.writes).toHaveLength(1);
  await page.clock.fastForward(4000);
  await expect(button).toBeEnabled();
  state.status = 202;
  await button.click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});
test("duplicate submission locks and session change discards late results", async ({
  page,
}) => {
  const state = await recoveryFixture(page);
  state.delay = true;
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("private@example.test");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("button", { name: "Requesting link…" })).toBeDisabled();
  await expect(page.getByLabel("Email address")).toBeDisabled();
  await page
    .locator("form")
    .evaluate((e) =>
      e.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  await expect.poll(() => state.writes.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.release?.();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session changed",
  );
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});
test("cross-tab and restored-page events clear private values", async ({
  page,
  context,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("private@example.test");
  const other = await context.newPage();
  await other.goto("/login");
  await other.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage({ type: "changed", source: "recovery-qa" });
    c.close();
  });
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await page.getByLabel("Email address").fill("private@example.test");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
});
test("short screen and enlarged text retain all actions without horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/forgot-password");
  await page
    .locator(".login-content :is(h1,p,label,input,a,button)")
    .evaluateAll((nodes) => {
      for (const node of nodes) {
        const el = node as HTMLElement;
        el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 1.5}px`;
      }
    });
  await page.getByRole("button", { name: "Send recovery link" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Send recovery link" })).toBeInViewport();
  await page
    .getByRole("link", { name: "Need help with your account?" })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("no JavaScript fallback never submits an email in the URL", async ({ browser }) => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await c.newPage();
    await page.goto(
      (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + "/forgot-password",
    );
    await expect(
      page.getByText(
        "Enable JavaScript to request a recovery link. You can still browse our Help Centre.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Send recovery link" })).toHaveCount(0);
    await expect(page.locator("form")).toHaveAttribute("method", "post");
  } finally {
    await c.close();
  }
});
test("skip link and breadcrumb reach the right recovery context", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to password recovery" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#recover-account")).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("[aria-current=page]"),
  ).toHaveText("Forgot password");
  await page.getByRole("link", { name: "Need help with your account?" }).click();
  await expect(page).toHaveURL(/\/help\/account-security$/);
});
