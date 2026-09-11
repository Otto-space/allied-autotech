import { AppError } from "../errors/app-error.js";

const safeToken = /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/u;

function token(value: unknown): string | undefined {
  return typeof value === "string" && safeToken.test(value) ? value : undefined;
}

/** Returns allowlisted error metadata without messages, stacks, request data, or secrets. */
export function safeErrorAttributes(error: unknown): {
  errorName: string;
  errorCode?: string;
  retryable?: boolean;
} {
  if (error instanceof AppError) {
    return {
      errorName: "AppError",
      errorCode: error.code,
      retryable: error.retryable,
    };
  }

  if (typeof error !== "object" || error === null) return { errorName: "UnknownError" };
  const record = error as { name?: unknown; code?: unknown };
  const errorCode = token(record.code);
  return {
    errorName: token(record.name) ?? "Error",
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}
