import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendOrigin } from "@/lib/backend-origin";

beforeEach(() => {
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("BACKEND_ORIGIN", "");
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
    "allows a frontend-only deployment in Vercel %s",
    (environment) => {
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("VERCEL_ENV", environment);
      expect(backendOrigin()).toBeUndefined();
      vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
      expect(backendOrigin()).toBe("https://api.example.test");
    },
  );

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

it("routes disconnected previews to an unavailable response without contacting localhost", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.resetModules();
  const { default: config } = await import("../../next.config");
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
});
