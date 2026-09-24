import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../../config/env.js";
import { PostgresRateLimitStore } from "./postgres-rate-limit-store.js";

import { errorCodes } from "../errors/error-codes.js";

export function createGlobalRateLimit(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    ...(env.NODE_ENV === "production"
      ? { store: new PostgresRateLimitStore("global") }
      : {}),
    skip: (req) =>
      [
        "/api/v1/health",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/webhooks/paystack",
        "/api/v1/webhooks/monnify",
      ].includes(req.path.replace(/\/$/, "")),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, res): void {
      res.status(429).json({
        success: false,
        message: "Too many requests",
        error: { code: errorCodes.rateLimited },
        meta: { requestId: res.locals.requestId },
      });
    },
  });
}

export function createSensitiveRateLimit(limit: number, windowMs = 15 * 60 * 1_000) {
  return rateLimit({
    windowMs,
    limit,
    ...(env.NODE_ENV === "production"
      ? { store: new PostgresRateLimitStore(`sensitive:${limit}:${windowMs}`) }
      : {}),
    keyGenerator: (req) =>
      `${req.method}:${req.baseUrl}:${String(req.route?.path ?? "")}:${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown")}`,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler(_req, res): void {
      res.status(429).json({
        success: false,
        message: "Too many requests",
        error: { code: errorCodes.rateLimited },
        meta: { requestId: res.locals.requestId },
      });
    },
  });
}
