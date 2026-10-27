import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "../../proxy";
import {
  privateTestingAuthorization,
  createPrivateTestingCookie,
  privateTestingCookieAllowed,
  privateTestingCookieName,
  privateTestingCookieSeconds,
} from "../../lib/private-testing";

const password = "b".repeat(64);
const authorization = `Basic ${Buffer.from(`allied-test:${password}`).toString("base64")}`;
afterEach(() => vi.unstubAllEnvs());
function enable() {
  vi.stubEnv("PRIVATE_TESTING_ENABLED", "true");
  vi.stubEnv("PRIVATE_TESTING_PASSWORD", password);
}
describe("private test frontend perimeter", () => {
  it("remembers access across page and asset requests without exposing credentials", () => {
    enable();
    const result = proxy(
      new NextRequest("https://staging.example.com/login", {
        headers: { authorization },
      }),
    );
    const cookie = result.cookies.get(privateTestingCookieName)!;
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: privateTestingCookieSeconds,
    });
    expect(cookie.domain).toBeUndefined();
    expect(cookie.value).not.toContain(password);
    expect(cookie.value).not.toContain(authorization);
    for (const path of ["/login", "/admin", "/_next/static/a.js", "/robots.txt"]) {
      const remembered = proxy(
        new NextRequest(`https://staging.example.com${path}`, {
          headers: { cookie: `${cookie.name}=${cookie.value}` },
        }),
      );
      expect(remembered.status).toBe(200);
      expect(remembered.cookies.get(privateTestingCookieName)).toBeUndefined();
      expect(remembered.headers.get("www-authenticate")).toBeNull();
      expect(remembered.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });
  it("forwards cookie-only API access internally without losing application security headers", () => {
    enable();
    const cookie = createPrivateTestingCookie("staging.example.com", authorization);
    const result = proxy(
      new NextRequest("https://staging.example.com/api/v1/auth/session", {
        headers: {
          cookie: `${privateTestingCookieName}=${cookie}; __Host-aat_session=synthetic-session`,
          origin: "https://staging.example.com",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "synthetic-csrf",
        },
      }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("authorization")).toBeNull();
    // Next consumes these internal request overrides; built/hosted checks verify
    // they are stripped from the response that reaches the browser.
    expect(result.headers.get("x-middleware-request-authorization")).toBe(authorization);
    expect(result.headers.get("x-middleware-request-cookie")).toContain(
      "__Host-aat_session=synthetic-session",
    );
    expect(result.headers.get("x-middleware-request-origin")).toBe(
      "https://staging.example.com",
    );
    expect(result.headers.get("x-middleware-request-sec-fetch-site")).toBe("same-origin");
    expect(result.headers.get("x-middleware-request-x-csrf-token")).toBe(
      "synthetic-csrf",
    );
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects expired, tampered, different-host and password-rotated proofs", () => {
    enable();
    const host = "staging.example.com";
    const now = Date.now();
    const cookie = createPrivateTestingCookie(host, authorization, now);
    expect(privateTestingCookieAllowed(cookie, host, authorization, now)).toBe(true);
    expect(
      privateTestingCookieAllowed(
        cookie,
        host,
        authorization,
        now + privateTestingCookieSeconds * 1000,
      ),
    ).toBe(false);
    expect(
      privateTestingCookieAllowed(cookie, "other.example.com", authorization, now),
    ).toBe(false);
    expect(privateTestingCookieAllowed(cookie, host, "changed-password", now)).toBe(
      false,
    );
    expect(privateTestingCookieAllowed(cookie, host, authorization, now - 1000)).toBe(
      false,
    );
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0");
    for (const value of [
      tampered,
      "invalid",
      cookie + "extra",
      createPrivateTestingCookie(
        host,
        authorization,
        now - privateTestingCookieSeconds * 1000,
      ),
    ]) {
      expect(
        proxy(
          new NextRequest(`https://${host}/admin`, {
            headers: { cookie: `${privateTestingCookieName}=${value}` },
          }),
        ).status,
      ).toBe(401);
    }
  });
  it("never issues private access for unauthenticated public brand assets", () => {
    enable();
    const result = proxy(
      new NextRequest("https://staging.example.com/images/allied-autotech/logo.webp"),
    );
    expect(result.status).toBe(200);
    expect(result.cookies.get(privateTestingCookieName)).toBeUndefined();
  });
  it.each([
    "/",
    "/admin",
    "/api/v1/auth/session",
    "/_next/static/a.js",
    "/_next/image?url=%2Flogo.png&w=64&q=75",
    "/logo.png",
    "/robots.txt",
    "/sitemap.xml",
  ])("gates %s including assets and API rewrites", (path) => {
    enable();
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(
      true,
    );
    const result = proxy(new NextRequest(`https://staging.example.com${path}`));
    expect(result.status).toBe(401);
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("does not allow prefetch headers to bypass authentication", () => {
    enable();
    const req = new NextRequest("https://staging.example.com/admin", {
      headers: { purpose: "prefetch", "next-router-prefetch": "1" },
    });
    expect(proxy(req).status).toBe(401);
  });
  it("permits only checked-in brand image paths for internal image optimization", () => {
    enable();
    expect(
      proxy(
        new NextRequest(
          "https://staging.example.com/images/allied-autotech/workshop-editorial.webp",
        ),
      ).status,
    ).toBe(200);
    for (const path of [
      "/images/allied-autotech/private/data.webp",
      "/images/customer.webp",
      "/api/v1/public/services/image.webp",
    ])
      expect(proxy(new NextRequest(`https://staging.example.com${path}`)).status).toBe(
        401,
      );
    expect(
      proxy(
        new NextRequest(
          "https://staging.example.com/images/allied-autotech/workshop-editorial.webp",
          { method: "POST" },
        ),
      ).status,
    ).toBe(401);
  });
  it.each(["Basic !!!!", "Bearer wrong", `${authorization}bad`])(
    "rejects invalid credentials",
    (header) => {
      enable();
      expect(
        proxy(
          new NextRequest("https://staging.example.com", {
            headers: { authorization: header },
          }),
        ).status,
      ).toBe(401);
    },
  );
  it("permits valid browser and API traffic and never responds with the password", () => {
    enable();
    const result = proxy(
      new NextRequest("https://staging.example.com/api/v1/public/services", {
        headers: { authorization },
      }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(JSON.stringify([...result.headers])).not.toContain(password);
    expect(JSON.stringify([...result.headers])).not.toContain(authorization);
    expect(result.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("fails closed on missing credentials or invalid flags", () => {
    enable();
    vi.stubEnv("PRIVATE_TESTING_PASSWORD", "");
    expect(() => privateTestingAuthorization()).toThrow();
    expect(proxy(new NextRequest("https://staging.example.com/")).status).toBe(503);
    vi.stubEnv("PRIVATE_TESTING_ENABLED", "typo");
    expect(proxy(new NextRequest("https://staging.example.com/")).status).toBe(503);
  });
  it("preserves public mode without the staging gate", () => {
    vi.stubEnv("PRIVATE_TESTING_ENABLED", "false");
    expect(privateTestingAuthorization()).toBeUndefined();
    expect(proxy(new NextRequest("https://example.com/")).status).toBe(200);
  });
});
