import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { verificationFixture, verifyToken } from "../fixtures/email-verification";
const linked = `/verify-email#token=${encodeURIComponent(verifyToken)}`;
const submit = (page: Page) =>
  page.getByRole("button", { name: "Verify email", exact: true }).click();
async function resend(page: Page) {
  await page.getByRole("button", { name: "Need a new verification email?" }).click();
  await page.getByLabel("Registration email").fill("verification@example.test");
}
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`verification and resend fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(linked);
    await expect(page).toHaveTitle("Verify email · Allied AutoTech");
    for (const mode of ["verify", "resend"]) {
      if (mode === "resend") await resend(page);
      await expect(page.locator("form:visible")).toHaveCount(1);
      for (const control of await page
        .locator(".login-content input,.login-content button,.login-content a")
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
  test(`verification accessible ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(linked);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width === 390) {
      await resend(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
test("fragment is private, masked and never automatically submitted", async ({
  page,
}) => {
  const state = await verificationFixture(page),
    urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(linked);
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.locator("#verify-token")).toHaveValue(verifyToken);
  await expect(page.locator("#verify-token")).toHaveAttribute("type", "password");
  expect(state.writes).toEqual([]);
  expect(urls.some((u) => u.includes(verifyToken))).toBe(false);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(verifyToken);
  await page.getByRole("button", { name: "Show verification token" }).click();
  await expect(page.locator("#verify-token")).toHaveAttribute("type", "text");
  await expect(
    page.getByRole("button", { name: "Hide verification token" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(state.writes).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#verify-token")).toHaveAttribute("type", "password");
});
test("query and duplicate fragment tokens are discarded", async ({ page }) => {
  const state = await verificationFixture(page);
  for (const route of [
    `/verify-email?token=${verifyToken}`,
    `/verify-email#token=${verifyToken}&token=${verifyToken}`,
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.locator("#verify-token")).toHaveValue("");
  }
  expect(state.writes).toEqual([]);
});
test("successful verification clears the token without logging in or changing sessions", async ({
  page,
}) => {
  const state = await verificationFixture(page);
  state.delay = true;
  await page.goto(linked);
  await page.evaluate(() => {
    window.addEventListener("aat:session-changed", () => {
      document.body.dataset.sessionChanged = "yes";
    });
  });
  await submit(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(page.getByRole("button", { name: "Verifying email…" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Need a new verification email?" }),
  ).toBeDisabled();
  state.release?.();
  await expect(
    page.getByRole("heading", { name: "Email verified", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#verify-token")).toHaveValue("");
  expect(state.writes).toEqual([{ action: "verify", body: { token: verifyToken } }]);
  expect(await page.locator("body").getAttribute("data-session-changed")).toBeNull();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Return to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("resend acceptance is generic and clears the address", async ({ page }) => {
  const state = await verificationFixture(page);
  await page.goto(linked);
  await resend(page);
  await expect(page.locator("#verify-token")).toHaveValue("");
  await page
    .getByRole("button", { name: "Request verification email", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.locator("#verify-email-input")).toHaveValue("");
  await expect(page.getByRole("status")).toContainText("If the account is eligible");
  expect(state.writes).toEqual([
    { action: "resend", body: { email: "verification@example.test" } },
  ]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(page.getByLabel("Registration email")).toBeFocused();
  await page.getByRole("button", { name: "Use a verification token" }).click();
  await expect(page.getByLabel("Verification token", { exact: true })).toBeFocused();
});
for (const status of [400, 422])
  test(`invalid token ${status} offers working recovery actions`, async ({ page }) => {
    const state = await verificationFixture(page);
    state.status = status;
    state.field = status === 422;
    await page.goto(linked);
    await submit(page);
    await expect(
      page.getByRole("heading", { name: "Request a new email", exact: true }),
    ).toBeFocused();
    await expect(page.locator("#verify-token")).toHaveValue("");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Use another token" }).click();
    await expect(page.getByLabel("Verification token", { exact: true })).toBeFocused();
    await page.getByLabel("Verification token", { exact: true }).fill(verifyToken);
    await submit(page);
    await page.getByRole("button", { name: "Request a new email", exact: true }).click();
    await expect(page.getByLabel("Registration email")).toBeFocused();
  });
for (const kind of ["network", "malformed", "unavailable"])
  test(`uncertain ${kind} verification does not claim success or expired token`, async ({
    page,
  }) => {
    const state = await verificationFixture(page);
    state.offline = kind === "network";
    state.malformed = kind === "malformed";
    if (kind === "unavailable") state.status = 503;
    await page.goto(linked);
    await submit(page);
    await expect(
      page.getByRole("heading", { name: "Check your verification" }),
    ).toBeFocused();
    await expect(page.locator("#verify-token")).toHaveValue("");
    expect(state.writes).toHaveLength(1);
    await expect(page.getByText(/Prisma|Private server|Do not echo/)).toHaveCount(0);
    if (kind === "network")
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
for (const status of [422, 403, 503])
  test(`resend ${status} feedback stays safe and preserves editable email`, async ({
    page,
  }) => {
    const state = await verificationFixture(page);
    state.status = status;
    state.field = true;
    await page.goto(linked);
    await resend(page);
    await page
      .getByRole("button", { name: "Request verification email", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Registration email")).toHaveValue(
      "verification@example.test",
    );
    await expect(page.getByText(/Prisma|Private server|Do not echo/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
    if (status === 422) {
      await expect(page.getByLabel("Registration email")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    if (status === 503)
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "Check your email before trying again",
      );
  });
test("verification 403 provides safe retry guidance", async ({ page }) => {
  const state = await verificationFixture(page);
  state.status = 403;
  await page.goto(linked);
  await submit(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be verified",
  );
  await expect(page.locator("#verify-token")).toHaveValue(verifyToken);
});
test("native validation prevents empty forms from submitting", async ({ page }) => {
  const state = await verificationFixture(page);
  await page.goto("/verify-email");
  await submit(page);
  await expect(page.getByLabel("Verification token", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Need a new verification email?" }).click();
  await page
    .getByRole("button", { name: "Request verification email", exact: true })
    .click();
  await expect(page.getByLabel("Registration email")).toBeFocused();
  expect(state.writes).toEqual([]);
});
test("each rate limit survives switching without blocking the other action", async ({
  page,
}) => {
  const state = await verificationFixture(page);
  state.status = 429;
  state.retryAfter = "3";
  await page.clock.install();
  await page.goto(linked);
  await submit(page);
  await expect(
    page.getByRole("button", { name: "Verify email", exact: true }),
  ).toBeDisabled();
  await resend(page);
  await expect(
    page.getByRole("button", { name: "Request verification email", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Request verification email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Request verification email", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Use a verification token" }).click();
  await expect(
    page.getByRole("button", { name: "Verify email", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(4000);
  await expect(
    page.getByRole("button", { name: "Verify email", exact: true }),
  ).toBeEnabled();
  await resend(page);
  await expect(
    page.getByRole("button", { name: "Request verification email", exact: true }),
  ).toBeEnabled();
});
test("duplicate submits and session change cannot show a late success", async ({
  page,
}) => {
  const state = await verificationFixture(page);
  state.delay = true;
  await page.goto(linked);
  await submit(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await page
    .locator("form:visible")
    .evaluate((e) =>
      e.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  expect(state.writes).toHaveLength(1);
  await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
  state.release?.();
  await expect(page.locator("#verify-token")).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session changed",
  );
  await expect(
    page.getByRole("heading", { name: "Email verified", exact: true }),
  ).toHaveCount(0);
});
test("cross-tab and restored-page changes clear token and email", async ({
  page,
  context,
}) => {
  await page.goto(linked);
  const other = await context.newPage();
  await other.goto("/login");
  await other.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage({ type: "changed", source: "verify-qa" });
    c.close();
  });
  await expect(page.locator("#verify-token")).toHaveValue("");
  await resend(page);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.locator("#verify-email-input")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Verify your email." })).toBeVisible();
});
test("new email fragment returns to verification and clears the resend address", async ({
  page,
}) => {
  const state = await verificationFixture(page);
  await page.goto(linked);
  await resend(page);
  await page.evaluate((t) => {
    location.hash = "token=" + t;
  }, verifyToken + "new");
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.locator("#verify-token")).toHaveValue(verifyToken + "new");
  await expect(page.locator("#verify-email-input")).toHaveValue("");
  expect(state.writes).toEqual([]);
});
test("leaving pending verification does not publish a late result", async ({ page }) => {
  const state = await verificationFixture(page);
  state.delay = true;
  await page.goto(linked);
  await submit(page);
  await expect.poll(() => state.writes.length).toBe(1);
  await page.getByRole("link", { name: "Return to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  state.release?.();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});
test("short screen and enlarged text preserve both forms", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto(linked);
  await page
    .locator(".login-content :is(h1,p,label,input,a,button)")
    .evaluateAll((nodes) => {
      for (const n of nodes)
        (n as HTMLElement).style.fontSize =
          `${parseFloat(getComputedStyle(n).fontSize) * 1.5}px`;
    });
  await resend(page);
  await page
    .getByRole("button", { name: "Request verification email", exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("no JavaScript keeps sensitive forms hidden and sign-in available", async ({
  browser,
}) => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  try {
    const p = await c.newPage();
    await p.goto((process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + linked);
    // Text selectors intentionally skip noscript; inspect the native fallback itself.
    await expect(p.locator("noscript p")).toBeVisible();
    await expect(p.locator("noscript p")).toContainText(
      "Enable JavaScript to verify your email",
    );
    await expect(p.locator("form:visible")).toHaveCount(0);
    for (const form of await p.locator("form").all())
      await expect(form).toHaveAttribute("method", "post");
    await expect(
      p.getByRole("link", { name: "Return to sign in", exact: true }),
    ).toBeVisible();
  } finally {
    await c.close();
  }
});
test("skip navigation preserves the token and breadcrumb identifies verification", async ({
  page,
}) => {
  await page.goto(linked);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to email verification" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#verify-email")).toBeFocused();
  await expect(page.locator("#verify-token")).toHaveValue(verifyToken);
  await expect(page.locator(".login-breadcrumb [aria-current]")).toHaveText(
    "Verify email",
  );
});

test("slow JavaScript loading does not claim JavaScript is disabled", async ({
  page,
}) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**", async (route) => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto(linked, { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Verify your email." })).toBeVisible();
    await expect(
      page.getByText("Enable JavaScript to verify your email", { exact: false }),
    ).not.toBeVisible();
    await expect(page.locator("form:visible")).toHaveCount(0);
    releaseScripts();
    await expect(page.getByLabel("Verification token", { exact: true })).toBeVisible();
    await expect(page.locator("#verify-token")).toHaveValue(verifyToken);
    await expect(page).toHaveURL(/\/verify-email$/);
  } finally {
    releaseScripts();
  }
});
