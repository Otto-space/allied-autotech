import type { Page, Route } from "@playwright/test";
export const id = (n: number) => `a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const secret = "ABCDEFGHIJKLMNOP";
export const codes = Array.from(
  { length: 10 },
  (_, i) => `isolated-recovery-code-${i + 1}`,
);
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
export async function fixture(page: Page) {
  const state = {
    role: "STAFF",
    verified: false,
    mfaRequired: true,
    requirePriorMfa: false,
    noMethods: false,
    malformedOptions: false,
    optionsFailure: false,
    rateLimit: false,
    retryAfter: "3",
    rejectCode: false,
    unknown: false,
    malformedResult: false,
    malformedSession: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    credentialId: "aXNvbGF0ZWQtY3JlZGVudGlhbA",
    factors: [] as {
      id: string;
      name: string;
      type: "TOTP";
      status: "ACTIVE";
      createdAt: string;
      verifiedAt: string;
      lastUsedAt: null;
    }[],
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
    if (endpoint === "/auth/mfa/factors")
      return state.verified
        ? reply(route, { factors: state.factors })
        : fail(route, "MFA_REQUIRED", 403);
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
      if (state.rateLimit)
        return route.fulfill({
          status: 429,
          headers: { "Retry-After": state.retryAfter },
          json: { success: false, error: { code: "RATE_LIMITED" } },
        });
      if (state.delay)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.unknown) return route.abort("connectionreset");
      if (state.rejectCode) return fail(route);
      if (endpoint === "/auth/mfa/totp/verify" && body.replaceFactorId)
        state.factors = state.factors.filter(
          (factor) => factor.id !== body.replaceFactorId,
        );
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
