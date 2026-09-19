import { test, expect } from "@playwright/test";
test.skip(
  process.env.RUN_SEO_DISABLED_TESTS !== "true",
  "Requires standalone with no SITE_ORIGIN and SITE_INDEXING=enabled",
);
test("missing approved origin keeps every public entry route out of indexing", async ({
  request,
}) => {
  for (const route of [
    "/",
    "/services",
    "/parts",
    "/vehicles",
    "/contact",
    "/help",
    "/reviews",
  ]) {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    const html = await response.text();
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('property="og:url"');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  }
});
test("unconfigured deployment blocks crawling and does not publish a sitemap", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect((await robots.text()).trim()).toBe("User-Agent: *\nDisallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(404);
  expect(sitemap.headers()["cache-control"]).toContain("no-store");
  expect(await sitemap.text()).toBe("");
});
