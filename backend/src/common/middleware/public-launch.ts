import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

export type PublicLaunchMode = "full" | "browse_enquiries";
const transactionPath =
  /^\/customers\/(?:cart|orders|bookings|payments|vehicle-transactions|vehicle-inspections)(?:\/|$)/i;

/** Mounted at /api/v1 before domain routers. Staff/admin authentication is unchanged. */
export function publicLaunch(mode: PublicLaunchMode): RequestHandler {
  return (request, _response, next) => {
    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (
      mode === "browse_enquiries" &&
      isWrite &&
      (transactionPath.test(request.path) ||
        /^\/public\/booking-response(?:\/|$)/i.test(request.path))
    ) {
      next(
        new AppError({
          code: errorCodes.forbidden,
          statusCode: 403,
          message:
            "Online transactions are not available yet. Contact Allied AutoTech to send an enquiry.",
        }),
      );
      return;
    }
    next();
  };
}
