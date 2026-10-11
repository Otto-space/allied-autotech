import type { Page } from "@playwright/test";
export const verifyToken = "synthetic-verification-token-".repeat(3);
export async function verificationFixture(page: Page) {
  const state = {
    status: 200,
    code: "TOKEN_INVALID",
    field: false,
    delay: false,
    offline: false,
    malformed: false,
    retryAfter: undefined as string | undefined,
    release: undefined as (() => void) | undefined,
    writes: [] as { action: string; body: unknown }[],
  };
  await page.route("**/api/v1/auth/email/*", async (r) => {
    const action = new URL(r.request().url()).pathname.split("/").pop()!;
    state.writes.push({ action, body: r.request().postDataJSON() });
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.offline) return r.abort();
    await r.fulfill({
      status: state.status === 200 && action === "resend" ? 202 : state.status,
      headers: state.retryAfter ? { "Retry-After": state.retryAfter } : {},
      json: state.malformed
        ? { success: true }
        : state.status === 200
          ? {
              success: true,
              message: "Private server copy",
              meta: { requestId: "verify-qa" },
            }
          : {
              success: false,
              error: {
                code: state.code,
                message: "Prisma private token",
                ...(state.field
                  ? {
                      fields: {
                        [action === "verify" ? "body.token" : "body.email"]: [
                          "Do not echo",
                        ],
                      },
                    }
                  : {}),
              },
            },
    });
  });
  return state;
}
