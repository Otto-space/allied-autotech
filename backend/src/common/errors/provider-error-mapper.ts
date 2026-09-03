import { AppError } from "./app-error.js";
import { errorCodes } from "./error-codes.js";

export function providerUnavailable(cause?: unknown): AppError {
  return new AppError({
    code: errorCodes.providerUnavailable,
    message: "An external service is temporarily unavailable",
    statusCode: 503,
    cause,
    retryable: true,
  });
}
