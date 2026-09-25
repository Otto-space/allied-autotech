import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

const error = (
  code: (typeof errorCodes)[keyof typeof errorCodes],
  message: string,
  statusCode: number,
) => new AppError({ code, message, statusCode });
export const paymentNotFound = () =>
  error(errorCodes.notFound, "Resource not found", 404);
export const paymentForbidden = () =>
  error(errorCodes.forbidden, "You do not have permission to perform this action", 403);
export const paymentConflict = (message = "The payment cannot be changed") =>
  error(errorCodes.conflict, message, 409);
export const paymentAttemptPending = () =>
  error(
    errorCodes.paymentAttemptPending,
    "This payment already has an attempt awaiting confirmation or review. Check its status before making another payment.",
    409,
  );
export const paymentTargetPending = () =>
  error(
    errorCodes.paymentTargetPending,
    "A payment already exists for this purchase or invoice. Open Payments and check the existing request before paying again.",
    409,
  );
export const paymentIdempotencyConflict = () =>
  error(
    errorCodes.idempotencyConflict,
    "The idempotency key was already used for a different request",
    409,
  );
export const paymentVerificationFailed = () =>
  error(errorCodes.conflict, "Payment could not be verified", 409);
export const webhookUnauthorized = () =>
  error(errorCodes.unauthorized, "Webhook signature is invalid", 401);
