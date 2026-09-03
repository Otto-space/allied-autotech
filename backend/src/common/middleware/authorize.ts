import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "../../generated/prisma/enums.js";
import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

function deny(): AppError {
  return new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
}

export function requireRoles(...allowedRoles: readonly UserRole[]) {
  const allowed = new Set<UserRole>(allowedRoles);

  return (request: Request, _response: Response, next: NextFunction): void => {
    const actor = request.actor;
    if (actor === undefined || !allowed.has(actor.role)) {
      next(deny());
      return;
    }

    if (actor.role !== "CUSTOMER" && actor.mfaVerifiedAt === null) {
      next(
        new AppError({
          code: errorCodes.mfaRequired,
          message: "Multi-factor authentication is required",
          statusCode: 403,
        }),
      );
      return;
    }

    next();
  };
}

export const requireCustomer = requireRoles("CUSTOMER");
export const requireStaff = requireRoles("STAFF", "ADMIN", "SUPER_ADMIN");
export const requireAdministrator = requireRoles("ADMIN", "SUPER_ADMIN");
export const requireSuperAdministrator = requireRoles("SUPER_ADMIN");
