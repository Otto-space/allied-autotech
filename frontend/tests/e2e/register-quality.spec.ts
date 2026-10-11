import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  registrationFixture,
  fillRegistration,
  registrationData,
} from "../fixtures/registration";
for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536])
  test(`registration fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/register");
    await expect(page).toHaveTitle("Create account · Allied AutoTech");
    await expect(
      page.getByRole("heading", { name: "Better care starts here." }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Need help with your account?" }),
    ).toBeInViewport();
    for (const control of await page
      .locator(".login-content input,.login-content button,.login-content a")
      .all())
      if (await control.isVisible())
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(errors).toEqual([]);
  });
for (const width of [320, 390, 768, 1440])
  test(`registration accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/register");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
test("visible password never submits or persists and is masked on request", async ({
  page,
}) => {
  const state = await registrationFixture(page);
  state.delay = true;
  await page.goto("/register");
  await fillRegistration(page);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  expect(state.writes).toHaveLength(0);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(registrationData.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByRole("button", { name: "Creating account…" })).toBeDisabled();
  state.release?.();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
});
test("accepted request resets all fields and offers an explicit new form", async ({
  page,
}) => {
  const state = await registrationFixture(page);
  await page.goto("/register");
  await fillRegistration(page);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    "Check your email for verification instructions before signing in.",
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Never render arbitrary server response")).toHaveCount(0);
  expect(state.writes).toEqual([registrationData]);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Use another email" }).click();
  await expect(page.getByLabel("First name")).toBeFocused();
  for (const label of [
    "First name",
    "Last name",
    "Phone number",
    "Email address",
    "Password",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  expect(state.writes).toHaveLength(1);
});
test("native required and password length constraints prevent writes", async ({
  page,
}) => {
  const state = await registrationFixture(page);
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("First name")).toBeFocused();
  await fillRegistration(page);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  expect(state.writes).toHaveLength(0);
});
test("name and phone validation associate errors and focus first invalid field", async ({
  page,
}) => {
  const state = await registrationFixture(page);
  await page.goto("/register");
  await fillRegistration(page);
  await page.getByLabel("First name").fill("123");
  await page.getByLabel("Phone number").fill("not-phone");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("First name")).toBeFocused();
  await expect(page.getByLabel("First name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Phone number")).toHaveAttribute(
    "aria-describedby",
    "phone-error",
  );
  await expect(page.locator("#phone-error")).toHaveText("Enter a valid phone number.");
  expect(state.writes).toHaveLength(0);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});
for (const kind of ["field", "rate", "network", "malformed"])
  test(`registration ${kind} failure remains honest`, async ({ page }) => {
    const state = await registrationFixture(page);
    if (kind === "field") {
      state.field = true;
      state.status = 422;
    }
    if (kind === "rate") state.status = 429;
    if (kind === "network") state.offline = true;
    if (kind === "malformed") state.malformed = true;
    await page.goto("/register");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page.getByText(/Prisma|confidential|do not echo/)).toHaveCount(0);
    if (kind === "field")
      await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
  });
test("duplicate submission and late response after session change are discarded", async ({
  page,
}) => {
  const state = await registrationFixture(page);
  state.delay = true;
  await page.goto("/register");
  await fillRegistration(page);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await page
    .locator("form")
    .evaluate((n) =>
      n.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  expect(state.writes).toHaveLength(1);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aat:session-changed")));
  state.release?.();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session changed",
  );
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});
test("cross-tab changes and back-forward restoration clear registration values", async ({
  page,
  context,
}) => {
  await page.goto("/register");
  await fillRegistration(page);
  await page.getByRole("button", { name: "Show password" }).click();
  const other = await context.newPage();
  await other.goto("/login");
  await other.evaluate(() => {
    const c = new BroadcastChannel("aat-session");
    c.postMessage({ type: "changed", source: "registration-other-tab" });
    c.close();
  });
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await fillRegistration(page);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expect(page.getByLabel("First name")).toHaveValue("");
});
test("short viewport supports vertical scrolling without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/register");
  await page
    .locator(".login-content :is(h1,p,label,input,a,button)")
    .evaluateAll((nodes) => {
      for (const node of nodes) {
        const e = node as HTMLElement;
        e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * 1.5}px`;
      }
    });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("without JavaScript registration remains explanatory and cannot leak a query-string password", async ({
  browser,
}) => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  try {
    const p = await c.newPage();
    await p.goto(
      (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000") + "/register",
    );
    await expect(
      p.getByText(
        "Enable JavaScript to create an account. You can still browse our Help Centre.",
      ),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Create account", exact: true }),
    ).toHaveCount(0);
    await expect(p.locator("form")).toHaveAttribute("method", "post");
  } finally {
    await c.close();
  }
});
test("breadcrumb, skip and help links resolve", async ({ page }) => {
  await page.goto("/register");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to create account" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#create-account")).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("[aria-current=page]"),
  ).toHaveText("Create account");
  await page.getByRole("link", { name: "Need help with your account?" }).click();
  await expect(page).toHaveURL(/\/help\/account-security$/);
});
