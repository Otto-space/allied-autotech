import { type Page, expect } from "@playwright/test";
export const loginUser = {
  id: "a9000000-0000-4000-8000-000000000001",
  email: "login@example.test",
  role: "CUSTOMER",
};
export const envelope = (data: unknown) => ({
  success: true,
  message: "Isolated login response",
  data,
  meta: { requestId: "login-qa" },
});
export async function loginFixture(page: Page) {
  const state = {
    response: { user: { ...loginUser }, mfaRequired: false } as unknown,
    status: 200,
    code: "AUTHENTICATION_FAILED",
    offline: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    csrfFail: false,
    writes: [] as unknown[],
  };
  await page.route("**/api/v1/auth/login", async (route) => {
    state.writes.push(route.request().postDataJSON());
    if (state.delay)
      await new Promise<void>((r) => {
        state.release = r;
      });
    if (state.offline) return route.abort();
    return route.fulfill({
      status: state.status,
      json:
        state.status === 200
          ? envelope(state.response)
          : {
              success: false,
              error: { code: state.code, message: "Prisma confidential details" },
            },
    });
  });
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({
      status: state.csrfFail ? 503 : 200,
      json: state.csrfFail
        ? { success: false, error: { code: "DATABASE_UNAVAILABLE" } }
        : envelope({ csrfToken: "t".repeat(64) }),
    }),
  );
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill({
      json: envelope({
        id: "a9000000-0000-4000-8000-000000000002",
        user: loginUser,
        mfaRequired: false,
        mfaVerifiedAt: null,
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    }),
  );
  return state;
}
export async function credentials(page: Page) {
  await page.getByLabel("Email address").fill("login@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Synthetic login password!1");
}
export async function submitLogin(page: Page) {
  await credentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
export async function expectNoSuccess(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator(".toast--success")).toHaveCount(0);
}
