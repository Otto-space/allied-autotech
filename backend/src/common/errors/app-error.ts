import type { ErrorCode } from "./error-codes.js";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode: number;
  cause?: unknown;
  details?: Readonly<Record<string, readonly string[]>>;
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Readonly<Record<string, readonly string[]>>;
  readonly retryable: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;

    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}
