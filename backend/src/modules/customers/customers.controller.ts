import type { Request, Response } from "express";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  CustomerProfileUpdateInput,
  CustomerVehicleCreateInput,
  CustomerVehicleListQuery,
  CustomerVehicleUpdateInput,
} from "./customers.schemas.js";
import { customersService, type CustomersService } from "./customers.service.js";

function validated<T>(response: Response, location: "body" | "params" | "query"): T {
  return response.locals.validated?.[location] as T;
}

function actor(request: Request): AuthenticatedActor {
  if (request.actor === undefined) {
    throw new AppError({
      code: errorCodes.unauthorized,
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return request.actor;
}

function context(request: Request): RequestSecurityContext {
  return {
    requestId: String(request.id),
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

export class CustomersController {
  constructor(private readonly service: CustomersService = customersService) {}

  profile = async (request: Request, response: Response): Promise<void> => {
    const profile = await this.service.profile(actor(request));
    response
      .status(200)
      .json(successResponse("Customer profile retrieved", request.id, profile));
  };

  updateProfile = async (request: Request, response: Response): Promise<void> => {
    const profile = await this.service.updateProfile(
      actor(request),
      validated<CustomerProfileUpdateInput>(response, "body"),
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Customer profile updated", request.id, profile));
  };

  listVehicles = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.listVehicles(
      actor(request),
      validated<CustomerVehicleListQuery>(response, "query"),
    );
    response.status(200).json(
      successResponse("Customer vehicles retrieved", request.id, {
        vehicles: result.vehicles,
        ...(result.nextCursor === undefined ? {} : { nextCursor: result.nextCursor }),
      }),
    );
  };

  vehicle = async (request: Request, response: Response): Promise<void> => {
    const { vehicleId } = validated<{ vehicleId: string }>(response, "params");
    const vehicle = await this.service.vehicle(actor(request), vehicleId);
    response
      .status(200)
      .json(successResponse("Customer vehicle retrieved", request.id, vehicle));
  };

  createVehicle = async (request: Request, response: Response): Promise<void> => {
    const vehicle = await this.service.createVehicle(
      actor(request),
      validated<CustomerVehicleCreateInput>(response, "body"),
      context(request),
    );
    response
      .status(201)
      .json(successResponse("Customer vehicle created", request.id, vehicle));
  };

  updateVehicle = async (request: Request, response: Response): Promise<void> => {
    const { vehicleId } = validated<{ vehicleId: string }>(response, "params");
    const vehicle = await this.service.updateVehicle(
      actor(request),
      vehicleId,
      validated<CustomerVehicleUpdateInput>(response, "body"),
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Customer vehicle updated", request.id, vehicle));
  };

  deleteVehicle = async (request: Request, response: Response): Promise<void> => {
    const { vehicleId } = validated<{ vehicleId: string }>(response, "params");
    await this.service.deleteVehicle(actor(request), vehicleId, context(request));
    response.status(200).json(successResponse("Customer vehicle deleted", request.id));
  };
}
