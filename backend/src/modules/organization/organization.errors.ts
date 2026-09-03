import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function organizationResourceNotFound(): AppError {
  return new AppError({
    code: errorCodes.notFound,
    message: "Organization resource was not found",
    statusCode: 404,
  });
}

export function organizationConflict(
  message = "The requested change conflicts with current state",
): AppError {
  return new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
}

export function invalidInvitation(): AppError {
  return new AppError({
    code: errorCodes.tokenInvalid,
    message: "Invitation is invalid or expired",
    statusCode: 400,
  });
}
