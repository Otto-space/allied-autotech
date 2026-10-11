import type { Page, Route } from "@playwright/test";
import type { MfaFactor, SecuritySession } from "@/lib/api/security-schemas";
export const id = (n: number) => `a2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
export const codes = Array.from(
  { length: 10 },
  (_, index) => `isolated-code-${index}-secret`,
);
export const factor = (n = 1, status: MfaFactor["status"] = "ACTIVE"): MfaFactor => ({
  id: id(n),
  name: n === 1 ? "Test authenticator" : "Test security key",
  type: n === 1 ? "TOTP" : "WEBAUTHN",
  status,
  createdAt: time,
  verifiedAt: status === "ACTIVE" ? time : null,
  lastUsedAt: null,
});
export const session = (n: number): SecuritySession => ({
  id: id(n),
  current: n === 10,
  client: n === 10 ? "Current browser" : `Test browser ${n}`,
  network: "192.0.*.*",
  createdAt: time,
  lastUsedAt: time,
  expiresAt: "2027-01-01T00:00:00Z",
  mfaVerified: true,
});
const reply = (route: Route, data?: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      ...(data === undefined ? {} : { data }),
      meta: { requestId: "security-test" },
    },
  });
const fail = (route: Route, code: string, status: number, fields?: unknown) =>
  route.fulfill({
    status,
    json: {
      success: false,
      message: "Never display private exception text",
      error: { code, ...(fields ? { fields } : {}) },
    },
  });
export async function fixture(page: Page, role = "CUSTOMER") {
  const state = {
    factors: [factor()] as MfaFactor[],
    sessions: [session(10), session(11), session(12)] as SecuritySession[],
    pendingMfa: false,
    failSessions: false,
    failFactors: false,
    malformedFactors: false,
    expireSessions: false,
    unknown: false,
    wrongPassword: false,
    passwordValidation: false,
    malformedPassword: false,
    malformedCodes: false,
    delayCodes: false,
    releaseCodes: undefined as (() => void) | undefined,
    writes: [] as { endpoint: string; method: string; body: unknown; csrf?: string }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(10),
        user: { id: id(20), role, email: "security@example.test" },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" || state.pendingMfa ? null : time,
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-security-csrf-".repeat(3) });
    if (endpoint === "/auth/sessions" && request.method() === "GET")
      return state.expireSessions
        ? fail(route, "SESSION_EXPIRED", 401)
        : state.failSessions
          ? fail(route, "DATABASE_UNAVAILABLE", 503)
          : reply(route, { sessions: state.sessions });
    if (endpoint === "/auth/mfa/factors" && request.method() === "GET")
      return state.failFactors
        ? fail(route, "DATABASE_UNAVAILABLE", 503)
        : reply(route, state.malformedFactors ? {} : { factors: state.factors });
    if (request.method() !== "GET")
      state.writes.push({
        endpoint,
        method: request.method(),
        body: request.postDataJSON(),
        csrf: request.headers()["x-csrf-token"],
      });
    if (state.unknown) return route.abort("connectionreset");
    if (endpoint === "/auth/password/change") {
      if (state.wrongPassword) return fail(route, "AUTHENTICATION_FAILED", 401);
      if (state.passwordValidation)
        return fail(route, "VALIDATION_FAILED", 422, {
          "body.newPassword": ["Never echo a secret password"],
        });
      state.sessions = [session(10)];
      return reply(
        route,
        state.malformedPassword ? {} : { csrfToken: "rotated-security-csrf-".repeat(3) },
      );
    }
    if (endpoint === "/auth/sessions") {
      state.sessions = state.sessions.filter((item) => item.current);
      return reply(route);
    }
    if (endpoint.startsWith("/auth/sessions/")) {
      state.sessions = state.sessions.filter(
        (item) => item.id !== endpoint.split("/").at(-1),
      );
      return reply(route);
    }
    if (endpoint.startsWith("/auth/mfa/factors/")) {
      if (state.wrongPassword) return fail(route, "AUTHENTICATION_FAILED", 401);
      state.factors = state.factors.filter(
        (item) => item.id !== endpoint.split("/").at(-1),
      );
      return reply(route);
    }
    if (endpoint === "/auth/mfa/recovery-codes/regenerate") {
      if (state.delayCodes)
        await new Promise<void>((resolve) => {
          state.releaseCodes = resolve;
        });
      return reply(route, { recoveryCodes: state.malformedCodes ? [] : codes });
    }
    return fail(route, "NOT_FOUND", 404);
  });
  return state;
}
