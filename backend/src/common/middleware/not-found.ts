import type { Request, Response } from "express";

import { errorCodes } from "../errors/error-codes.js";
import type { ApiResponse } from "../http/api-response.js";

export function notFound(_req: Request, res: Response<ApiResponse>): void {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    error: { code: errorCodes.notFound },
    meta: { requestId: res.locals.requestId },
  });
}
