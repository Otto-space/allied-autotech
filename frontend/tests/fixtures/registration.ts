import { type Page } from "@playwright/test";
export const registrationData = {
  firstName: "Ada",
  lastName: "Okafor",
  phone: "+2348000000000",
  email: "register@example.test",
  password: "Unique registration phrase!1",
};
export async function registrationFixture(page: Page) {
  const state = {
    status: 202,
    delay: false,
    release: undefined as (() => void) | undefined,
    offline: false,
    malformed: false,
    field: false,
    writes: [] as unknown[],
  };
  await page.route("**/api/v1/auth/register", async (r) => {
    state.writes.push(r.request().postDataJSON());
    if (state.delay) await new Promise<void>((resolve) => (state.release = resolve));
    if (state.offline) return r.abort();
    return r.fulfill({
      status: state.status,
      json: state.malformed
        ? { success: true }
        : state.status === 202
          ? {
              success: true,
              message: "Never render arbitrary server response",
              meta: { requestId: "register-qa" },
            }
          : {
              success: false,
              error: {
                code: state.field
                  ? "VALIDATION_FAILED"
                  : state.status === 429
                    ? "RATE_LIMITED"
                    : "DATABASE_UNAVAILABLE",
                message: "Prisma confidential input",
                ...(state.field
                  ? { fields: { "body.password": ["do not echo a secret"] } }
                  : {}),
              },
            },
    });
  });
  return state;
}
export async function fillRegistration(page: Page) {
  for (const [label, name] of [
    ["First name", "firstName"],
    ["Last name", "lastName"],
    ["Phone number", "phone"],
    ["Email address", "email"],
    ["Password", "password"],
  ] as const)
    await page.getByLabel(label, { exact: true }).fill(registrationData[name]);
}
