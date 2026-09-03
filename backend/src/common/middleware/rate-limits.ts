import rateLimit from "express-rate-limit";

import { errorCodes } from "../errors/error-codes.js";

export function createGlobalRateLimit(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
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
