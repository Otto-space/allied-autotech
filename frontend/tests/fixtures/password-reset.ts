import type { Page } from "@playwright/test";
export const resetToken = "synthetic-reset-token-".repeat(3);
export const resetPassword = "New unique reset passphrase!1";
export async function resetFixture(page: Page) {
  const state = {
    status: 200,
    code: "TOKEN_INVALID",
    field: false,
    delay: false,
    offline: false,
    malformed: false,
    retryAfter: undefined as string | undefined,
    release: undefined as (() => void) | undefined,
    writes: [] as unknown[],
  };
  await page.route("**/api/v1/auth/password/reset", async (r) => {
    state.writes.push(r.request().postDataJSON());
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.offline) return r.abort();
    await r.fulfill({
      status: state.status,
      headers: state.retryAfter ? { "Retry-After": state.retryAfter } : {},
      json: state.malformed
        ? { success: true }
        : state.status === 200
          ? {
              success: true,
              message: "Server copy must not be rendered",
              meta: { requestId: "reset-qa" },
            }
          : {
              success: false,
              error: {
                code: state.code,
                message: "Prisma private raw token",
                ...(state.field
                  ? { fields: { "body.password": ["Do not echo secret"] } }
                  : {}),
              },
            },
    });
  });
  return state;
}
