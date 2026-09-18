import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  invalidateSession,
  announceSessionChange,
  isExternalSessionChange,
  setCsrfToken,
  refreshCsrf,
  trustedCheckoutUrl,
} from "../../lib/api/client";
const envelope = (data: unknown) =>
  new Response(
    JSON.stringify({
      success: true,
      message: "Done",
      data,
      meta: { requestId: "test-request" },
    }),
    { headers: { "content-type": "application/json" } },
  );
beforeEach(() => invalidateSession());
afterEach(() => vi.unstubAllGlobals());
describe("API security and recovery", () => {
  it.each([
    ["/auth/session", "GET", false],
    ["/auth/session", "POST", true],
    ["/customers/profile", "GET", true],
    ["/auth/sessions", "GET", true],
  ])(
    "optional session probing at %s (%s) preserves protected-request invalidation",
    async (path, method, shouldInvalidate) => {
      const dispatchEvent = vi.fn();
      vi.stubGlobal("window", { dispatchEvent });
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ success: false, error: { code: "SESSION_EXPIRED" } }),
              { status: 401, headers: { "content-type": "application/json" } },
            ),
        ),
      );
      await expect(
        apiRequest(String(path), { method: String(method), optionalSession: true }),
      ).rejects.toMatchObject({ status: 401 });
      expect(dispatchEvent).toHaveBeenCalledTimes(shouldInvalidate ? 1 : 0);
    },
  );

  it("discards a decoded response when its caller leaves during response parsing", async () => {
    const controller = new AbortController();
    let finish!: (value: unknown) => void;
    const response = envelope({});
    const json = vi.spyOn(response, "json").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const request = apiRequest("/auth/session", { signal: controller.signal });
    await vi.waitFor(() => expect(json).toHaveBeenCalled());
    controller.abort();
    finish({
      success: true,
      message: "Done",
      data: { secret: "obsolete" },
      meta: { requestId: "test" },
    });
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
  it("ignores its own broadcast without hiding account changes from other tabs", () => {
    const postMessage = vi.fn();
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        postMessage = postMessage;
        close() {}
      },
    );
    announceSessionChange("password-changed");
    const payload = postMessage.mock.calls[0][0];
    expect(isExternalSessionChange(payload)).toBe(false);
    expect(isExternalSessionChange({ type: "changed", source: "another-tab" })).toBe(
      true,
    );
    expect(isExternalSessionChange("changed")).toBe(true);
    expect(isExternalSessionChange({ type: "unrelated" })).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["source", "type"]);
  });
  it.each([
    "/auth/password/change",
    "/auth/mfa/factors/10000000-0000-4000-8000-000000000001",
  ])(
    "preserves an authenticated account after password reauthentication fails at %s",
    async (path) => {
      const dispatchEvent = vi.fn();
      vi.stubGlobal("window", { dispatchEvent });
      setCsrfToken("x".repeat(40));
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                success: false,
                error: { code: "AUTHENTICATION_FAILED" },
              }),
              { status: 401, headers: { "content-type": "application/json" } },
            ),
        ),
      );
      await expect(
        apiRequest(path, { method: "POST", csrf: true, body: {} }),
      ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
      expect(dispatchEvent).not.toHaveBeenCalled();
    },
  );
  it.each(["/auth/sessions", "/auth/mfa/factors"])(
    "invalidates account state after a security read expires at %s",
    async (path) => {
      const dispatchEvent = vi.fn();
      vi.stubGlobal("window", { dispatchEvent });
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ success: false, error: { code: "SESSION_EXPIRED" } }),
              { status: 401, headers: { "content-type": "application/json" } },
            ),
        ),
      );
      await expect(apiRequest(path)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
    },
  );
  it("password rotation discards old requests while retaining only the new CSRF token", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn((url: string) =>
      url.endsWith("/customers/profile")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(envelope({})),
    );
    vi.stubGlobal("fetch", fetcher);
    const old = apiRequest("/customers/profile");
    announceSessionChange("password-changed");
    setCsrfToken("rotated-token-".repeat(4));
    finish(envelope({ privateName: "Old state" }));
    await expect(old).rejects.toMatchObject({ name: "AbortError" });
    await apiRequest("/customers/cart", { method: "DELETE", csrf: true, body: {} });
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/customers/cart",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "rotated-token-".repeat(4) }),
      }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    "//evil.test",
    "/../../private",
    "/%2e%2e/%2e%2e/private",
    "/customers%2f..%2fprivate",
    "/customers\\private",
  ])("rejects API path traversal before sending credentials: %s", async (path) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(apiRequest(path)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not expose arbitrary server text as a request identifier", () => {
    const error = new ApiError(500, {
      meta: { requestId: "database connection secret: value" },
    });
    expect(error.requestId).toBeUndefined();
  });
  it("maps errors without displaying exception or rejected field text", () => {
    const error = new ApiError(422, {
      message: "secret server exception",
      error: {
        code: "VALIDATION_FAILED",
        fields: { "body.email": ["sensitive rejected input"] },
      },
    });
    expect(error.message).not.toContain("secret");
    expect(error.fields?.["body.email"]).toEqual([
      "Check this field and enter a valid value.",
    ]);
  });
  it("single-flights CSRF rotation for simultaneous mutations", async () => {
    const fetcher = vi.fn(async (url: string) =>
      envelope(url.endsWith("/auth/csrf") ? { csrfToken: "x".repeat(40) } : {}),
    );
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([
      apiRequest("/customers/cart", { method: "DELETE", csrf: true }),
      apiRequest("/customers/profile", { method: "PATCH", csrf: true, body: {} }),
    ]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/csrf"))).toHaveLength(
      1,
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("never automatically replays a consequential mutation after a connection failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("network failed"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiRequest("/customers/orders/checkout", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed success envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>proxy error</html>")),
    );
    await expect(apiRequest("/public/services")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("discards a late account response after session invalidation", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const request = apiRequest("/customers/profile");
    invalidateSession();
    finish(envelope({ privateName: "Previous account" }));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
  it("cannot retain an obsolete CSRF token after a session change", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const request = refreshCsrf();
    invalidateSession();
    finish(envelope({ csrfToken: "x".repeat(40) }));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
  it.each([
    "https://checkout.paystack.com.evil.test/a",
    "http://checkout.paystack.com/a",
    "https://user@checkout.paystack.com/a",
    "https://checkout.paystack.com:444/a",
    "javascript:alert(1)",
  ])("rejects untrusted checkout destination %s", (url) =>
    expect(() => trustedCheckoutUrl(url)).toThrow(),
  );
  it("accepts a supported hosted payment destination", () =>
    expect(trustedCheckoutUrl("https://checkout.paystack.com/test")).toBe(
      "https://checkout.paystack.com/test",
    ));
});
