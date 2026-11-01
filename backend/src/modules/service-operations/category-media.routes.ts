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
import { serviceOperationsEmptyQuerySchema as query } from "./service-operations.schemas.js";
import {
  categoryParamsSchema,
  categoryImageParamsSchema,
  categoryImageUpdateSchema,
} from "./category-media.schemas.js";
import { CategoryMediaService } from "./category-media.service.js";
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const ids = (res: Response) =>
  res.locals.validated?.["params"] as { categoryId: string; imageId: string };
const body = <T>(res: Response) => res.locals.validated?.["body"] as T;
function sendImage(res: Response, result: { mimeType: string; bytes: Buffer }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type(result.mimeType).send(result.bytes);
}
export function createCategoryMediaRouter(service = new CategoryMediaService()) {
  const router = Router();
  router.use(authenticate(), requireAdministrator);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/:categoryId/images",
    validate({ params: categoryParamsSchema, query }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service group images",
          req.id,
          await service.snapshot(req.actor!, ids(res).categoryId),
        ),
      );
    },
  );
  router.get(
    "/:categoryId/images/:imageId/content",
    validate({ params: categoryImageParamsSchema, query }),
    async (req, res) =>
      sendImage(
        res,
        await service.read(ids(res).imageId, {
          actor: req.actor!,
          serviceCategoryId: ids(res).categoryId,
        }),
      ),
  );
  router.post(
    "/:categoryId/assets/upload",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: categoryParamsSchema, query, body: mediaUploadSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service group image upload prepared",
          req.id,
          await service.prepare(
            req.actor!,
            ids(res).categoryId,
            body<MediaUploadInput>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.put(
    "/:categoryId/image",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({ params: categoryParamsSchema, query, body: mediaConfirmSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service group image saved",
          req.id,
          await service.confirm(
            req.actor!,
            ids(res).categoryId,
            body<MediaConfirmInput>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.patch(
    "/:categoryId/images/:imageId",
    requireCsrf,
    validate({
      params: categoryImageParamsSchema,
      query,
      body: categoryImageUpdateSchema,
    }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service group image updated",
          req.id,
          await service.update(
            req.actor!,
            ids(res).categoryId,
            ids(res).imageId,
            body<z.infer<typeof categoryImageUpdateSchema>>(res),
            context(req),
          ),
        ),
      );
    },
  );
  router.delete(
    "/:categoryId/images/:imageId",
    requireCsrf,
    validate({ params: categoryImageParamsSchema, query, body: mediaVersionSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service group image removed",
          req.id,
          await service.remove(
            req.actor!,
            ids(res).categoryId,
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
