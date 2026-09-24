import { Router, urlencoded, type ErrorRequestHandler } from "express";
import { z } from "zod";
import { readBookingActionToken } from "../../common/security/booking-action-token.js";
import { requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { serviceOperationsService } from "./service-operations.service.js";
import { serviceOperationConflict } from "./service-operations.errors.js";
import { validate } from "../../common/middleware/validate.js";
import { toPublicError } from "../../common/errors/http-error-mapper.js";
import { logger } from "../../common/observability/logger.js";
import {
  bookingActionPage,
  bookingActionSuccess,
  bookingActionError,
  bookingPageHeaders,
} from "./booking-action-page.js";

export const bookingActionQuery = z
  .object({ token: z.string().min(1).max(1500) })
  .strict();
export const bookingActionBody = bookingActionQuery.extend({
  action: z.enum(["CONFIRM", "CANCEL"]),
});

async function resolveToken(token: string) {
  let claim;
  try {
    claim = readBookingActionToken(token);
  } catch {
    throw serviceOperationConflict(
      "This booking action link is invalid or expired; sign in to manage your booking",
    );
  }
  const booking = await prisma.booking.findFirst({
    where: {
      id: claim.bookingId,
      scheduleVersion: claim.scheduleVersion,
      customer: {
        userId: claim.userId,
        user: { status: "ACTIVE", role: "CUSTOMER", emailVerifiedAt: { not: null } },
      },
    },
    select: {
      id: true,
      version: true,
      status: true,
      scheduledAt: true,
      attendanceConfirmedAt: true,
      customer: { select: { user: { select: { email: true } } } },
      service: { select: { name: true } },
      branch: { select: { name: true, address: true, city: true, state: true } },
    },
  });
  if (!booking)
    throw serviceOperationConflict(
      "This appointment has changed; use the latest reminder or sign in",
    );
  return { claim, booking };
}

export function createBookingActionsRouter() {
  const router = Router();
  router.use((_req, res, next) => {
    bookingPageHeaders(res);
    next();
  });
  router.get("/", validate({ query: bookingActionQuery }), async (_req, res) => {
    const { token } = res.locals.validated!["query"] as z.infer<
      typeof bookingActionQuery
    >;
    const { booking } = await resolveToken(token);
    // This page is deliberately read-only. Scanners following email GET links cannot act.
    res.type("html").send(bookingActionPage(booking, token));
  });
  router.post(
    "/",
    urlencoded({ extended: false, limit: "4kb" }),
    requireTrustedOrigin,
    validate({ body: bookingActionBody }),
    async (req, res) => {
      const input = res.locals.validated!["body"] as z.infer<typeof bookingActionBody>;
      const { claim, booking } = await resolveToken(input.token);
      const context = {
        requestId: String(req.id),
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      };
      if (input.action === "CANCEL") {
        await serviceOperationsService.cancelBooking(
          {
            userId: claim.userId,
            email: booking.customer.user.email,
            role: "CUSTOMER",
            sessionId: "purpose-bound-booking-action",
            mfaRequired: false,
            mfaVerifiedAt: null,
          },
          booking.id,
          {
            expectedVersion: booking.version,
            reason: "Customer cancellation from appointment reminder",
          },
          context,
        );
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id}::uuid FOR UPDATE`;
          const current = await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
          });
          if (
            current.scheduleVersion !== claim.scheduleVersion ||
            current.status !== "CONFIRMED"
          )
            throw serviceOperationConflict(
              "Only the current staff-confirmed appointment can confirm attendance",
            );
          if (!current.attendanceConfirmedAt) {
            await tx.booking.update({
              where: { id: booking.id },
              data: { attendanceConfirmedAt: new Date() },
            });
            await appendAuditEvent(tx, {
              actorUserId: claim.userId,
              action: "UPDATE",
              entityType: "BOOKING",
              entityId: booking.id,
              newValues: {
                attendanceConfirmed: true,
                scheduleVersion: claim.scheduleVersion,
              },
              context,
            });
          }
        });
      }
      res.type("html").send(bookingActionSuccess(booking, input.action));
    },
  );
  const pageError: ErrorRequestHandler = (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const publicError = toPublicError(error);
    // Neither tokens nor arbitrary exception details belong in logs or HTML.
    logger[publicError.statusCode >= 500 ? "error" : "warn"](
      { requestId: res.locals.requestId, errorCode: publicError.code },
      "Booking reminder request rejected",
    );
    res
      .status(publicError.statusCode)
      .type("html")
      .send(bookingActionError(publicError.statusCode, req.method === "POST"));
  };
  router.use(pageError);
  return router;
}
