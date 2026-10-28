import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { backendClientAddress, frontendProxySecret } from "@/lib/backend-client-address";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { validateDeploymentConfig } from "@/lib/deployment-config";
afterEach(() => vi.unstubAllEnvs());
it.each(["browse_enquiries", "catalogue"])(
  "requires the forwarding key for a connected production %s launch",
  (mode) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    vi.stubEnv("BACKEND_ORIGIN", "https://api.example.com");
    vi.stubEnv("SITE_ORIGIN", "https://example.com");
    vi.stubEnv("FRONTEND_PROXY_SECRET", "");
    expect(() => validateDeploymentConfig()).toThrow(
      "verified backend client forwarding",
    );
    vi.stubEnv("FRONTEND_PROXY_SECRET", Buffer.alloc(32, 31).toString("base64"));
    expect(() => validateDeploymentConfig()).not.toThrow();
  },
);
it("keeps unconfigured/local deployments unchanged", () => {
  vi.stubEnv("FRONTEND_PROXY_SECRET", "");
  expect(backendClientAddress(new Headers(), "GET", "/api/v1/public/services")).toEqual(
    {},
  );
});
it("signs only Vercel's platform address, ignoring caller alternatives", () => {
  const secret = Buffer.alloc(32, 31).toString("base64");
  vi.stubEnv("FRONTEND_PROXY_SECRET", secret);
  vi.stubEnv("VERCEL", "1");
  const headers = new Headers({
    "x-vercel-forwarded-for": "198.51.100.23",
    "x-forwarded-for": "203.0.113.19",
    "x-allied-client-ip": "203.0.113.20",
    "x-allied-client-proof": "forged",
  });
  const proof = backendClientAddress(headers, "GET", "/api/v1/public/services");
  expect(proof["x-allied-client-ip"]).toBe("198.51.100.23");
  expect(proof["x-allied-client-proof"]).toBe(
    createHmac("sha256", Buffer.from(secret, "base64"))
      .update(
        `allied-client-v1\nGET\n/api/v1/public/services\n198.51.100.23\n${proof["x-allied-client-time"]}`,
      )
      .digest("hex"),
  );
});
it("refuses invalid secret, unverified headers and non-Vercel runtime", () => {
  vi.stubEnv("FRONTEND_PROXY_SECRET", "invalid");
  expect(() => frontendProxySecret()).toThrow();
  vi.stubEnv("FRONTEND_PROXY_SECRET", Buffer.alloc(32, 31).toString("base64"));
  vi.stubEnv("VERCEL", "1");
  expect(() =>
    backendClientAddress(new Headers({ "x-forwarded-for": "198.51.100.1" }), "GET", "/"),
  ).toThrow();
  vi.stubEnv("VERCEL", "0");
  expect(() =>
    backendClientAddress(
      new Headers({ "x-vercel-forwarded-for": "198.51.100.1" }),
      "GET",
      "/",
    ),
  ).toThrow();
});
it("replaces caller proof at the API rewrite while preserving session and CSRF headers", () => {
  vi.stubEnv("PRIVATE_TESTING_ENABLED", "false");
  vi.stubEnv("FRONTEND_PROXY_SECRET", Buffer.alloc(32, 31).toString("base64"));
  vi.stubEnv("VERCEL", "1");
  const response = proxy(
    new NextRequest("https://example.com/api/v1/customers/profile", {
      method: "PATCH",
      headers: {
        "x-vercel-forwarded-for": "198.51.100.23",
        "x-allied-client-ip": "203.0.113.1",
        "x-allied-client-proof": "forged",
        cookie: "aat_session=synthetic",
        "x-csrf-token": "synthetic-csrf",
      },
    }),
  );
  expect(response.headers.get("x-middleware-request-x-allied-client-ip")).toBe(
    "198.51.100.23",
  );
  expect(response.headers.get("x-middleware-request-x-allied-client-proof")).not.toBe(
    "forged",
  );
  expect(response.headers.get("x-middleware-request-cookie")).toBe(
    "aat_session=synthetic",
  );
  expect(response.headers.get("x-middleware-request-x-csrf-token")).toBe(
    "synthetic-csrf",
  );
});
