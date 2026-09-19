import type { MetadataRoute } from "next";
import { indexingEnabled, privatePaths, siteOrigin } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...privatePaths] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
