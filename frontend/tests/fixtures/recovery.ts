import type { Page } from "@playwright/test";
export async function recoveryFixture(page: Page) {
  const state = {
    status: 202,
    delay: false,
    offline: false,
    malformed: false,
    retryAfter: undefined as string | undefined,
    release: undefined as (() => void) | undefined,
    writes: [] as unknown[],
  };
  await page.route("**/api/v1/auth/password/forgot", async (route) => {
    state.writes.push(route.request().postDataJSON());
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.offline) return route.abort();
    await route.fulfill({
      status: state.status,
      headers: state.retryAfter ? { "Retry-After": state.retryAfter } : {},
      json: state.malformed
        ? { success: true }
        : state.status === 202
          ? {
              success: true,
              message: "Server copy must not reveal account eligibility",
              meta: { requestId: "recovery-qa" },
            }
          : {
              success: false,
              error: {
                code:
                  state.status === 429
                    ? "RATE_LIMITED"
                    : state.status === 422
                      ? "VALIDATION_FAILED"
                      : "FORBIDDEN",
                message: "Prisma confidential raw address",
                ...(state.status === 422
                  ? { fields: { "body.email": ["secret@example.test"] } }
                  : {}),
              },
            },
    });
  });
  return state;
}
