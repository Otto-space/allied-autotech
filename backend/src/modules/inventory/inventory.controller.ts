import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  InventoryCreateInput,
  InventoryHistoryQuery,
  InventoryListQuery,
  InventoryMovementInput,
  InventoryReleaseInput,
  InventoryReservationInput,
  InventoryReservationListQuery,
  InventoryUpdateInput,
} from "./inventory.schemas.js";
import { inventoryService, type InventoryService } from "./inventory.service.js";

function validated<T>(
  response: Response,
  location: "body" | "headers" | "params" | "query",
): T {
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
function ids(response: Response): { inventoryId: string; reservationId: string } {
  return validated(response, "params");
}
function idempotencyKey(response: Response): string {
  return validated<{ "idempotency-key": string }>(response, "headers")["idempotency-key"];
}

export class InventoryController {
  constructor(private readonly service: InventoryService = inventoryService) {}
  list = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory retrieved",
          req.id,
          await this.service.list(
            actor(req),
            validated(res, "query") as InventoryListQuery,
          ),
        ),
      );
  };
  get = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory retrieved",
          req.id,
          await this.service.get(actor(req), ids(res).inventoryId),
        ),
      );
  };
  create = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Inventory created",
          req.id,
          await this.service.create(
            actor(req),
            validated(res, "body") as InventoryCreateInput,
            context(req),
          ),
        ),
      );
  };
  update = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory settings updated",
          req.id,
          await this.service.update(
            actor(req),
            ids(res).inventoryId,
            validated(res, "body") as InventoryUpdateInput,
            context(req),
          ),
        ),
      );
  };
  movement = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory movement recorded",
          req.id,
          await this.service.movement(
            actor(req),
            ids(res).inventoryId,
            validated(res, "body") as InventoryMovementInput,
            idempotencyKey(res),
            context(req),
          ),
        ),
      );
  };
  reserve = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        successResponse(
          "Inventory reserved",
          req.id,
          await this.service.reserve(
            actor(req),
            ids(res).inventoryId,
            validated(res, "body") as InventoryReservationInput,
            idempotencyKey(res),
            context(req),
          ),
        ),
      );
  };
  release = async (req: Request, res: Response) => {
    const value = ids(res);
    res
      .status(200)
      .json(
        successResponse(
          "Inventory reservation released",
          req.id,
          await this.service.release(
            actor(req),
            value.inventoryId,
            value.reservationId,
            validated(res, "body") as InventoryReleaseInput,
            idempotencyKey(res),
            context(req),
          ),
        ),
      );
  };
  history = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory history retrieved",
          req.id,
          await this.service.history(
            actor(req),
            ids(res).inventoryId,
            validated(res, "query") as InventoryHistoryQuery,
          ),
        ),
      );
  };
  reservations = async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        successResponse(
          "Inventory reservations retrieved",
          req.id,
          await this.service.reservations(
            actor(req),
            ids(res).inventoryId,
            validated(res, "query") as InventoryReservationListQuery,
          ),
        ),
      );
  };
}
