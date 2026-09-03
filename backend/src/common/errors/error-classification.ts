import { AppError } from "./app-error.js";

export interface ErrorClassification {
  expected: boolean;
  retryable: boolean;
  severity: "info" | "warn" | "error";
}

export function classifyError(error: unknown): ErrorClassification {
  if (error instanceof AppError) {
    return {
      expected: true,
      retryable: error.retryable,
      severity: error.statusCode >= 500 ? "error" : "warn",
    };
  }

  return { expected: false, retryable: false, severity: "error" };
}
