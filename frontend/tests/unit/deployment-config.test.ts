import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendOrigin } from "@/lib/backend-origin";
import { validateDeploymentConfig } from "@/lib/deployment-config";

beforeEach(() => {
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("BACKEND_ORIGIN", "");
  vi.stubEnv("SITE_ORIGIN", "");
  vi.stubEnv("SITE_INDEXING", "disabled");
});
afterEach(() => vi.unstubAllEnvs());

describe("backend deployment configuration", () => {
  it("preserves local development and container routing", () => {
    expect(backendOrigin()).toBe("http://127.0.0.1:5000");
    vi.stubEnv("BACKEND_ORIGIN", "http://backend:5000/");
    expect(backendOrigin()).toBe("http://backend:5000");
  });

  it("normalizes a trailing slash for both rewrites and server reads", () => {
    vi.stubEnv("BACKEND_ORIGIN", " https://api.example.test/ ");
    expect(backendOrigin()).toBe("https://api.example.test");
  });

  it.each(["preview", "production"])(
    "allows a frontend-only Vercel %s",
    (environment) => {
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("VERCEL_ENV", environment);
      expect(backendOrigin()).toBeUndefined();
      vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
      expect(backendOrigin()).toBe("https://api.example.test");
    },
  );

  it("allows production without an API when the frontend origin is configured", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SITE_ORIGIN", "https://alliedautotech.com");
    expect(backendOrigin()).toBeUndefined();
    expect(() => validateDeploymentConfig()).not.toThrow();
  });

  it("requires a distinct approved frontend origin in production", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
    expect(() => validateDeploymentConfig()).toThrow(/SITE_ORIGIN is required/);
    vi.stubEnv("SITE_ORIGIN", "https://api.example.test");
    expect(() => validateDeploymentConfig()).toThrow(/not the frontend/);
    vi.stubEnv("SITE_ORIGIN", "https://www.example.test");
    expect(() => validateDeploymentConfig()).not.toThrow();
    vi.stubEnv("SITE_INDEXING", "enable");
    expect(() => validateDeploymentConfig()).toThrow(/SITE_INDEXING/);
  });

  it.each([
    "http://www.example.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:password@www.example.test",
    "https://www.example.test/path",
    "https://www.example.test:5000",
    "https://www.example.test/?token=secret",
  ])("rejects invalid production frontend origin %s", (origin) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
    vi.stubEnv("SITE_ORIGIN", origin);
    expect(() => validateDeploymentConfig()).toThrow(/SITE_ORIGIN/);
  });

  it.each([
    "http://127.0.0.1:5000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "http://backend:5000",
    "http://api.example.test",
  ])("rejects unreachable or insecure hosted backend %s", (origin) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BACKEND_ORIGIN", origin);
    expect(() => backendOrigin()).toThrow(/reachable HTTPS/);
  });

  it("accepts an HTTPS tunnel to a local backend without changing its environment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BACKEND_ORIGIN", "https://allied-local-example.trycloudflare.com/");
    expect(backendOrigin()).toBe("https://allied-local-example.trycloudflare.com");
  });

  it.each([
    "not-a-url",
    "https://user:password@api.example.test",
    "https://api.example.test/api/v1",
    "https://api.example.test/?key=secret",
    "https://api.example.test/#fragment",
    "ftp://api.example.test",
  ])("rejects malformed or non-origin configuration %s", (origin) => {
    vi.stubEnv("BACKEND_ORIGIN", origin);
    expect(() => backendOrigin()).toThrow(/BACKEND_ORIGIN/);
  });

  it("allows a local backend when using vercel dev", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(backendOrigin()).toBe("http://127.0.0.1:5000");
  });
});

it("keeps Vercel API rewrites same-origin while using native Next.js output", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test/");
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  expect(config.output).toBeUndefined();
  expect(await config.rewrites?.()).toEqual([
    { source: "/api/v1/:path*", destination: "https://api.example.test/api/v1/:path*" },
  ]);
});

it("retains standalone output on other hosts", async () => {
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  expect(config.output).toBe("standalone");
});

it("validates production before generating Vercel routes", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.resetModules();
  await expect(import("../../next.config")).rejects.toThrow(/SITE_ORIGIN is required/);
});

it.each(["preview", "production"])(
  "routes disconnected %s to an unavailable response without contacting localhost",
  async (environment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("SITE_ORIGIN", "https://alliedautotech.com");
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.output).toBeUndefined();
    expect(await config.rewrites?.()).toEqual([
      { source: "/api/v1/:path*", destination: "/api/backend-unavailable" },
    ]);
    const route = await import("../../app/api/backend-unavailable/route");
    for (const handler of [route.GET, route.POST, route.PUT, route.PATCH, route.DELETE]) {
      const response = handler();
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        success: false,
        error: { code: "BACKEND_NOT_CONFIGURED" },
      });
    }
  },
);
