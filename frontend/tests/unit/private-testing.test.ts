import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "../../proxy";
import { privateTestingAuthorization } from "../../lib/private-testing";

const password = "b".repeat(64);
const authorization = `Basic ${Buffer.from(`allied-test:${password}`).toString("base64")}`;
afterEach(() => vi.unstubAllEnvs());
function enable() {
  vi.stubEnv("PRIVATE_TESTING_ENABLED", "true");
  vi.stubEnv("PRIVATE_TESTING_PASSWORD", password);
}
describe("private test frontend perimeter", () => {
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
