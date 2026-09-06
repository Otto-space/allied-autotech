import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import { billingService, type BillingService } from "./billing.service.js";
import type {
  CustomerInvoiceListQuery,
  InvoiceCreateInput,
  InvoiceTransitionInput,
  StaffInvoiceListQuery,
} from "./billing.schemas.js";
const validated = <T>(response: Response, location: "body" | "params" | "query") =>
  response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});
const id = (response: Response) =>
  validated<{ invoiceId: string }>(response, "params").invoiceId;
export class BillingController {
  constructor(private readonly service: BillingService = billingService) {}
  customerList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoices retrieved",
          req.id,
          await this.service.customerList(
            actor(req),
            validated<CustomerInvoiceListQuery>(res, "query"),
          ),
        ),
      );
  customerGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoice retrieved",
          req.id,
          await this.service.customerGet(actor(req), id(res)),
        ),
      );
  staffList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoices retrieved",
          req.id,
          await this.service.staffList(
            actor(req),
            validated<StaffInvoiceListQuery>(res, "query"),
          ),
        ),
      );
  staffGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoice retrieved",
          req.id,
          await this.service.staffGet(actor(req), id(res), context(req)),
        ),
      );
  create = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Invoice created",
          req.id,
          await this.service.create(
            actor(req),
            validated<InvoiceCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  issue = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoice issued",
          req.id,
          await this.service.issue(
            actor(req),
            id(res),
            validated<InvoiceTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  void = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Invoice voided",
          req.id,
          await this.service.void(
            actor(req),
            id(res),
            validated<InvoiceTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
