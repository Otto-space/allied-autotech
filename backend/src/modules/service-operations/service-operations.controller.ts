import type { Request, Response } from "express";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  AdminServiceListQuery,
  BookingAssignmentInput,
  BookingCancelInput,
  BookingCreateInput,
  BookingRescheduleInput,
  BookingTransitionInput,
  CustomerBookingListQuery,
  PublicServiceListQuery,
  QuoteCreateInput,
  QuoteReplaceInput,
  QuoteTransitionInput,
  ServiceCreateInput,
  ServiceUpdateInput,
  StaffBookingListQuery,
  WorkOrderCreateInput,
  WorkOrderTransitionInput,
  WorkOrderUpdateInput,
} from "./service-operations.schemas.js";
import {
  serviceOperationsService,
  type ServiceOperationsService,
} from "./service-operations.service.js";

function validated<T>(response: Response, location: "body" | "params" | "query"): T {
  return response.locals.validated?.[location] as T;
}
function actor(request: Request): AuthenticatedActor {
  if (request.actor === undefined)
    throw new AppError({
      code: errorCodes.unauthorized,
      message: "Authentication is required",
      statusCode: 401,
    });
  return request.actor;
}
function context(request: Request): RequestSecurityContext {
  return {
    requestId: String(request.id),
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
const ids = (response: Response) =>
  validated<{ bookingId: string; quoteId?: string; workOrderId?: string }>(
    response,
    "params",
  );

export class ServiceOperationsController {
  constructor(
    private readonly service: ServiceOperationsService = serviceOperationsService,
  ) {}

  publicServices = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Services retrieved",
          req.id,
          await this.service.publicServices(
            validated<PublicServiceListQuery>(res, "query"),
          ),
        ),
      );
  publicService = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Service retrieved",
          req.id,
          await this.service.publicService(
            validated<{ serviceId: string }>(res, "params").serviceId,
          ),
        ),
      );
  adminServices = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Services retrieved",
          req.id,
          await this.service.adminServices(
            actor(req),
            validated<AdminServiceListQuery>(res, "query"),
          ),
        ),
      );
  createService = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Service created",
          req.id,
          await this.service.createService(
            actor(req),
            validated<ServiceCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  updateService = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Service updated",
          req.id,
          await this.service.updateService(
            actor(req),
            validated<{ serviceId: string }>(res, "params").serviceId,
            validated<ServiceUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );

  customerBookings = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Bookings retrieved",
          req.id,
          await this.service.customerBookings(
            actor(req),
            validated<CustomerBookingListQuery>(res, "query"),
          ),
        ),
      );
  customerBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking retrieved",
          req.id,
          await this.service.customerBooking(actor(req), ids(res).bookingId),
        ),
      );
  createBooking = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Booking requested",
          req.id,
          await this.service.createBooking(
            actor(req),
            validated<BookingCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  rescheduleBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking rescheduled",
          req.id,
          await this.service.rescheduleBooking(
            actor(req),
            ids(res).bookingId,
            validated<BookingRescheduleInput>(res, "body"),
            context(req),
          ),
        ),
      );
  cancelBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking cancelled",
          req.id,
          await this.service.cancelBooking(
            actor(req),
            ids(res).bookingId,
            validated<BookingCancelInput>(res, "body"),
            context(req),
          ),
        ),
      );
  acceptQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Quote accepted",
          req.id,
          await this.service.acceptQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  rejectQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Quote rejected",
          req.id,
          await this.service.rejectQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );

  staffBookings = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Bookings retrieved",
          req.id,
          await this.service.staffBookings(
            actor(req),
            validated<StaffBookingListQuery>(res, "query"),
          ),
        ),
      );
  staffBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking retrieved",
          req.id,
          await this.service.staffBooking(actor(req), ids(res).bookingId, context(req)),
        ),
      );
  assignBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking assigned",
          req.id,
          await this.service.assignBooking(
            actor(req),
            ids(res).bookingId,
            validated<BookingAssignmentInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionBooking = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Booking status updated",
          req.id,
          await this.service.transitionBooking(
            actor(req),
            ids(res).bookingId,
            validated<BookingTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createQuote = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Quote draft created",
          req.id,
          await this.service.createQuote(
            actor(req),
            ids(res).bookingId,
            validated<QuoteCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  replaceQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "New quote version created",
          req.id,
          await this.service.replaceQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteReplaceInput>(res, "body"),
            context(req),
          ),
        ),
      );
  issueQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Quote issued",
          req.id,
          await this.service.issueQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  voidQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Quote voided",
          req.id,
          await this.service.voidQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  expireQuote = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Quote expired",
          req.id,
          await this.service.expireQuote(
            actor(req),
            ids(res).bookingId,
            ids(res).quoteId!,
            validated<QuoteTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createWorkOrder = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Work order created",
          req.id,
          await this.service.createWorkOrder(
            actor(req),
            ids(res).bookingId,
            validated<WorkOrderCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  updateWorkOrder = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Work order updated",
          req.id,
          await this.service.updateWorkOrder(
            actor(req),
            ids(res).bookingId,
            ids(res).workOrderId!,
            validated<WorkOrderUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionWorkOrder = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Work order status updated",
          req.id,
          await this.service.transitionWorkOrder(
            actor(req),
            ids(res).bookingId,
            ids(res).workOrderId!,
            validated<WorkOrderTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
