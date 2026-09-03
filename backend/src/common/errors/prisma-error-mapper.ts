import { AppError } from "./app-error.js";
import { errorCodes } from "./error-codes.js";

interface ErrorWithCode {
  code?: unknown;
}

export function mapPrismaError(error: unknown): AppError | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const code = (error as ErrorWithCode).code;

  if (code === "P2002") {
    return new AppError({
      code: errorCodes.conflict,
      message: "The requested change conflicts with an existing resource",
      statusCode: 409,
      cause: error,
    });
  }

  if (code === "P2025") {
    return new AppError({
      code: errorCodes.notFound,
      message: "Resource not found",
      statusCode: 404,
      cause: error,
    });
  }

  if (code === "P1000" || code === "P1001" || code === "P1002") {
    return new AppError({
      code: errorCodes.databaseUnavailable,
      message: "Service temporarily unavailable",
      statusCode: 503,
      cause: error,
      retryable: true,
    });
  }

  return undefined;
}
