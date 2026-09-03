import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";
import { verifyCsrfToken } from "../security/csrf-tokens.js";

const allowedOrigins = new Set(env.FRONTEND_URL.map((value) => new URL(value).origin));

function isTrustedRequest(req: Request): boolean {
  const origin = req.get("origin");
  const fetchSite = req.get("sec-fetch-site");
  if (origin === undefined || (fetchSite !== undefined && fetchSite !== "same-origin")) {
    return false;
  }

  try {
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function requireTrustedOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isTrustedRequest(req)) {
    next(
      new AppError({
        code: errorCodes.csrfInvalid,
        message: "Request origin validation failed",
        statusCode: 403,
      }),
    );
    return;
  }

  next();
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const rawToken = req.get("x-csrf-token");
  const expectedHash = req.authSession?.csrfTokenHash;

  const validToken =
    rawToken !== undefined &&
    rawToken.length >= 32 &&
    rawToken.length <= 256 &&
    expectedHash !== null &&
    expectedHash !== undefined &&
    verifyCsrfToken(rawToken, expectedHash);

  if (!isTrustedRequest(req) || !validToken) {
    next(
      new AppError({
        code: errorCodes.csrfInvalid,
        message: "CSRF validation failed",
        statusCode: 403,
      }),
    );
    return;
  }

  next();
}
