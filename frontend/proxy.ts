import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { publicMediaHosts } from "./lib/media";
import { assetStorageHosts } from "./lib/assets";
import { indexingEnabled, privatePage } from "./lib/seo";

function contentSecurityPolicy(nonce: string): string {
  const development = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS)
      .map((host) => `https://${host}`)
      .join(" ")}`,
    "font-src 'self' data:",
    `connect-src 'self' ${assetStorageHosts(process.env.ASSET_STORAGE_HOSTS)
      .map((host) => `https://${host}`)
      .join(" ")}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (privatePage(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (!indexingEnabled()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  else if (!privatePage(request.nextUrl.pathname) && request.nextUrl.search)
    response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
