import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function invalidAuthentication(): AppError {
  return new AppError({
    code: errorCodes.authenticationFailed,
    message: "Authentication failed",
    statusCode: 401,
  });
}

export function invalidToken(): AppError {
  return new AppError({
    code: errorCodes.tokenInvalid,
    message: "The token is invalid or expired",
    statusCode: 400,
  });
}

export function identityConflict(message: string): AppError {
  return new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
}
