import { capabilityView } from "@/lib/public-capabilities";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
vi.mock("@/lib/api/public-capabilities-server", () => ({
  getPublicCapabilities: async () =>
    capabilityView(publicCapabilitiesFixture("browse_enquiries")),
}));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/api/public-server", () => ({ publicData: read }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => undefined,
  useRouter: () => ({ refresh: vi.fn() }),
}));
import { SearchResults } from "@/app/search/search-results";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_HELP_LEARN_ENABLED", "false");
  read.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it("searches only public sources, ranks exact names first and keeps other groups usable on failure", async () => {
  read.mockImplementation(async (path: string) => {
    expect(path).toMatch(/^\/public\//);
    if (path.includes("/services/"))
      return {
        items: [
          { id: "prefix", name: "Brake inspection", shortDescription: "Check brakes" },
          { id: "exact", name: "Brake", shortDescription: "Actual offering" },
        ],
      };
    if (path.includes("/catalog/")) throw Error("source unavailable");
    return { items: [] };
  });
  const html = renderToStaticMarkup(
    await SearchResults({ query: "Brake", helpOnly: false }),
  );
  expect(html.indexOf('href="/services/exact"')).toBeLessThan(
    html.indexOf('href="/services/prefix"'),
  );
  expect(html).toContain("Shop results are temporarily unavailable");
  expect(html).toContain("Retry search</button>");
  expect(html).toContain("No vehicles results found.");
  expect(read).toHaveBeenCalledTimes(3);
});

it("does not render restricted learning returned by an incorrect public response", async () => {
  vi.stubEnv("NEXT_PUBLIC_HELP_LEARN_ENABLED", "true");
  read.mockImplementation(async (path: string, parse: (value: unknown) => unknown) => {
    expect(path).toBe("/public/learning/catalogue?destinationsVersion=2");
    return parse({
      accessKey: "a".repeat(64),
      audience: "work",
      contentVersion: 1,
      mode: "browse_enquiries",
      flags: { guides: false, practice: false, ai: false },
      articles: [
        {
          id: "restricted-synthetic",
          title: "Restricted operator instructions",
          summary: "Private synthetic guidance",
          prerequisites: "",
          steps: [],
          outcome: "",
          recovery: "",
          keywords: "inspection",
          page: "work",
          href: "/admin",
          source: "Synthetic private source",
          version: 1,
          status: "published",
          reviewedAt: "2026-11-02",
        },
      ],
      guides: [],
      scenarios: [],
    });
  });
  const html = renderToStaticMarkup(
    await SearchResults({ query: "inspection", helpOnly: true }),
  );
  expect(html).toContain("More Help &amp; Learn results are temporarily unavailable");
  expect(html).toContain("Can I inspect a vehicle before buying?");
  expect(html).not.toContain("Restricted operator instructions");
  expect(html).not.toContain("Private synthetic guidance");
  expect(html).not.toContain("Services search results");
  expect(read).toHaveBeenCalledTimes(1);
});

it("finds existing public FAQs without requiring an account or learning activation", async () => {
  const html = renderToStaticMarkup(
    await SearchResults({ query: "inspect", helpOnly: true }),
  );
  expect(html).toContain("Can I inspect a vehicle before buying?");
  expect(html).toContain('href="/help/');
  expect(read).not.toHaveBeenCalled();
});

it("ranks a genuine manufacturer part number ahead of a title prefix and shows its destination cue", async () => {
  read.mockImplementation(async (path: string) =>
    path.includes("/catalog/")
      ? {
          items: [
            {
              id: "prefix",
              name: "AB-123 compatible kit",
              sku: "STOCK-2",
              manufacturerPartNumber: "OTHER",
              brand: null,
            },
            {
              id: "exact-mpn",
              name: "Original filter",
              sku: "STOCK-1",
              manufacturerPartNumber: "AB-123",
              brand: "Synthetic maker",
            },
          ],
        }
      : { items: [] },
  );
  const html = renderToStaticMarkup(
    await SearchResults({ query: "ab-123", helpOnly: false }),
  );
  expect(html.indexOf('href="/parts/exact-mpn"')).toBeLessThan(
    html.indexOf('href="/parts/prefix"'),
  );
  expect(html).toContain("Part no. AB-123");
  expect(html).toContain("Synthetic maker · Part no. AB-123");
});

it("retains current public FAQs and retry when optional learning cannot be fetched", async () => {
  vi.stubEnv("NEXT_PUBLIC_HELP_LEARN_ENABLED", "true");
  read.mockRejectedValue(Error("Synthetic learning unavailable"));
  const html = renderToStaticMarkup(
    await SearchResults({ query: "inspect", helpOnly: true }),
  );
  expect(html).toContain("Can I inspect a vehicle before buying?");
  expect(html).toContain("More Help &amp; Learn results are temporarily unavailable");
  expect(html).toContain("Retry search</button>");
  expect(html).not.toContain("No help results found");
});
