import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  NotificationListQuery,
  PreferenceUpdateInput,
} from "./notifications.schemas.js";
import {
  notificationsService,
  type NotificationsService,
} from "./notifications.service.js";

const validated = <T>(response: Response, location: "body" | "params" | "query") =>
  response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});

export class NotificationsController {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  list = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Notifications retrieved",
          req.id,
          await this.service.list(
            actor(req),
            validated<NotificationListQuery>(res, "query"),
          ),
        ),
      );
  markRead = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Notification marked as read",
          req.id,
          await this.service.markRead(
            actor(req),
            validated<{ notificationId: string }>(res, "params").notificationId,
          ),
        ),
      );
  markAllRead = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Notifications marked as read",
          req.id,
          await this.service.markAllRead(actor(req)),
        ),
      );
  preferences = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Notification preferences retrieved",
          req.id,
          await this.service.preferences(actor(req)),
        ),
      );
  updatePreference = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Notification preference updated",
          req.id,
          await this.service.updatePreference(
            actor(req),
            validated<PreferenceUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
