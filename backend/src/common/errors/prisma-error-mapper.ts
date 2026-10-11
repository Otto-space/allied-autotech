import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "./app-error.js";
import { errorCodes } from "./error-codes.js";

interface ErrorWithCode {
  code?: unknown;
}

const connectionCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"]);

function isDriverConnectionFailure(error: unknown): boolean {
  // Driver adapters can preserve socket codes instead of a P1xxx code. Restrict
  // these generic codes to Prisma errors so provider outages are not mislabeled.
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (connectionCodes.has(error.code)) return true;
  if (error.code !== "P2010") return false;
  const rawCode = error.meta?.["code"];
  if (typeof rawCode === "string" && connectionCodes.has(rawCode)) return true;
  // Prisma 7 raw-query errors wrap the adapter's structured cause. Do not infer
  // outages from SQL error text or turn arbitrary P2010 errors into retries.
  const adapter = error.meta?.["driverAdapterError"];
  if (typeof adapter !== "object" || adapter === null || !("cause" in adapter))
    return false;
  const cause = adapter.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "kind" in cause &&
    typeof cause.kind === "string" &&
    ["DatabaseNotReachable", "ConnectionClosed", "SocketTimeout"].includes(cause.kind)
  );
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

  if (
    code === "P1000" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    code === "P2024" ||
    isDriverConnectionFailure(error)
  ) {
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
