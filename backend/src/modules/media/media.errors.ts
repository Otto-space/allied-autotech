import { AppError } from "../../common/errors/app-error.js";
import type { ErrorCode } from "../../common/errors/error-codes.js";

export function mediaError(code: ErrorCode, statusCode = 422) {
  return new AppError({
    code,
    statusCode,
    message:
      code === "MEDIA_STORAGE_UNAVAILABLE"
        ? "Image storage is temporarily unavailable"
        : "The image request could not be completed",
  });
}
