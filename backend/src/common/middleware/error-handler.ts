import type { ErrorRequestHandler } from "express";

import { classifyError } from "../errors/error-classification.js";
import { toPublicError } from "../errors/http-error-mapper.js";
import type { ApiResponse } from "../http/api-response.js";
import { logger } from "../observability/logger.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
): void => {
  const publicError = toPublicError(error);
  const classification = classifyError(publicError);
  const requestId = res.locals.requestId;

  logger[classification.severity](
    {
      err: error,
      requestId,
      errorCode: publicError.code,
      retryable: classification.retryable,
    },
    classification.expected ? "Request rejected" : "Unhandled request error",
  );

  const response: ApiResponse = {
    success: false,
    message: publicError.message,
    error: {
      code: publicError.code,
      ...(publicError.details === undefined ? {} : { fields: publicError.details }),
    },
    meta: { requestId },
  };

  res.status(publicError.statusCode).json(response);
};
