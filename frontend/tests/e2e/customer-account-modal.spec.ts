import { test, expect, type Page } from "@playwright/test";
import { workCustomersFixture } from "../fixtures/work-customers";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";

async function setup(page: Page, role = "ADMIN", directory = false) {
  const fixture = await workCustomersFixture(page, role);
  const customer = fixture.customers.records[0];
  const state = {
    writes: 0,
    holdRead: false,
    failRead: false,
    rejectWrite: false,
    unknownWrite: false,
    release: undefined as (() => void) | undefined,
  };
  const response = (data: unknown) => ({
    success: true,
    message: "Isolated account review response",
    data,
    meta: { requestId: "account-review-fixture" },
  });
  await page.route("**/api/v1/public/capabilities", (route) =>
    route.fulfill({ json: response(publicCapabilitiesFixture("browse_enquiries")) }),
  );
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: response({ csrfToken: "isolated-account-token-".repeat(4) }) }),
  );
  await page.route(`**/api/v1/admin/customers/${customer.id}`, async (route) => {
    if (state.holdRead)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.failRead)
      return route.fulfill({
        status: 503,
        json: { success: false, message: "Customer read unavailable" },
      });
    return route.fulfill({
      json: response({
        ...customer,
        address: null,
        city: null,
        state: null,
        country: "NG",
      }),
    });
  });
  await page.route("**/api/v1/admin/customers/*/account-status", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["x-csrf-token"]).toBeTruthy();
    const body = request.postDataJSON();
    expect(body).toEqual({
      expectedStatus: "ACTIVE",
      status: "SUSPENDED",
      reason: "Reviewed synthetic account reason",
    });
    state.writes++;
    if (!state.rejectWrite) customer.status = "SUSPENDED";
    if (state.rejectWrite || state.unknownWrite)
      return route.fulfill({
        status: state.rejectWrite ? 409 : 503,
        json: { success: false, message: "Review the current account" },
      });
    return route.fulfill({
      json: response({ customerId: customer.id, status: customer.status }),
    });
  });
  await page.goto(
    directory ? "/admin/customers?status=ACTIVE" : `/admin/customers/${customer.id}`,
  );
  const heading = page.getByRole("heading", {
    name: directory ? "Customers" : "Amina Okafor",
    exact: true,
  });
  await expect(heading).toBeVisible();
  if (directory)
    await page.locator("tbody tr").first().getByText("Account", { exact: true }).click();
  const opener = page.getByRole("button", {
    name: "Suspend account for Amina Okafor",
    exact: true,
  });
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Suspend account", exact: true });
  await expect(dialog).toBeVisible();
  const submit = async () => {
    await dialog
      .getByLabel("Reason (required)")
      .fill("Reviewed synthetic account reason");
    await dialog.getByRole("button", { name: "Suspend account", exact: true }).click();
  };
  return { state, fixture, heading, opener, dialog, submit };
}

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 720],
]) {
  test.describe(`account review ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      hasTouch: width <= 430,
      isMobile: async ({ browserName }, provide) => {
        await provide(browserName !== "firefox" && width <= 430);
      },
      reducedMotion: "reduce",
    });
    test("centers, retains keyboard focus and returns after an authoritative change", async ({
      page,
    }) => {
      const { state, opener, dialog, submit } = await setup(page);
      expect(await page.evaluate(() => [innerWidth, innerHeight])).toEqual([
        width,
        height,
      ]);
      const box = (await dialog.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(2);
      if (width <= 430) expect(box.width).toBe(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      const confirm = dialog.getByRole("button", {
        name: "Suspend account",
        exact: true,
      });
      await confirm.focus();
      await confirm.press("Tab");
      await expect(dialog.getByLabel("Reason (required)")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(state.writes).toBe(0);
      await opener.press("Enter");
      await submit();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: "Reactivate account for Amina Okafor",
          exact: true,
        }),
      ).toBeFocused();
      expect(state.writes).toBe(1);
    });
  });
}

test("Super Admin receives the same authoritative focus return", async ({ page }) => {
  const { submit, state } = await setup(page, "SUPER_ADMIN");
  await submit();
  await expect(
    page.getByRole("button", {
      name: "Reactivate account for Amina Okafor",
      exact: true,
    }),
  ).toBeFocused();
  expect(state.writes).toBe(1);
});

for (const mode of ["delayed", "moved", "failed read"] as const) {
  test(`account review waits for ${mode} refresh`, async ({ page }) => {
    const { state, heading, dialog, submit } = await setup(page);
    state.holdRead = true;
    await submit();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => !!state.release).toBe(true);
    const next = page.getByRole("button", {
      name: /account for Amina Okafor/,
      exact: false,
    });
    await expect(next).toBeDisabled();
    const link = page.getByRole("link", { name: "Back to customers", exact: true });
    if (mode === "moved") await link.focus();
    state.failRead = mode === "failed read";
    state.holdRead = false;
    state.release!();
    if (mode === "failed read") {
      await expect(heading).toBeFocused();
      await expect(next).toBeDisabled();
    } else {
      await expect(next).toBeEnabled();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(mode === "moved" ? link : next).toBeFocused();
    }
    expect(state.writes).toBe(1);
  });
}

test("rejected account change cannot be resent and returns focus after close", async ({
  page,
}) => {
  const { state, opener, dialog, submit } = await setup(page);
  state.rejectWrite = true;
  await submit();
  await expect(
    dialog.getByRole("button", { name: "Suspend account", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(opener).toBeFocused();
  expect(state.writes).toBe(1);
});

for (const uncertain of [false, true]) {
  test(`filtered directory preserves focus when the changed row leaves, uncertain=${uncertain}`, async ({
    page,
  }) => {
    const { state, heading, dialog, submit } = await setup(page, "ADMIN", true);
    state.unknownWrite = uncertain;
    await submit();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Amina Okafor", exact: true }),
    ).toHaveCount(0);
    await expect(heading).toBeFocused();
    expect(state.writes).toBe(1);
  });
}
