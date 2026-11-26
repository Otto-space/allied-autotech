import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

export type PublicLaunchMode = "full" | "browse_enquiries" | "catalogue";
export interface PublicTransactionControls {
  bookingRequestsEnabled: boolean;
  productPurchasesEnabled: boolean;
  bookingDepositTestEnabled?: boolean;
}
const transactionPath =
  /^\/customers\/(?:parts-quotes|cart|orders|bookings|payments|vehicle-transactions|vehicle-inspections)(?:\/|$)/i;

// Temporary, exact-target staging acceptance for the owner-approved QA booking.
// No other booking or customer write inherits this exception.
const stagingQaBookingId = "cc831cc8-6c9b-4066-bfda-213c19533d5e";

/** Mounted at /api/v1 before domain routers. Staff/admin authentication is unchanged. */
export function publicLaunch(
  mode: PublicLaunchMode,
  controls: PublicTransactionControls = {
    bookingRequestsEnabled: false,
    productPurchasesEnabled: false,
  },
): RequestHandler {
  return (request, _response, next) => {
    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (
      mode === "catalogue" &&
      (/^\/(?:customers|purchase)(?:\/|$)/i.test(request.path) ||
        /^\/auth\/register(?:\/|$)/i.test(request.path) ||
        (isWrite &&
          /^\/(?:public|webhooks)(?:\/|$)/i.test(request.path) &&
          request.path !== "/webhooks/resend"))
    ) {
      next(
        new AppError({
          code: errorCodes.forbidden,
          statusCode: 403,
          message:
            "Online customer accounts, forms and transactions are not available yet. Contact Allied AutoTech by phone, email or WhatsApp.",
        }),
      );
      return;
    }
    if (
      mode === "browse_enquiries" &&
      isWrite &&
      (transactionPath.test(request.path) ||
        /^\/purchase\/(?:orders|payments|parts-quotes)(?:\/|$)/i.test(request.path) ||
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
    if (mode === "full" && isWrite) {
      // The reviewed staging QA deposit flow is independent of parts checkout.
      // Only these exact customer payment operations receive this exception;
      // payment-service authorization and provider guards still apply.
      const stagingDepositWrite =
        controls.bookingDepositTestEnabled === true &&
        request.method === "POST" &&
        (/^\/customers\/payments\/booking-deposits\/[0-9a-f-]{36}\/?$/i.test(
          request.path,
        ) ||
          /^\/customers\/payments\/[0-9a-f-]{36}\/(?:paystack|attempts\/[0-9a-f-]{36}\/verify)\/?$/i.test(
            request.path,
          ));
      const stagingQaQuoteDecision =
        controls.bookingDepositTestEnabled === true &&
        request.method === "POST" &&
        new RegExp(
          `^/customers/bookings/${stagingQaBookingId}/quotes/[0-9a-f-]{36}/(?:accept|reject)/?$`,
          "i",
        ).test(request.path);
      const bookingWrite =
        /^\/customers\/(?:bookings|vehicle-inspections)(?:\/|$)/i.test(request.path) ||
        /^\/public\/booking-response(?:\/|$)/i.test(request.path);
      const purchasingWrite =
        /^\/customers\/(?:parts-quotes|cart|orders|payments|vehicle-transactions)(?:\/|$)/i.test(
          request.path,
        ) || /^\/purchase\/(?:orders|payments|parts-quotes)(?:\/|$)/i.test(request.path);
      if (
        (bookingWrite && !controls.bookingRequestsEnabled && !stagingQaQuoteDecision) ||
        (purchasingWrite && !controls.productPurchasesEnabled && !stagingDepositWrite)
      ) {
        next(
          new AppError({
            code: errorCodes.forbidden,
            statusCode: 403,
            message: bookingWrite
              ? "Online appointment requests are unavailable. Contact the team about a visit."
              : "Online purchasing is unavailable. Contact the team about an enquiry.",
          }),
        );
        return;
      }
    }
    next();
  };
}
