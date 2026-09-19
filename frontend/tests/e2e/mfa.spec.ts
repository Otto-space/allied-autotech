import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
const id = (n: number) => `a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const secret = "ABCDEFGHIJKLMNOP";
const codes = ["first-isolated-code", "second-isolated-code"];
const challenge = Buffer.from("isolated-browser-challenge-123456").toString("base64url");
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "mfa-fixture" },
    },
  });
const fail = (route: Route, code = "TOKEN_INVALID", status = 400) =>
  route.fulfill({
    status,
    json: { success: false, error: { code }, message: "Never echo raw server exception" },
  });
async function fixture(page: Page) {
  const state = {
    role: "STAFF",
    verified: false,
    mfaRequired: true,
    requirePriorMfa: false,
    noMethods: false,
    malformedOptions: false,
    optionsFailure: false,
    rejectCode: false,
    unknown: false,
    malformedResult: false,
    malformedSession: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    credentialId: "aXNvbGF0ZWQtY3JlZGVudGlhbA",
    writes: [] as {
      endpoint: string;
      body: Record<string, unknown>;
      csrf: string | undefined;
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(
        route,
        state.malformedSession
          ? {}
          : {
              id: id(state.verified ? 2 : 1),
              user: { id: id(9), email: "mfa@example.test", role: state.role },
              mfaRequired: state.mfaRequired,
              mfaVerifiedAt: state.verified ? "2026-09-17T12:00:00Z" : null,
              expiresAt: "2027-01-01T00:00:00Z",
              idleExpiresAt: "2027-01-01T00:00:00Z",
            },
      );
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-mfa-csrf-".repeat(3) });
    if (endpoint === "/auth/sessions") return reply(route, { sessions: [] });
    if (endpoint === "/auth/mfa/factors") return reply(route, { factors: [] });
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({ endpoint, body, csrf: request.headers()["x-csrf-token"] });
    if (endpoint === "/auth/mfa/challenge/options") {
      if (state.noMethods) return fail(route);
      if (state.optionsFailure) return fail(route, "DATABASE_UNAVAILABLE", 503);
      if (state.malformedOptions)
        return reply(route, { method: body.method, available: true, factors: [] });
      if (body.method === "totp")
        return reply(route, {
          method: "totp",
          available: true,
          factors: [
            { id: id(11), name: "Primary app" },
            { id: id(12), name: "Backup app" },
          ],
        });
      if (body.method === "recovery-code")
        return reply(route, { method: "recovery-code", available: true });
      return reply(route, {
        challenge,
        rpId: "localhost",
        timeout: 60000,
        userVerification: "required",
        allowCredentials: [{ id: state.credentialId, type: "public-key" }],
      });
    }
    if (
      state.requirePriorMfa &&
      [
        "/auth/mfa/totp/setup",
        "/auth/mfa/webauthn/options",
        "/auth/mfa/totp/verify",
        "/auth/mfa/webauthn/verify",
      ].includes(endpoint)
    )
      return fail(route, "MFA_REQUIRED", 403);
    if (endpoint === "/auth/mfa/totp/setup")
      return reply(route, {
        factorId: id(20),
        secret,
        uri: `otpauth://totp/Allied?secret=${secret}`,
      });
    if (endpoint === "/auth/mfa/webauthn/options")
      return reply(route, {
        challenge,
        rp: { id: "localhost", name: "Allied AutoTech" },
        user: {
          id: Buffer.from(id(9)).toString("base64url"),
          name: "mfa@example.test",
          displayName: "MFA fixture",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
        excludeCredentials: [],
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
        attestation: "none",
        extensions: { credProps: true },
      });
    if (endpoint.endsWith("/verify")) {
      if (state.delay)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.unknown) return route.abort("connectionreset");
      if (state.rejectCode) return fail(route);
      state.verified = true;
      if (endpoint.includes("webauthn"))
        state.credentialId = (body.response as { id: string }).id;
      return reply(
        route,
        state.malformedResult
          ? { recoveryCodes: [] }
          : {
              csrfToken: "rotated-mfa-csrf-".repeat(3),
              ...(endpoint.includes("challenge") ? {} : { recoveryCodes: codes }),
            },
      );
    }
    return fail(route, "NOT_FOUND", 404);
  });
  return state;
}
async function setup(page: Page) {
  const state = await fixture(page);
  state.verified = true;
  await page.goto("/mfa?setup=1");
  await page.getByRole("checkbox").check();
  return state;
}
async function authenticator(page: Page) {
  await page.getByRole("button", { name: "Authenticator", exact: true }).click();
  await expect(page.getByLabel("Authenticator", { exact: true })).toBeVisible();
}
async function changed(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel("aat-session");
    channel.postMessage("changed");
    channel.close();
  });
}
test("pending session selects its actual factor and routes staff only after confirmed verification and session reread", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/mfa");
  await authenticator(page);
  await page.getByLabel("Authenticator", { exact: true }).selectOption(id(12));
  await page.getByLabel("6-digit code").fill("123");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeFocused();
  expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
    0,
  );
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("MFA verification confirmed.")).toBeVisible();
  expect(state.writes.at(-1)?.body).toEqual({
    method: "totp",
    factorId: id(12),
    code: "123456",
  });
  await page.getByRole("button", { name: "Continue to account security" }).click();
  await expect(page).toHaveURL(/\/admin\/security$/);
});
test("invalid codes clear sensitive input and allow a fresh explicit attempt", async ({
  page,
}) => {
  const state = await fixture(page);
  state.rejectCode = true;
  await page.goto("/mfa");
  await authenticator(page);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText(/This code or challenge is invalid/)).toBeVisible();
  await expect(page.getByLabel("6-digit code")).toBeEmpty();
  await expect(page.getByLabel("6-digit code")).toBeFocused();
  await expect(page.getByText(/Request a new link/)).toHaveCount(0);
  state.rejectCode = false;
  await page.getByLabel("6-digit code").fill("654321");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("MFA verification confirmed.")).toBeVisible();
});
test("recovery code uses its discriminated contract and customer destination", async ({
  page,
}) => {
  const state = await fixture(page);
  state.role = "CUSTOMER";
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill("isolated-recovery-code");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("MFA verification confirmed.")).toBeVisible();
  expect(state.writes.at(-1)?.body).toEqual({
    method: "recovery-code",
    code: "isolated-recovery-code",
  });
  await page.getByRole("button", { name: "Continue to account security" }).click();
  await expect(page).toHaveURL(/\/dashboard\/security$/);
});
for (const kind of ["unknown", "malformedResult"] as const)
  test(`${kind} verification never confirms or automatically replays`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state[kind] = true;
    await page.goto("/mfa");
    await authenticator(page);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page.getByText(/The result could not be confirmed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify code" })).toBeDisabled();
    await expect(page.getByLabel("6-digit code")).toBeEmpty();
    expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
      1,
    );
    await expect(page.getByText("MFA verification confirmed.")).toHaveCount(0);
  });
for (const kind of ["malformedOptions", "optionsFailure"] as const)
  test(`${kind} cannot unlock first-factor setup`, async ({ page }) => {
    const state = await fixture(page);
    state[kind] = true;
    await page.goto("/mfa?setup=1");
    await page.getByRole("button", { name: "Check first-factor setup" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set up first MFA factor" }),
    ).toHaveCount(0);
  });
test("existing factor blocks first-factor setup, including a direct setup query", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/mfa?setup=1");
  await page.getByRole("button", { name: "Check first-factor setup" }).click();
  await expect(page.getByText(/An existing MFA method is available/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set up authenticator app" }),
  ).toHaveCount(0);
});
test("first-factor setup requires all unavailable methods and explicit recovery-code replacement consent", async ({
  page,
}) => {
  const state = await fixture(page);
  state.noMethods = true;
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Check first-factor setup" }).click();
  await page.getByRole("button", { name: "Set up first MFA factor" }).click();
  await expect(
    page.getByRole("button", { name: "Set up authenticator app" }),
  ).toBeDisabled();
  expect(state.writes.every((item) => item.endpoint.endsWith("/options"))).toBe(true);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toHaveValue(secret);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(
    page.getByRole("heading", { name: "Save your new recovery codes" }),
  ).toBeFocused();
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByLabel("New recovery codes")).toHaveValue(codes.join("\n"));
  expect(state.writes.at(-1)?.body).toEqual({ factorId: id(20), code: "123456" });
  expect(state.writes.every((item) => !!item.csrf)).toBe(true);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        url: location.href,
        cookie: document.cookie,
      }),
    ),
  ).not.toContain(codes[0]);
  await page.getByRole("button", { name: /I saved these codes/ }).click();
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
});
test("discarding authenticator setup clears the displayed secret and requires renewed consent", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  await page.getByRole("button", { name: "Discard setup shown here" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
    0,
  );
});
test("late enrollment response cannot restore secrets after a cross-tab session change", async ({
  page,
}) => {
  const state = await setup(page);
  state.delay = true;
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect.poll(() => !!state.release).toBe(true);
  await changed(page);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  state.release?.();
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
  await expect(page.getByText("MFA verification confirmed.")).toHaveCount(0);
});
test("malformed enrollment does not reveal codes or retain a setup secret as confirmed", async ({
  page,
}) => {
  const state = await setup(page);
  state.malformedResult = true;
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText(/The result could not be confirmed/)).toBeVisible();
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
});
test("virtual security key enrollment and authentication send browser credentials only after explicit gestures", async ({
  page,
}) => {
  const state = await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.getByLabel("Security key name (optional)").fill("Office key");
  await page.getByRole("button", { name: "Prepare new security key" }).click();
  await expect(page.getByRole("button", { name: "Create security key" })).toBeVisible();
  expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
    0,
  );
  await page.getByRole("button", { name: "Create security key" }).click();
  await expect(page.getByLabel("New recovery codes")).toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({
    name: "Office key",
    response: { type: "public-key", id: state.credentialId },
  });
  state.verified = false;
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Prepare security key", exact: true }).click();
  await page.getByRole("button", { name: "Use security key" }).click();
  await expect(page.getByText("MFA verification confirmed.")).toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({
    method: "webauthn",
    response: { type: "public-key", id: state.credentialId },
  });
  await cdp.detach();
});
test("cancelled browser security-key prompt allows fresh preparation without posting verification", async ({
  page,
}) => {
  const state = await setup(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator.credentials, "create", {
      value: () =>
        Promise.reject(new DOMException("cancelled private message", "NotAllowedError")),
      configurable: true,
    });
  });
  await page.getByRole("button", { name: "Prepare new security key" }).click();
  await page.getByRole("button", { name: "Create security key" }).click();
  await expect(page.getByText(/If you cancelled the browser prompt/)).toBeVisible();
  await expect(page.getByText(/cancelled private message/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare new security key" }),
  ).toBeEnabled();
  expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
    0,
  );
});
test("malformed session never grants enrollment", async ({ page }) => {
  const state = await fixture(page);
  state.malformedSession = true;
  await page.goto("/mfa?setup=1");
  await expect(page.getByRole("button", { name: "Check session again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set up authenticator app" }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("MFA setup and recovery codes fit mobile and remain accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-mfa-setup-mobile.png"),
    fullPage: true,
  });
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByLabel("New recovery codes")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-mfa-codes-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-mfa-codes-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("failed reassessment removes previously available first-factor setup", async ({
  page,
}) => {
  const state = await fixture(page);
  state.noMethods = true;
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Check first-factor setup" }).click();
  await expect(
    page.getByRole("button", { name: "Set up first MFA factor" }),
  ).toBeVisible();
  state.noMethods = false;
  state.optionsFailure = true;
  await page.getByRole("button", { name: "Check first-factor setup" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Set up first MFA factor" })).toHaveCount(
    0,
  );
});
test("checking an uncertain pending session does not unlock or replay verification", async ({
  page,
}) => {
  const state = await fixture(page);
  state.unknown = true;
  await page.goto("/mfa");
  await authenticator(page);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.getByRole("button", { name: "Check session status" }).click();
  await expect(page.getByText(/MFA is still required/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify code" })).toBeDisabled();
  expect(state.writes.filter((item) => item.endpoint.endsWith("/verify"))).toHaveLength(
    1,
  );
});
test("displayed enrollment codes disappear when another tab changes the account", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByLabel("New recovery codes")).toBeVisible();
  await changed(page);
  await expect(page.getByText(/Your session changed/)).toBeVisible();
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
  await expect(page.getByText("MFA verification confirmed.")).toHaveCount(0);
});

test("server enrollment step-up moves an older customer session to an existing MFA challenge", async ({
  page,
}) => {
  const state = await fixture(page);
  state.role = "CUSTOMER";
  state.mfaRequired = false;
  state.requirePriorMfa = true;
  await page.goto("/mfa?setup=1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(
    page.getByRole("button", { name: "Set up authenticator app" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Verify existing MFA" }).click();
  await authenticator(page);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("MFA verification confirmed.")).toBeVisible();
  expect(
    state.writes.filter((item) => item.endpoint === "/auth/mfa/totp/setup"),
  ).toHaveLength(1);
});

test("a new enrollment requirement hides the displayed setup key before existing-factor verification", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  state.requirePriorMfa = true;
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByRole("button", { name: "Verify existing MFA" })).toBeVisible();
  await expect(page.getByLabel("Authenticator setup key")).toHaveCount(0);
  await expect(page.getByLabel("New recovery codes")).toHaveCount(0);
  await page.getByRole("button", { name: "Verify existing MFA" }).click();
  await authenticator(page);
});
