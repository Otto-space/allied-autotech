import type { Request, Response } from "express";
import { successResponse } from "../../common/http/api-response.js";
import { GarageMediaService } from "./garage-media.service.js";
import type { GarageImageConfirm, GarageImageUpdate } from "./garage-media.schemas.js";
import type { MediaUploadInput } from "../media/media.schemas.js";
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const params = (res: Response) =>
  res.locals.validated?.["params"] as { vehicleId: string; imageId: string };
const body = <T>(res: Response) => res.locals.validated?.["body"] as T;
export class GarageMediaController {
  constructor(private readonly service = new GarageMediaService()) {}
  prepare = async (req: Request, res: Response) => {
    res.json(
      successResponse(
        "Garage image upload prepared",
        req.id,
        await this.service.prepare(
          req.actor!,
          params(res).vehicleId,
          body<MediaUploadInput>(res),
          context(req),
        ),
      ),
    );
  };
  confirm = async (req: Request, res: Response) => {
    res.json(
      successResponse(
        "Garage image attached",
        req.id,
        await this.service.confirm(
          req.actor!,
          params(res).vehicleId,
          body<GarageImageConfirm>(res),
          context(req),
        ),
      ),
    );
  };
  update = async (req: Request, res: Response) => {
    const ids = params(res);
    res.json(
      successResponse(
        "Garage image updated",
        req.id,
        await this.service.update(
          req.actor!,
          ids.vehicleId,
          ids.imageId,
          body<GarageImageUpdate>(res),
          context(req),
        ),
      ),
    );
  };
  remove = async (req: Request, res: Response) => {
    const ids = params(res);
    res.json(
      successResponse(
        "Garage image removed",
        req.id,
        await this.service.remove(
          req.actor!,
          ids.vehicleId,
          ids.imageId,
          body<{ expectedVersion: number }>(res).expectedVersion,
          context(req),
        ),
      ),
    );
  };
}
