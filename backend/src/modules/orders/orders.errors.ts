import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

const error = (
  code: (typeof errorCodes)[keyof typeof errorCodes],
  message: string,
  statusCode: number,
) => new AppError({ code, message, statusCode });
export const orderNotFound = () => error(errorCodes.notFound, "Resource not found", 404);
export const orderForbidden = () =>
  error(errorCodes.forbidden, "You do not have permission to perform this action", 403);
export const orderConflict = (message = "The order cannot be changed") =>
  error(errorCodes.conflict, message, 409);
export const orderStale = () =>
  error(errorCodes.staleVersion, "The resource changed; reload and retry", 409);
export const invalidOrderTransition = () =>
  error(
    errorCodes.invalidTransition,
    "The requested status transition is not allowed",
    409,
  );
export const checkoutIdempotencyConflict = () =>
  error(
    errorCodes.idempotencyConflict,
    "The idempotency key was already used for a different request",
    409,
  );
export const checkoutStockUnavailable = () =>
  error(
    errorCodes.insufficientStock,
    "One or more products are unavailable at the selected branch",
    409,
  );
