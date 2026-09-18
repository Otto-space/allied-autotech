import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { sitemapPaths } from "@/lib/api/sitemap-server";
import { GET } from "@/app/sitemap.xml/route";
import robots from "@/app/robots";
const id = (n: number) => `a8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function configured() {
  vi.stubEnv("SITE_ORIGIN", "https://allied.example");
  vi.stubEnv("SITE_INDEXING", "enabled");
}
function result(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { "content-type": "application/json" },
  });
}
it("does not query the backend or advertise a sitemap when indexing is disabled", async () => {
  configured();
  vi.stubEnv("SITE_INDEXING", "disabled");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await GET()).status).toBe(404);
  expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  expect(fetch).not.toHaveBeenCalled();
});
it("scans all three public catalogues without cookies and includes later-page IDs", async () => {
  configured();
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input);
    if (url.includes("/services"))
      return result({
        items: [{ id: id(url.includes("cursor=") ? 2 : 1) }],
        ...(url.includes("cursor=") ? {} : { nextCursor: id(1) }),
      });
    return result({ items: [{ id: id(url.includes("/vehicles") ? 3 : 4) }] });
  });
  vi.stubGlobal("fetch", fetch);
  const response = await GET();
  expect(response.status).toBe(200);
  const xml = await response.text();
  expect(xml).toContain(`https://allied.example/services/${id(2)}`);
  expect(xml).toContain(`https://allied.example/vehicles/${id(3)}`);
  expect(xml).not.toContain("lastmod");
  expect(xml).not.toContain("dashboard");
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const [, options] of fetch.mock.calls) {
    expect(options?.credentials).toBe("omit");
    expect(options?.cache).toBe("no-store");
    expect(options?.redirect).toBe("error");
    expect(options?.headers).toEqual({ Accept: "application/json" });
  }
  expect(robots()).toMatchObject({ sitemap: "https://allied.example/sitemap.xml" });
});
it.each(["outage", "malformed", "duplicate", "repeatedCursor"])(
  "returns 503 instead of an incomplete sitemap after %s",
  async (mode) => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (mode === "outage") return new Response("private exception", { status: 500 });
        if (mode === "malformed") return result({ items: [{ id: "not-a-uuid" }] });
        if (mode === "duplicate")
          return result({ items: [{ id: id(1) }], nextCursor: id(1) });
        return result({ items: [], nextCursor: id(1) });
      }),
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.text()).toBe("Sitemap temporarily unavailable.");
  },
);
it("honours cancellation during catalogue scanning", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const outcome = expect(sitemapPaths()).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(15001);
    await outcome;
  } finally {
    vi.useRealTimers();
  }
});
