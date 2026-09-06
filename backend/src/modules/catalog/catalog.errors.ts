import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function catalogResourceNotFound(): AppError {
  return new AppError({
    code: errorCodes.notFound,
    message: "Catalogue resource was not found",
    statusCode: 404,
  });
}

export function catalogConflict(
  message = "The requested catalogue change conflicts with current state",
): AppError {
  return new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
}
