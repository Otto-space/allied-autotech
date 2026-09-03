import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse, type ApiResponse } from "../../common/http/api-response.js";

export type ReadinessCheck = () => Promise<void>;

export function getLiveness(_req: Request, res: Response<ApiResponse>): void {
  res
    .status(200)
    .json(successResponse("Allied AutoTech API is alive", res.locals.requestId));
}

export function createReadinessHandler(checkReadiness: ReadinessCheck) {
  return async (
    _req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await checkReadiness();
      res
        .status(200)
        .json(successResponse("Allied AutoTech API is healthy", res.locals.requestId));
    } catch (error) {
      next(
        new AppError({
          code: errorCodes.databaseUnavailable,
          message: "Service temporarily unavailable",
          statusCode: 503,
          cause: error,
          retryable: true,
        }),
      );
    }
  };
}
