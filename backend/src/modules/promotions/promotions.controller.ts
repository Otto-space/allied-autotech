import type { Request, Response } from "express";
import { successResponse } from "../../common/http/api-response.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import type {
  PromotionCreateInput,
  PromotionListQuery,
  PromotionPreviewInput,
  PromotionUpdateInput,
} from "./promotions.schemas.js";
import { promotionsService, type PromotionsService } from "./promotions.service.js";

const validated = <T>(response: Response, location: "body" | "params" | "query") =>
  response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});
export class PromotionsController {
  constructor(private readonly service: PromotionsService = promotionsService) {}
  preview = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Promotion evaluated",
          req.id,
          await this.service.preview(
            actor(req),
            validated<PromotionPreviewInput>(res, "body"),
          ),
        ),
      );
  list = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Promotions retrieved",
          req.id,
          await this.service.list(
            actor(req),
            validated<PromotionListQuery>(res, "query"),
          ),
        ),
      );
  get = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Promotion retrieved",
          req.id,
          await this.service.get(
            actor(req),
            validated<{ promotionId: string }>(res, "params").promotionId,
          ),
        ),
      );
  create = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Promotion created",
          req.id,
          await this.service.create(
            actor(req),
            validated<PromotionCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  update = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Promotion updated",
          req.id,
          await this.service.update(
            actor(req),
            validated<{ promotionId: string }>(res, "params").promotionId,
            validated<PromotionUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
