import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  CustomerInspectionListQuery,
  CustomerTransactionListQuery,
  ExpireReservationsInput,
  HandoverCreateInput,
  HandoverTransitionInput,
  InspectionCreateInput,
  InspectionTransitionInput,
  NegotiationInput,
  ReservationInput,
  StaffInspectionListQuery,
  StaffTransactionListQuery,
  TransactionCreateInput,
  TransactionTransitionInput,
} from "./vehicle-sales.schemas.js";
import {
  vehicleSalesService,
  type VehicleSalesService,
} from "./vehicle-sales.service.js";
const validated = <T>(res: Response, location: "body" | "headers" | "params" | "query") =>
  res.locals.validated?.[location] as T;
const actor = (req: Request) => req.actor as AuthenticatedActor;
const context = (req: Request): RequestSecurityContext => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const ids = (res: Response) =>
  validated<{ inspectionId?: string; transactionId?: string; handoverId?: string }>(
    res,
    "params",
  );
export class VehicleSalesController {
  constructor(private readonly service: VehicleSalesService = vehicleSalesService) {}
  customerInspections = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Inspections retrieved",
          req.id,
          await this.service.customerInspections(
            actor(req),
            validated<CustomerInspectionListQuery>(res, "query"),
          ),
        ),
      );
  requestInspection = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Inspection requested",
          req.id,
          await this.service.requestInspection(
            actor(req),
            validated<InspectionCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  staffInspections = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Inspections retrieved",
          req.id,
          await this.service.staffInspections(
            actor(req),
            validated<StaffInspectionListQuery>(res, "query"),
          ),
        ),
      );
  transitionInspection = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Inspection status updated",
          req.id,
          await this.service.transitionInspection(
            actor(req),
            ids(res).inspectionId!,
            validated<InspectionTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  customerTransactions = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle transactions retrieved",
          req.id,
          await this.service.customerTransactions(
            actor(req),
            validated<CustomerTransactionListQuery>(res, "query"),
          ),
        ),
      );
  customerTransaction = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle transaction retrieved",
          req.id,
          await this.service.customerTransaction(actor(req), ids(res).transactionId!),
        ),
      );
  createTransaction = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle transaction opened",
          req.id,
          await this.service.createTransaction(
            actor(req),
            validated<TransactionCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  reserve = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle reserved",
          req.id,
          await this.service.reserve(
            actor(req),
            ids(res).transactionId!,
            validated<ReservationInput>(res, "body"),
            validated<{ "idempotency-key": string }>(res, "headers")["idempotency-key"],
            context(req),
          ),
        ),
      );
  staffTransactions = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle transactions retrieved",
          req.id,
          await this.service.staffTransactions(
            actor(req),
            validated<StaffTransactionListQuery>(res, "query"),
          ),
        ),
      );
  staffTransaction = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle transaction retrieved",
          req.id,
          await this.service.staffTransaction(
            actor(req),
            ids(res).transactionId!,
            context(req),
          ),
        ),
      );
  negotiate = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle negotiation updated",
          req.id,
          await this.service.negotiate(
            actor(req),
            ids(res).transactionId!,
            validated<NegotiationInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transition = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle transaction status updated",
          req.id,
          await this.service.transition(
            actor(req),
            ids(res).transactionId!,
            validated<TransactionTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  expire = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Expired reservations released",
          req.id,
          await this.service.expire(
            actor(req),
            validated<ExpireReservationsInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createHandover = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle handover created",
          req.id,
          await this.service.createHandover(
            actor(req),
            ids(res).transactionId!,
            validated<HandoverCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionHandover = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle handover status updated",
          req.id,
          await this.service.transitionHandover(
            actor(req),
            ids(res).transactionId!,
            ids(res).handoverId!,
            validated<HandoverTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  handoverAccess = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Handover document access authorized",
          req.id,
          await this.service.handoverAccess(
            actor(req),
            ids(res).transactionId!,
            ids(res).handoverId!,
            context(req),
          ),
        ),
      );
}
