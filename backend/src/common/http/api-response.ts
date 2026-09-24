import type { ErrorCode } from "../errors/error-codes.js";

export interface ApiErrorBody {
  code: ErrorCode;
  fields?: Readonly<Record<string, readonly string[]>>;
}

export interface ApiMeta {
  requestId: string;
  nextCursor?: string;
  serverTime?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: ApiErrorBody;
  meta?: ApiMeta;
}

export function successResponse<T>(
  message: string,
  requestId: unknown,
  data?: T,
): ApiResponse<T> {
  return {
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
    meta: { requestId: String(requestId), serverTime: new Date().toISOString() },
  };
}
