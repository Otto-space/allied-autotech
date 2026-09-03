import { AppError } from "./app-error.js";
import { errorCodes } from "./error-codes.js";
import { mapPrismaError } from "./prisma-error-mapper.js";

interface BodyParserSyntaxError extends SyntaxError {
  status?: unknown;
}

interface BodyParserError {
  type?: unknown;
}

export function toPublicError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof SyntaxError && (error as BodyParserSyntaxError).status === 400) {
    return new AppError({
      code: errorCodes.malformedJson,
      message: "Invalid JSON request body",
      statusCode: 400,
      cause: error,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    (error as BodyParserError).type === "entity.too.large"
  ) {
    return new AppError({
      code: errorCodes.payloadTooLarge,
      message: "Request body is too large",
      statusCode: 413,
      cause: error,
    });
  }

  return (
    mapPrismaError(error) ??
    new AppError({
      code: errorCodes.internalError,
      message: "Internal server error",
      statusCode: 500,
      cause: error,
    })
  );
}
