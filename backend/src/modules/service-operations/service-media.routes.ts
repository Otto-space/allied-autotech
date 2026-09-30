import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  mediaConfirmSchema,
  mediaUploadSchema,
  mediaVersionSchema,
  type MediaConfirmInput,
  type MediaUploadInput,
} from "../media/media.schemas.js";
import {
  serviceParamsSchema,
  serviceOperationsEmptyQuerySchema as query,
} from "./service-operations.schemas.js";
import {
  serviceImageParamsSchema,
  serviceImageUpdateSchema,
} from "./service-media.schemas.js";
import { ServiceMediaService } from "./service-media.service.js";
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const ids = (res: Response) =>
  res.locals.validated?.["params"] as { serviceId: string; imageId: string };
const body = <T>(res: Response) => res.locals.validated?.["body"] as T;
function sendImage(res: Response, result: { mimeType: string; bytes: Buffer }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type(result.mimeType).send(result.bytes);
}
export function createPublicServiceMediaRouter(service = new ServiceMediaService()) {
  const router = Router();
  router.get(
    "/media/images/:imageId",
    validate({ params: z.object({ imageId: z.uuid() }).strict(), query }),
    async (_req, res) => sendImage(res, await service.read(ids(res).imageId)),
  );
  return router;
}
export function createServiceMediaRouter(service = new ServiceMediaService()) {
  const router = Router();
  router.use(authenticate(), requireAdministrator);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/:serviceId/images",
    validate({ params: serviceParamsSchema, query }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service images",
          req.id,
          await service.snapshot(req.actor!, ids(res).serviceId),
        ),
      );
    },
  );
  router.get(
    "/:serviceId/images/:imageId/content",
    validate({ params: serviceImageParamsSchema, query }),
    async (req, res) =>
      sendImage(
        res,
        await service.read(ids(res).imageId, {
          actor: req.actor!,
          serviceId: ids(res).serviceId,
        }),
      ),
  );
  router.post(
    "/:serviceId/assets/upload",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: serviceParamsSchema, query, body: mediaUploadSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service image upload prepared",
          req.id,
          await service.prepare(
            req.actor!,
            ids(res).serviceId,
            body<MediaUploadInput>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.put(
    "/:serviceId/image",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: serviceParamsSchema, query, body: mediaConfirmSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service image saved",
          req.id,
          await service.confirm(
            req.actor!,
            ids(res).serviceId,
            body<MediaConfirmInput>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.patch(
    "/:serviceId/images/:imageId",
    requireCsrf,
    validate({ params: serviceImageParamsSchema, query, body: serviceImageUpdateSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service image updated",
          req.id,
          await service.update(
            req.actor!,
            ids(res).serviceId,
            ids(res).imageId,
            body<z.infer<typeof serviceImageUpdateSchema>>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.delete(
    "/:serviceId/images/:imageId",
    requireCsrf,
    validate({ params: serviceImageParamsSchema, query, body: mediaVersionSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service image removed",
          req.id,
          await service.remove(
            req.actor!,
            ids(res).serviceId,
            ids(res).imageId,
            body<{ expectedVersion: number }>(res).expectedVersion,
            context(req),
          ),
        ),
      );
    },
  );
  return router;
}
