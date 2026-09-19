import { indexingEnabled, siteOrigin } from "@/lib/seo";
import { sitemapPaths, sitemapXml } from "@/lib/api/sitemap-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  const origin = siteOrigin();
  if (!indexingEnabled() || !origin) return new Response(null, { status: 404, headers });
  try {
    return new Response(sitemapXml(origin, await sitemapPaths()), {
      headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable.", {
      status: 503,
      headers: {
        ...headers,
        "Retry-After": "60",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
