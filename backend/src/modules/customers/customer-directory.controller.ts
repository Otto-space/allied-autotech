import type { Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { successResponse } from "../../common/http/api-response.js";
import { CustomerDirectoryService } from "./customer-directory.service.js";
import type {
  DirectoryCollection,
  DirectoryQuery,
  RelatedQuery,
} from "./customer-directory.schemas.js";

function actor(request: Request) {
  if (!request.actor)
    throw new AppError({
      code: "UNAUTHORIZED",
      statusCode: 401,
      message: "Authentication is required",
    });
  return request.actor;
}
function context(request: Request) {
  return {
    requestId: String(request.id),
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
function validated<T>(response: Response, location: "params" | "query"): T {
  return response.locals.validated?.[location] as T;
}
export class CustomerDirectoryController {
  constructor(private readonly service = new CustomerDirectoryService()) {}
  list = async (request: Request, response: Response) => {
    const result = await this.service.list(
      actor(request),
      validated<DirectoryQuery>(response, "query"),
      context(request),
    );
    response.json(successResponse("Customers retrieved", request.id, result));
  };
  changeAccountStatus = async (request: Request, response: Response) => {
    const { customerId } = validated<{ customerId: string }>(response, "params");
    response.json(
      successResponse(
        "Customer account status updated",
        request.id,
        await this.service.changeAccountStatus(
          actor(request),
          customerId,
          response.locals.validated?.["body"],
          context(request),
        ),
      ),
    );
  };
  detail = async (request: Request, response: Response) => {
    const { customerId } = validated<{ customerId: string }>(response, "params");
    const result = await this.service.detail(
      actor(request),
      customerId,
      context(request),
    );
    response.json(successResponse("Customer retrieved", request.id, result));
  };
  related =
    (collection: DirectoryCollection) => async (request: Request, response: Response) => {
      const { customerId } = validated<{ customerId: string }>(response, "params");
      const result = await this.service.related(
        actor(request),
        customerId,
        collection,
        validated<RelatedQuery>(response, "query"),
        context(request),
      );
      response.json(successResponse("Customer records retrieved", request.id, result));
    };
}
