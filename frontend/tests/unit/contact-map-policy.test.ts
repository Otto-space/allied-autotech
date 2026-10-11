import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("Contact Maps frame policy", () => {
  it.each(["", "   "])(
    "keeps external frames closed without a configured key: %j",
    (key) => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", key);
      const policy = proxy(new NextRequest("https://allied.example/contact")).headers.get(
        "Content-Security-Policy",
      );
      expect(policy).toContain("frame-src 'self'");
      expect(policy).not.toContain("google.com");
    },
  );

  it("allows only the Maps embed path on Contact and retains existing protections", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "synthetic-browser-key");
    const policy = proxy(
      new NextRequest("https://allied.example/contact?view=location"),
    ).headers.get("Content-Security-Policy");
    expect(policy).toContain("frame-src 'self' https://www.google.com/maps/embed/");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain("synthetic-browser-key");
  });

  it.each(["/", "/contact-other", "/dashboard/support", "/admin/support"])(
    "does not extend Maps permission to %s",
    (path) => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "synthetic-browser-key");
      const response = proxy(new NextRequest(`https://allied.example${path}`));
      expect(response.headers.get("Content-Security-Policy")).not.toContain("google.com");
      if (path.startsWith("/dashboard") || path.startsWith("/admin"))
        expect(response.headers.get("Cache-Control")).toBe(
          "private, no-store, max-age=0",
        );
    },
  );
});
