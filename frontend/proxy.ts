import { browseEnquiriesOnly, restrictedLaunchPage } from "./lib/public-launch";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { publicMediaHosts } from "./lib/media";
import { assetStorageHosts } from "./lib/assets";
import { indexingEnabled, privatePage } from "./lib/seo";
import {
  privateTestingAllowed,
  privateTestingAuthorization,
  createPrivateTestingCookie,
  privateTestingCookieAllowed,
  privateTestingCookieName,
  privateTestingCookieSeconds,
} from "./lib/private-testing";

function contentSecurityPolicy(nonce: string, allowWorkshopMap: boolean): string {
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
    // Only the configured Contact embed needs an external frame destination.
    `frame-src 'self'${allowWorkshopMap ? " https://www.google.com/maps/embed/" : ""}`,
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  let authorization: string | undefined;
  try {
    authorization = privateTestingAuthorization();
  } catch {
    return new NextResponse("Private testing is temporarily unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  // Next's internal image optimizer intentionally omits request credentials.
  // Only checked-in public brand artwork may bypass the outer gate; all uploaded
  // business/customer media lives behind /api/v1 and remains protected.
  const publicBrandImage =
    ["GET", "HEAD"].includes(request.method) &&
    /^\/images\/allied-autotech\/[a-z0-9-]+\.(?:webp|png|jpe?g|svg|avif)$/.test(
      request.nextUrl.pathname,
    );
  const basicAllowed = Boolean(
    authorization &&
    privateTestingAllowed(request.headers.get("authorization"), authorization),
  );
  const cookieAllowed = Boolean(
    authorization &&
    privateTestingCookieAllowed(
      request.cookies.get(privateTestingCookieName)?.value,
      request.nextUrl.host,
      authorization,
    ),
  );
  if (authorization && !publicBrandImage && !basicAllowed && !cookieAllowed) {
    return new NextResponse("Private testing access is required.", {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="Allied AutoTech private testing", charset="UTF-8"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  function rememberAccess(response: NextResponse) {
    if (authorization && basicAllowed && !cookieAllowed && !publicBrandImage) {
      response.cookies.set(
        privateTestingCookieName,
        createPrivateTestingCookie(request.nextUrl.host, authorization),
        {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: privateTestingCookieSeconds,
        },
      );
    }
    return response;
  }
  if (browseEnquiriesOnly() && restrictedLaunchPage(request.nextUrl.pathname)) {
    const response = NextResponse.redirect(new URL("/contact#enquiry", request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return rememberAccess(response);
  }
  // Gate API rewrites, prefetches and assets too, but keep the established CSP
  // handling limited to page responses. Authorization passes through the rewrite.
  if (
    /^\/(?:api(?:\/|$)|_next\/|favicon\.ico$|robots\.txt$|sitemap\.xml$)/.test(
      request.nextUrl.pathname,
    ) ||
    /\.(?:svg|png|jpg|jpeg|webp|avif)$/.test(request.nextUrl.pathname) ||
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    // Only the fixed backend rewrite needs the upstream Basic credential when
    // the browser presents its signed proof. These are internal REQUEST headers,
    // never response headers or client-side configuration.
    let forwardedHeaders: Headers | undefined;
    if (
      authorization &&
      cookieAllowed &&
      !basicAllowed &&
      /^\/api\/v1(?:\/|$)/.test(request.nextUrl.pathname)
    ) {
      forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.set("authorization", authorization);
    }
    const response = NextResponse.next(
      forwardedHeaders ? { request: { headers: forwardedHeaders } } : undefined,
    );
    if (authorization) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return rememberAccess(response);
  }
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(
    nonce,
    request.nextUrl.pathname === "/contact" &&
      Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (authorization || privatePage(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (authorization || !indexingEnabled())
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  else if (!privatePage(request.nextUrl.pathname) && request.nextUrl.search)
    response.headers.set("X-Robots-Tag", "noindex, follow");
  return rememberAccess(response);
}

export const config = {
  matcher: ["/:path*"],
};
