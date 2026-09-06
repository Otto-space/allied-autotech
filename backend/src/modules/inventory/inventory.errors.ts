import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function inventoryNotFound(): AppError {
  return new AppError({
    code: errorCodes.notFound,
    message: "Inventory resource was not found",
    statusCode: 404,
  });
}
export function inventoryConflict(
  message = "The inventory changed; refresh and retry",
): AppError {
  return new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
}
export function insufficientStock(): AppError {
  return new AppError({
    code: errorCodes.insufficientStock,
    message: "Insufficient available inventory",
    statusCode: 409,
  });
}
export function idempotencyConflict(): AppError {
  return new AppError({
    code: errorCodes.idempotencyConflict,
    message: "Idempotency key was already used for a different request",
    statusCode: 409,
  });
}
