import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  invalidateSession,
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
