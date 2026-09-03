import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";
import { errorCodes, type ErrorCode } from "../errors/error-codes.js";
import { clearSessionCookie, sessionCookieName } from "../security/cookies.js";
import { hashToken } from "../security/session-tokens.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";

interface AuthenticateOptions {
  allowMfaPending?: boolean;
}

function unauthorized(
  response: Response,
  code: ErrorCode = errorCodes.unauthorized,
): AppError {
  clearSessionCookie(response);
  return new AppError({ code, message: "Authentication is required", statusCode: 401 });
}

export function authenticate(options: AuthenticateOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.[sessionCookieName] as unknown;
      if (typeof rawToken !== "string" || rawToken.length < 32 || rawToken.length > 256) {
        next(unauthorized(res));
        return;
      }

      const now = new Date();
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken("session", rawToken) },
        select: {
          id: true,
          csrfTokenHash: true,
          expiresAt: true,
          idleExpiresAt: true,
          revokedAt: true,
          mfaRequired: true,
          mfaVerifiedAt: true,
          user: {
            select: { id: true, email: true, role: true, status: true },
          },
        },
      });

      if (
        session?.revokedAt !== null ||
        session.expiresAt <= now ||
        session.idleExpiresAt <= now ||
        session.user.status !== "ACTIVE"
      ) {
        next(unauthorized(res, errorCodes.sessionExpired));
        return;
      }

      if (
        session.mfaRequired &&
        session.mfaVerifiedAt === null &&
        options.allowMfaPending !== true
      ) {
        next(
          new AppError({
            code: errorCodes.mfaRequired,
            message: "Multi-factor authentication is required",
            statusCode: 403,
          }),
        );
        return;
      }

      const idleSeconds =
        session.user.role === "CUSTOMER"
          ? env.CUSTOMER_SESSION_IDLE_SECONDS
          : env.PRIVILEGED_SESSION_IDLE_SECONDS;
      const nextIdleExpiry = new Date(
        Math.min(session.expiresAt.getTime(), now.getTime() + idleSeconds * 1_000),
      );

      const touched = await prisma.session.updateMany({
        where: { id: session.id, revokedAt: null, idleExpiresAt: { gt: now } },
        data: { lastUsedAt: now, idleExpiresAt: nextIdleExpiry },
      });
      if (touched.count !== 1) {
        next(unauthorized(res, errorCodes.sessionExpired));
        return;
      }

      req.actor = {
        userId: session.user.id,
        sessionId: session.id,
        role: session.user.role,
        email: session.user.email,
        mfaRequired: session.mfaRequired,
        mfaVerifiedAt: session.mfaVerifiedAt,
      };
      req.authSession = {
        id: session.id,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: session.expiresAt,
        idleExpiresAt: nextIdleExpiry,
      };
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
