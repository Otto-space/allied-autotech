import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

const names = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
  "AbortError",
  "TimeoutError",
  "AppError",
  "ZodError",
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
  "CredentialsProviderError",
  "AccessDenied",
  "NoSuchKey",
]);
const codes: ReadonlySet<string> = new Set([
  ...Object.values(errorCodes),
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EADDRINUSE",
  "EACCES",
  "EPERM",
  "ENOENT",
  "ENOSPC",
  "EMFILE",
  "ENFILE",
  "ERR_STREAM_PREMATURE_CLOSE",
  "ERR_STREAM_DESTROYED",
  "ERR_HTTP_HEADERS_SENT",
  "ABORT_ERR",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "HPE_HEADER_OVERFLOW",
  "HPE_INVALID_METHOD",
  "HPE_INVALID_URL",
  "HPE_INVALID_VERSION",
  "HPE_INVALID_HEADER_TOKEN",
  "HPE_INVALID_CONTENT_LENGTH",
  "HPE_UNEXPECTED_CONTENT_LENGTH",
  "HPE_INVALID_CHUNK_SIZE",
  "HPE_INVALID_EOF_STATE",
  "HPE_LF_EXPECTED",
  "HPE_CR_EXPECTED",
  "AccessDenied",
  "NoSuchKey",
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
]);
function code(value: unknown): string | undefined {
  return typeof value === "string" && (codes.has(value) || /^P\d{4}$/.test(value))
    ? value
    : undefined;
}

/** Returns allowlisted error metadata without messages, stacks, request data, or secrets. */
export function safeErrorAttributes(error: unknown): {
  errorName: string;
  errorCode?: string;
  retryable?: boolean;
  recoveryHint?: string;
} {
  if (typeof error !== "object" || error === null) return { errorName: "UnknownError" };
  try {
    const record = error as {
      name?: unknown;
      code?: unknown;
      errorName?: unknown;
      errorCode?: unknown;
      retryable?: unknown;
    };
    // Accept our own sanitized projection too: serializers can run on child loggers.
    const name =
      error instanceof AppError ? "AppError" : (record.name ?? record.errorName);
    const errorName = typeof name === "string" && names.has(name) ? name : "Error";
    const errorCode = code(record.code ?? record.errorCode);
    return {
      errorName,
      ...(errorCode === undefined ? {} : { errorCode }),
      ...(errorName === "AppError" && typeof record.retryable === "boolean"
        ? { retryable: record.retryable }
        : {}),
      ...(errorCode === "P2021" || errorCode === "P2022"
        ? {
            recoveryHint:
              "Database schema is out of date or the configured database is incorrect. Check the database target and apply pending migrations from backend with npm run db:migrate.",
          }
        : {}),
    };
  } catch {
    return { errorName: "UnknownError" };
  }
}
