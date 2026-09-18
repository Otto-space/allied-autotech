import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessStructuredData,
  indexingEnabled,
  privatePage,
  publicMetadata,
  serializeStructuredData,
  siteOrigin,
} from "@/lib/seo";
afterEach(() => vi.unstubAllEnvs());
describe("configured public identity", () => {
  it.each([
    "",
    "http://allied.example",
    "https://user:password@allied.example",
    "https://allied.example/path",
    "https://allied.example/?token=secret",
    "https://allied.example/#fragment",
    "https://localhost",
    "https://127.0.0.1",
    "https://allied.example:5000",
  ])("does not enable indexing with invalid origin %s", (origin) => {
    vi.stubEnv("SITE_ORIGIN", origin);
    vi.stubEnv("SITE_INDEXING", "enabled");
    expect(siteOrigin()).toBeUndefined();
    expect(indexingEnabled()).toBe(false);
    const metadata = publicMetadata("Parts", "Published parts", "/parts");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("requires both explicit indexing and origin; filters use a clean canonical", () => {
    vi.stubEnv("SITE_ORIGIN", "https://allied.example/");
    vi.stubEnv("SITE_INDEXING", "disabled");
    expect(indexingEnabled()).toBe(false);
    vi.stubEnv("SITE_INDEXING", "enabled");
    const metadata = publicMetadata("Parts", "Published parts", "/parts", true);
    expect(metadata.alternates).toEqual({ canonical: "https://allied.example/parts" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph).toMatchObject({
      url: "https://allied.example/parts",
      title: "Parts",
    });
    expect(publicMetadata("Parts", "Published parts", "/parts").robots).toEqual({
      index: true,
      follow: true,
    });
  });
  it("covers account entry and nested private routes without prefix collisions", () => {
    for (const path of [
      "/login",
      "/register",
      "/verify-email",
      "/reset-password",
      "/forgot-password",
      "/mfa",
      "/dashboard/cart",
      "/admin/staff",
      "/staff/accept-invitation",
      "/payments/complete",
    ])
      expect(privatePage(path)).toBe(true);
    for (const path of ["/", "/parts", "/services", "/administrator"])
      expect(privatePage(path)).toBe(false);
  });
  it("publishes only supplied business facts and escapes script terminators", () => {
    vi.stubEnv("SITE_ORIGIN", "");
    const data = businessStructuredData();
    expect(data.telephone).toBe("+2348136075567");
    expect(data.address.addressLocality).toBe("Port Harcourt");
    for (const field of [
      "url",
      "geo",
      "openingHours",
      "aggregateRating",
      "sameAs",
      "priceRange",
    ])
      expect(data).not.toHaveProperty(field);
    const hostile = { name: '</script><script>alert("test")</script>' };
    const serialized = serializeStructuredData(hostile);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(hostile);
  });
});
