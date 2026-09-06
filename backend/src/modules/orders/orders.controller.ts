import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  CheckoutInput,
  CustomerOrderCancelInput,
  CustomerOrderListQuery,
  ExpireOrdersInput,
  OrderTransitionInput,
  StaffOrderListQuery,
} from "./orders.schemas.js";
import { ordersService, type OrdersService } from "./orders.service.js";

const validated = <T>(
  response: Response,
  location: "body" | "params" | "query" | "headers",
) => response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId:
    typeof request.id === "string" ? request.id : (JSON.stringify(request.id) ?? ""),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});
const id = (response: Response) =>
  validated<{ orderId: string }>(response, "params").orderId;
export class OrdersController {
  constructor(private readonly service: OrdersService = ordersService) {}
  checkout = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Checkout completed",
          req.id,
          await this.service.checkout(
            actor(req),
            validated<CheckoutInput>(res, "body"),
            validated<{ "idempotency-key": string }>(res, "headers")["idempotency-key"],
            context(req),
          ),
        ),
      );
  customerList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Orders retrieved",
          req.id,
          await this.service.customerOrders(
            actor(req),
            validated<CustomerOrderListQuery>(res, "query"),
          ),
        ),
      );
  customerGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Order retrieved",
          req.id,
          await this.service.customerOrder(actor(req), id(res)),
        ),
      );
  customerCancel = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Order cancelled",
          req.id,
          await this.service.customerCancel(
            actor(req),
            id(res),
            validated<CustomerOrderCancelInput>(res, "body"),
            context(req),
          ),
        ),
      );
  staffList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Orders retrieved",
          req.id,
          await this.service.staffOrders(
            actor(req),
            validated<StaffOrderListQuery>(res, "query"),
          ),
        ),
      );
  staffGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Order retrieved",
          req.id,
          await this.service.staffOrder(actor(req), id(res), context(req)),
        ),
      );
  transition = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Order status updated",
          req.id,
          await this.service.transition(
            actor(req),
            id(res),
            validated<OrderTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  expire = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Expired orders processed",
          req.id,
          await this.service.expireDue(
            actor(req),
            validated<ExpireOrdersInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
