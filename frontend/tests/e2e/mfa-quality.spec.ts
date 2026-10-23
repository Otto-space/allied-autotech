import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, codes } from "../fixtures/mfa";
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`MFA methods and enrollment fit ${width}px`, async ({ page }) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/mfa");
    await expect(
      page.getByRole("button", { name: "Authenticator", exact: true }),
    ).toBeVisible();
    for (const method of [
      null,
      "Authenticator",
      "Recovery code",
      "Prepare security key",
    ]) {
      if (method) await page.getByRole("button", { name: method, exact: true }).click();
      for (const control of await page
        .locator(
          ".login-content button,.login-content a,.login-content input,.login-content select",
        )
        .all())
        if (await control.isVisible()) {
          await expect(control).toBeInViewport();
          expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (method)
        await page.getByRole("button", { name: "Choose another method" }).click();
    }
    state.verified = true;
    await page.goto("/mfa?setup=1");
    await page.getByRole("checkbox").check();
    await expect(
      page.getByRole("button", { name: "Prepare new security key" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Set up authenticator app" }).click();
    await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByLabel("New recovery codes")).toHaveValue(codes.join("\n"));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`MFA challenge accessibility at ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/mfa");
    await expect(
      page.getByRole("button", { name: "Authenticator", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Authenticator", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
test("MFA code reveal is reversible, private and cleared at submission", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delay = true;
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Recovery code", exact: true }).click();
  const field = page.getByLabel("Recovery code", { exact: true });
  await field.fill("private-recovery-code");
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(field).toHaveAttribute("type", "text");
  expect(state.writes.filter((w) => w.endpoint.endsWith("/verify"))).toHaveLength(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(field).toHaveValue("");
  await expect.poll(() => !!state.release).toBe(true);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain("private-recovery-code");
  state.release?.();
  await expect(
    page.getByRole("heading", { name: "Verification complete." }),
  ).toBeFocused();
});
test("MFA retry countdown blocks code and method resubmission", async ({ page }) => {
  const state = await fixture(page);
  state.rateLimit = true;
  await page.clock.install();
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Authenticator", exact: true }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByRole("button", { name: "Verify code" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Choose another method" }),
  ).toBeDisabled();
  await expect(page.getByText("Try again in about 1 minute.")).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(page.getByRole("button", { name: "Verify code" })).toBeEnabled();
});
test("restored pages discard authenticator secrets and recovery codes", async ({
  page,
}) => {
  const state = await fixture(page);
  state.verified = true;
  await page.goto("/mfa?setup=1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  await page.getByRole("button", { name: "Check session again" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByLabel("New recovery codes")).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
});
test("method switch clears the previous code and restores keyboard focus", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill("private-switch-code");
  await page.getByRole("button", { name: "Choose another method" }).click();
  await expect(
    page.getByRole("button", { name: "Authenticator", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Recovery code", exact: true }).click();
  await expect(page.getByLabel("Recovery code", { exact: true })).toHaveValue("");
  expect(state.writes.every((w) => w.endpoint.endsWith("/options"))).toBe(true);
});
test("recovery-code download is local and contains only the returned codes", async ({
  page,
}) => {
  const state = await fixture(page);
  state.verified = true;
  await page.goto("/mfa?setup=1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recovery codes" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("allied-autotech-recovery-codes.txt");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const contents = Buffer.concat(chunks).toString();
  expect(contents).toContain(codes.join("\n"));
  expect(contents).not.toContain("mfa@example.test");
});
test("short screen with enlarged text retains reachable MFA controls", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Authenticator", exact: true }).click();
  await page
    .locator(".login-content :is(h1,p,label,input,select,a,button)")
    .evaluateAll((nodes) => {
      for (const n of nodes)
        (n as HTMLElement).style.fontSize =
          `${parseFloat(getComputedStyle(n).fontSize) * 1.5}px`;
    });
  await page.getByRole("button", { name: "Verify code" }).scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("MFA no-JavaScript explanation keeps sign-in and Help usable", async ({
  browser,
}) => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  try {
    const p = await c.newPage();
    await p.goto((process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + "/mfa");
    await expect(
      p
        .locator("noscript p")
        .filter({ hasText: "Enable JavaScript to verify your sign-in." }),
    ).toBeVisible();
    await expect(
      p.getByRole("link", { name: "Need help with your account?" }),
    ).toBeVisible();
    await expect(p.locator("form")).toHaveCount(0);
  } finally {
    await c.close();
  }
});
test("MFA breadcrumb and skip link identify the route", async ({ page }) => {
  await fixture(page);
  await page.goto("/mfa");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to sign-in verification" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#verify-sign-in")).toBeFocused();
  await expect(page.locator(".login-breadcrumb [aria-current]")).toHaveText(
    "Verify sign in",
  );
});
