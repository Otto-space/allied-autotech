import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/** An extra perimeter for staging; never substitutes for session, MFA or CSRF checks. */
export function privateTesting(enabled: boolean, password?: string): RequestHandler {
  if (enabled && !/^[a-f0-9]{64}$/.test(password ?? ""))
    throw new Error("Private testing requires a generated 32-byte hexadecimal password.");
  const expected = Buffer.from(`allied-test:${password ?? ""}`).toString("base64");
  return (request, response, next) => {
    if (!enabled) return next();
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    // Exact provider endpoints still enforce their own signatures. Health probes
    // contain no business data and must work without browser credentials.
    if (
      (["GET", "HEAD"].includes(request.method) &&
        ["/api/v1/health/live", "/api/v1/health/ready"].includes(request.path)) ||
      (request.method === "POST" &&
        ["/api/v1/webhooks/paystack", "/api/v1/webhooks/monnify"].includes(request.path))
    )
      return next();
    const match = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(request.headers.authorization ?? "");
    const provided = Buffer.from(match?.[1] ?? "");
    const target = Buffer.from(expected);
    if (provided.length === target.length && timingSafeEqual(provided, target))
      return next();
    response.setHeader(
      "WWW-Authenticate",
      'Basic realm="Allied AutoTech private testing", charset="UTF-8"',
    );
    response
      .status(401)
      .json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Private testing access is required." },
      });
  };
}
